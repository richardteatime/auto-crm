# PLAN — Funnel a 2 call (Cugina di Rick → Leo)

> Da funnel a **una** call (tutto su Leo) a funnel a **due** call: scrematura a
> freddo della **setter** "Cugina di Rick", poi chiusura del **closer** "Leo".
> Data: 2026-06-02.

## Obiettivo

Modellare il processo di vendita reale a 2 telefonate:

```
Form inviato → Lead nel CRM (freddo)
      │
   📞 CALL 1 — Cugina (scrematura "a freddo", OUTBOUND)   ← task "da chiamare" a lei
      │  registra esito nella scheda lead:
      ├─ Chiuso ✅ ............................ Lead VINTO (può chiudere lei)
      ├─ Qualificato → passa a Leo ........... crea CALL 2 + Cugina prenota lo slot di Leo
      ├─ Richiamare / non risponde ........... follow-up programmato a Cugina
      └─ Non qualificato / non interessato ... Lead PERSO
      │
   📞 CALL 2 — Leo (chiusura, contatto già caldo)
      └─ esito → Vinto / Perso / Preventivo (routing esistente)
```

## Decisioni prese con l'utente (2026-06-02)

1. **Call 1 = Cugina OUTBOUND** — il lead arriva, lei vede il task e chiama. Nessun link da prenotare per la call 1.
2. **Call 2 = Cugina prenota Leo dal CRM** — un bottone nella scheda lead apre il calendario di Leo pre-compilato. Nessuna email self-serve al lead.
3. **Cugina può chiudere** → bottone "Segna Vinto".
4. **Identità Cugina** = `francy3391@gmail.com` per ora (configurabile via env).

## Architettura: DOVE vive la logica

Esistono due motori. La scelta è netta:

- **Pipeline lead** (`src/lib/leads/automation/` — call task → esito → routing):
  **QUI** vive la logica setter→closer. È già fatta per le chiamate; la estendiamo.
- **Workflow builder** (nodi drag-and-drop, `src/lib/workflows/`): resta solo per
  **notifiche email**. NON può "aspettare l'esito di una telefonata umana".

Conseguenza: il workflow `form_submitted` (oggi: email a Leo / link al cliente) va
**ridotto a sola notifica interna**, perché il primo contatto ora è Cugina via
`lead_created`. Altrimenti Leo verrebbe avvisato troppo presto / doppio.

## Mappa stati (riuso enum esistenti — nessuna migrazione di schema)

`status`: new · to_call · working · qualified · won · lost
`pipelineStage`: prospect · opportunity · contacted · proposal
La logica di routing **distingue chi ha fatto la call** leggendo `callTask.assignedTo`
(setter `cugina` vs closer `leo`).

| Momento | Chi | status | stage |
|---|---|---|---|
| Form arrivato | — | new→to_call | prospect |
| Call 1 creata | Cugina | to_call | prospect |
| Cugina: Vinto | — | **won** | invariato |
| Cugina: Qualificato→Leo | crea task Leo | **qualified** | **opportunity** |
| Cugina: Richiamare/No-answer | Cugina | working | prospect |
| Cugina: Non qualificato | — | **lost** | contacted |
| Call 2 creata | Leo | qualified | opportunity |
| Leo: Qualificato/Preventivo | — | qualified | **proposal** (→ bozza preventivo) |
| Leo: Vinto / Perso | — | won / lost | invariato |
| Leo: Richiamare | Leo | working | opportunity |

## Lavori

### 0. Verifica preliminare
- [ ] Confermare che `POST /api/public/forms/[id]/submit` passi da `ingestLead`
  (→ fa scattare `lead_created`). Se non lo fa, instradarlo lì.

### A. Identità + regole (pipeline lead)
- [ ] `actions.ts`: nuova `setterIdentity` (`CUGINA_USER_ID`/`CUGINA_NAME`/`CUGINA_EMAIL`).
- [ ] `actions.ts`: nuova action `create_setter_call_task` (come `createLeoCallTask` ma
  per la setter; crea task `pending` a Cugina, lead `to_call`, email a Cugina). Idempotente.
- [ ] `actions.ts`: **rework di `routeLeadByOutcome`** → carica il call task completato
  (`getCallTask(payload.callTaskId)`) e ramifica:
  - **setter** + qualified/interested/needs_quote → status `qualified`, stage `opportunity`,
    crea call task per **Leo** (idempotente). (Contatto → temperatura `warm`.)
  - **setter** + no_answer/call_later → follow-up a **Cugina** (+24h), status `working`.
  - **setter** + not_qualified/not_interested/wrong_number → status `lost`.
  - **closer (Leo)** → routing attuale invariato (proposal / follow-up / lost).
- [ ] `adapters/email.ts`: `sendToSetter(subject, html)` (usa CUGINA_EMAIL, fallback LEO/founder).
- [ ] `automation/index.ts`: export `setterIdentity`.

### B. Prenotazione "per conto di" (calendario)
- [ ] **NEW** `POST /api/leads/[id]/escalate-to-leo`: escala (qualified + opportunity +
  task Leo idempotente) e **ritorna l'URL del booking di Leo** pre-compilato
  (`/book/<slug>?name=&email=&phone=&leadId=`). Trova il link di Leo per
  `LEO_BOOKING_SLUG` o per assignee `leo`.
- [ ] `PublicBookingWidget.tsx`: leggere i query param e **pre-riempire** nome/email/telefono.

### C. NEW endpoint stato
- [ ] **NEW** `POST /api/leads/[id]/set-status` `{ status }` (valida su `LEAD_STATUSES`).
  Usato dai bottoni "Segna Vinto" / "Segna Perso".

### D. UI scheda lead (`LeadDetail.tsx`)
- [ ] Card chiamata **context-aware**: titolo "Call 1 — Cugina (scrematura)" se il task
  aperto è di Cugina; "Call 2 — Leo (chiusura)" se è di Leo.
- [ ] Bottoni:
  - contesto Cugina: **"Passa a Leo → prenota call"** (chiama escalate, poi apre il booking),
    **"Segna Vinto"**, + dropdown esito + "Registra esito" (per richiama/perso).
  - contesto Leo: dropdown esito + "Registra esito", "Segna Vinto" / "Segna Perso".
- [ ] Aggiornare il testo-spiegazione del routing.

### E. Seed / config
- [ ] **NEW** `scripts/seed-two-call-pipeline.ts`:
  - aggiorna la regola `lead_created`: `create_leo_call_task` → `create_setter_call_task`;
  - aggiorna/(disattiva) `stage_changed_to_prospect` (oggi crea task a Leo) → setter;
  - verifica/crea il booking link di Leo (`call-leo`);
  - **riconfigura il workflow `form_submitted`** a sola "notifica team" (no email-Leo/cliente).
- [ ] `setup-appwrite.ts`: aggiornare la regola default `lead_created` (parità installazioni nuove).
- [ ] `.env.local` + `docker-compose.yml`: `CUGINA_NAME`, `CUGINA_USER_ID`, `CUGINA_EMAIL`,
  `LEO_BOOKING_SLUG`.

## File toccati
- `src/lib/leads/automation/actions.ts` (identità setter, create_setter_call_task, routeLeadByOutcome)
- `src/lib/leads/automation/adapters/email.ts` (sendToSetter)
- `src/lib/leads/automation/index.ts` (export)
- `src/app/api/leads/[id]/escalate-to-leo/route.ts` (NEW)
- `src/app/api/leads/[id]/set-status/route.ts` (NEW)
- `src/components/leads/LeadDetail.tsx` (card context-aware + bottoni)
- `src/components/capture/PublicBookingWidget.tsx` (prefill da query)
- `scripts/seed-two-call-pipeline.ts` (NEW)
- `scripts/setup-appwrite.ts` (regola default)
- `.env.local`, `docker-compose.yml`

## Fuori scope (per ora)
- Booking link self-serve per Cugina (call 1 è outbound).
- Creazione automatica deal/preventivo alla chiusura di Cugina (resta "Trasforma in preventivo" manuale).
- Round-robin tra più setter (una sola Cugina per ora; il sistema booking già supporta multi-assignee se servirà).

## Rischi / note
- Doppio motore sullo stesso form: assicurarsi che `lead_created` (Cugina) e il
  workflow `form_submitted` (notifica) non si pestino → workflow ridotto a notifica.
- `getOpenCallTaskForLead` ritorna il primo task aperto: con un solo task aperto per
  volta è corretto; evitare di lasciare aperti task di Cugina e Leo insieme.
- Le action "fantasma" nelle regole (`enrich_lead_summary`, ecc.) restano no-op (skip).

## Definition of Done
- `npx tsc --noEmit` 0 · `npm run lint` 0.
- `scripts/seed-two-call-pipeline.ts` gira su Appwrite reale (idempotente).
- E2E manuale: form → task Cugina + email a Cugina → "Passa a Leo" → calendario Leo
  pre-compilato → prenotazione → esito Leo → preventivo.
- Commit + push su `feature/orchestrator-gate`. Redeploy su Coolify (è codice).
