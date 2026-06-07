# Analisi Completa — Auto-CRM (SARCONX-OS)
## Bug, Sicurezza, Architettura, UX e Upgrade Path

**Data analisi:** 2026-06-06  
**Metodologia:** `/goodcode` — analisi multi-agente esaustiva (6 worker specializzati)  
**Scope:** 359 file TS/TSX — API, workflow engine, lead pipeline, data layer, frontend, architettura  
**Baseline:** `tsc --noEmit` 0 errori, `eslint` 0 errori

---

## Executive Summary

Il progetto e **funzionalmente impressionante**: lead pipeline, workflow builder visuale, funnel a 2 call, landing editor, quote PDF, Telegram bot, orchestrator AI — tutto in TypeScript con build pulito.

Ma sotto la superficie ci sono **falle di sicurezza, race condition e debito tecnico significativo** che, se non affrontati, rischiano di compromettere la correttezza dei dati e l'affidabilita in produzione.

**I 3 problemi piu pericolosi:**
1. **Endpoint aperti e trigger senza auth** — chiunque puo eseguire workflow, creare lead falsi, e invocare callback orchestrator.
2. **Race condition ovunque** — doppi task, doppie email, doppie prenotazioni, lead duplicati.
3. **Zero test suite + global fetch patch** — ogni refactor e una roulette russa.

---

## CRITICAL — Risolvere subito

### 1. Endpoint senza autenticazione obbligatoria
- **File:** `src/app/api/workflow/trigger/route.ts`, `src/app/api/orchestrator/callback/*/route.ts`, `src/app/api/workflow/process-scheduled/route.ts`
- **Problema:** Gli orchestrator callback verificano il secret **solo se configurato**. Se manca, l'endpoint e pubblico. Il workflow trigger accetta qualsiasi `triggerType` senza auth. Il worker scheduled ha secret opzionale.
- **Rischio:** Attaccante triggera workflow interni, crea contatti/deal fasulli, invia email, o esegue deploy finti.
- **Fix:** Rifiutare SEMPRE con 401 se il secret/auth manca. Mai fallback aperto.

### 2. Race condition su create-or-update (contatti e lead)
- **File:** `src/lib/db/contacts.ts:59-79`, `src/lib/db/leads.ts:181-207`
- **Problema:** Pattern classico *read-then-write* senza transazioni. Due richieste parallele trovano entrambe "nessun duplicato" e ne creano due.
- **Rischio:** Database sporco di duplicati irreversibili.
- **Fix:** Sfruttare gli indici `unique` di Appwrite su email/phone e catturare errore 409 con retry.

### 3. Workflow trigger fire-and-forget + non idempotente
- **File:** `src/lib/workflows/trigger.ts:8-26`
- **Problema:** `triggerWorkflows` e chiamato senza `await` in tutte le API route. Usa `Promise.allSettled(...).catch(() => {})` che ingoia ogni errore. Nessuna chiave di idempotenza: doppio submit = doppio workflow.
- **Rischio:** Email duplicate, task duplicate, deal duplicati, azioni workflow eseguite N volte.
- **Fix:** Aggiungere `idempotencyKey` (es. `triggerType:leadId:timestamp`) e salvarla in cache/DB con TTL. `await` il trigger nelle route critiche.

### 4. Worker scheduled: fetch non atomico
- **File:** `src/app/api/workflow/process-scheduled/route.ts:21-30`
- **Problema:** Nessun lock: due worker possono prendere lo stesso item `pending`, entrambi lo eseguono.
- **Rischio:** Azioni duplicate su delay/resume.
- **Fix:** Cancellare l'item scheduled *prima* dell'esecuzione, o usare token di lock univoco.

### 5. Funnel a 2 call: routing doppio (codice + workflow builder)
- **File:** `src/app/api/leads/[id]/call-outcome/route.ts:67-89`
- **Problema:** Dopo una chiamata, l'endpoint chiama **sia** il vecchio motore `fireTrigger("call_completed")` **sia** il nuovo `triggerWorkflows("call_outcome_recorded")`. Entrambi agiscono sullo stesso lead senza coordinamento.
- **Rischio:** Task duplicati, stage sovrascritti, email doppie.
- **Fix:** Scegliere UN motore per il routing post-call. Disattivare l'altro.

### 6. `getOpenCallTaskForLead` non filtra per assegnatario
- **File:** `src/lib/db/call-tasks.ts:116-124`
- **Problema:** Ritorna il primo task aperto. Se esistono task aperti di Cugina e Leo contemporaneamente, il `call-outcome` potrebbe chiudere quello sbagliato.
- **Rischio:** Routing completamente errato (setter call trattata come closer call).
- **Fix:** Aggiungere parametro `assignedTo` al filtro.

### 7. `escalate-to-leo` non idempotente
- **File:** `src/app/api/leads/[id]/escalate-to-leo/route.ts:54-68`
- **Problema:** Nessuna transazione: doppio click = doppio task Leo.
- **Fix:** Wrappare in check atomico o usare unique constraint su `(leadId, assignedTo, status=pending)`.

### 8. Quote: bozza testo vs quote vero sono monete diverse
- **File:** `src/lib/leads/quotes.ts` vs `src/lib/db/quotes.ts` + `src/app/api/quotes/[id]/pdf/route.ts`
- **Problema:** `buildQuoteDraft` genera `LeadQuote` con campi (`category`, `amountSuggested`, `generatedText`). `convert-to-quote` mappa in `Quote` con campi diversi (`dealId`, `number`, `items`, `vatRate`). Perde `generatedText` e inventa `quantity:1`, `discount:0`, `billingType:"una_tantum"`.
- **Rischio:** Il PDF A4 e vuoto o generico. L'utente vede una bozza ricca e un preventivo povero.
- **Fix:** Allineare lo schema quote o usare direttamente il testo generato come descrizione item.

### 9. Monkey-patch globale su `fetch`
- **File:** `src/lib/appwrite.ts`
- **Problema:** Sovrascrive `globalThis.fetch` per rimuovere header Appwrite. Intercetta **tutte** le fetch (OpenAI, Telegram, Resend).
- **Rischio:** Aggiornamenti SDK o altre librerie possono rompersi silenziosamente. Debug impossibile.
- **Fix:** Passare un `fetch` locale patchato solo al client Appwrite, non globale.

### 10. Zero test suite
- **File:** `package.json`
- **Problema:** Nessun framework di test. 43 moduli DB, executor workflow, parser lead — tutti senza coverage.
- **Rischio:** Ogni refactor e cieco. Regressioni in produzione.
- **Fix:** Vitest per unit test. Playwright per e2e critici (funnel, booking, workflow).

---

## HIGH — Affrontare nelle prossime 2 settimane

### 11. Rate limiting in-memory (non scala)
- **File:** `src/lib/capture/rate-limit.ts`
- **Problema:** `Map` in-memory per-processo. In multi-instance o dopo restart, i limiti si azzerano.
- **Fix:** Redis (Upstash/ioredis) o almeno documentare la limitazione.

### 12. `fromDoc<T>` cast generico su tutto il DB layer
- **File:** Tutti `src/lib/db/*.ts`
- **Problema:** `as T` senza validazione runtime. Se Appwrite restituisce campi mancanti, il bug esplode piu avanti.
- **Fix:** Parser Zod per entita critiche, o almeno fallback espliciti.

### 13. Query con `limit(500)` senza paginazione
- **File:** `src/lib/db/*` (21 funzioni `list*`)
- **Problema:** Su dataset grandi, dati troncati silenziosamente o OOM.
- **Fix:** Esportare `offset`/`cursor` e `limit` nei parametri `list*`.

### 14. `visited` Set rompe i DAG join (workflow diamond)
- **File:** `src/lib/workflows/executor.ts:166-180`
- **Problema:** Se un workflow ha un branch che si riunisce (pattern diamante), il secondo ramo trova il nodo in `visited` e fallisce con "ciclo infinito".
- **Fix:** Distinguere `visited` da `inStack` per la cycle detection vera.

### 15. `runTest` esegue mutazioni reali
- **File:** `src/lib/workflows/executor.ts:74-79`
- **Problema:** Il "test" nel workflow builder crea contatti veri, invia email vere, muove stage veri.
- **Fix:** Aggiungere flag `dryRun` che simula senza mutare.

### 16. Finance module: `isFinanceUser` ritorna sempre `true`
- **File:** `src/lib/finance-auth.ts:8-13`
- **Problema:** Qualsiasi utente autenticato accede a MRR, spese, ricavi.
- **Fix:** Whitelist `FINANCE_USER_IDS` o ruolo nel DB.

### 17. Error handling che espone messaggi interni
- **File:** `src/app/api/webhook/route.ts`, `src/app/api/leads/email-inbound/route.ts`, `src/app/api/telegram/webhook/route.ts`
- **Problema:** `error.message` diretto nella risposta 500.
- **Fix:** Loggare lato server, rispondere messaggio generico.

### 18. Hydration mismatch su date
- **File:** `src/components/activities/ActivityCalendar.tsx:46`, `ActivityTimeline.tsx:35`
- **Problema:** `useState(new Date())` inizializza con data diversa tra server e client.
- **Fix:** Inizializzare con `null` e settare in `useEffect`.

### 19. `dangerouslySetInnerHTML` in pagina pubblica
- **File:** `src/app/form/[id]/page.tsx:82`
- **Problema:** Inietta script inline. Se in futuro viene parametrizzato, diventa XSS.
- **Fix:** Spostare in componente client con `useEffect`.

### 20. Mancanza totale di Error Boundaries
- **File:** Tutto il progetto
- **Problema:** Nessun `error.tsx` o `react-error-boundary`. Un crash in un componente rende bianca l'app.
- **Fix:** Aggiungere `error.tsx` nei layout principali.

### 21. `window`/`document` usati senza guardia SSR
- **File:** `src/components/capture/PublicBookingWidget.tsx`, `NotificationToggle.tsx`
- **Problema:** Crash in SSR se Next.js prerenderizza.
- **Fix:** Spostare in `useEffect`.

---

## MEDIUM — Pianificare nel mese

### 22. CORS `*` su endpoint pubblici
- **Fix:** Whitelist di origini consentite o CSRF token.

### 23. Validazione input manuale (senza Zod) nelle API
- **Fix:** Zod su tutte le route.

### 24. Upload file trust del MIME type client
- **Fix:** Validare magic bytes.

### 25. Denormalizzazione dati senza sync
- **File:** `src/lib/db/deals.ts` (`contactName`, `stageName`)
- **Fix:** Sync automatico o rimuovere denormalizzazione.

### 26. Workflow: context loss su scheduled resume
- **File:** `src/lib/workflows/executor.ts:92-102`
- **Problema:** Se `JSON.parse` del payload fallisce, il contesto viene azzerato.
- **Fix:** Fallire il run, non continuare con contesto vuoto.

### 27. Condizione `nextNodeId` ignorata dall'executor
- **File:** `src/lib/workflows/executor.ts` + `handlers.ts`
- **Problema:** Il condition executor ritorna `nextNodeId`, ma `traverse` lo ignora e usa l'etichetta dell'edge.
- **Fix:** Unificare la logica di routing.

### 28. Interpolazione variabili silenziosa su `{{var}}` mancante
- **File:** `src/lib/workflows/handlers.ts:28-49`
- **Problema:** Variabile sbagliata = stringa vuota, senza warning.
- **Fix:** Loggare warning o fallire in strict mode.

### 29. `createDeal` N+1 query
- **File:** `src/lib/db/deals.ts:117-120`
- **Problema:** `resolveDenormFields` + `getStage` = 3 query per deal.
- **Fix:** Batchare o usare cache.

### 30. Indici DB mancanti
- **File:** `scripts/setup-appwrite.ts`
- **Problema:** Mancano indici compositi e fulltext su campi frequenti (`contacts.name`, `leads.fullName`, `workflow.status+triggerType`).
- **Fix:** Aggiungere indici.

---

## LOW — Da fare quando c'e tempo

31. `window.confirm` invece di modali shadcn/ui
32. Touch target troppo piccoli su mobile (< 44px)
33. Images con `<img>` invece di `next/image`
34. `useEffect` con dipendenze incomplete (eslint-disable)
35. Mancanza di `Suspense` boundaries
36. Quote PDF in realta genera HTML print, non PDF binario
37. Scripts di seed non idempotenti / distruttivi
38. Mix italiano/inglese nei nomi variabili (`CUGINA_NAME` vs `leoIdentity`)
39. Mancanza CI/CD (GitHub Actions)
40. Bundle size: recharts e @xyflow/react senza code splitting

---

## Migliorie Tecniche ed Estetiche

| Area | Stato | Priorita |
|---|---|---|
| **Design System** | shadcn/ui usato bene, ma componenti pubblici (landing/form) usano stili inline hardcoded | Medium |
| **Responsive** | Mobile OK, ma sidebar chiude male e touch target piccoli | Medium |
| **Dark Mode** | Forzato a light (fix temporaneo) — componenti pubblici hanno logica dark residua | Low |
| **Form UX** | Validazione client debole nei form pubblici; errori non associati ai campi | High |
| **Loading States** | Skeleton assenti in alcune pagine; primo render bloccato | Medium |
| **Drag & Drop** | Kanban OK, ma `ActivityKanbanBoard` senza `DragOverlay` | Low |
| **Accessibility** | Manca `aria-label`, focus management, contrasto dinamico landing | High |

---

## Upgrade Futuri e Semplicita d'Uso

### Upgrade path consigliato

1. **Testabilita (Settimana 1-2)**
   - Aggiungere Vitest.
   - Testare prima i 43 moduli DB (`fromDoc`/`toDoc`, edge cases).
   - Testare executor workflow con grafi finti.

2. **Sicurezza (Settimana 2-3)**
   - Chiudere endpoint aperti.
   - Aggiungere Zod su TUTTE le API.
   - Sostituire rate limiter con Redis.

3. **Robustezza (Settimana 3-4)**
   - Risolvere race condition (unique DB + retry).
   - Scegliere un unico motore per il funnel (codice O builder, non entrambi).
   - Aggiungere idempotenza ai trigger.

4. **Performance (Mese 2)**
   - Paginazione su tutte le `list*`.
   - Code splitting per recharts e xyflow.
   - Indici DB mancanti.

5. **DevEx (Mese 2)**
   - Rimuovere global fetch patch.
   - Refactor `fromDoc` helper condiviso.
   - CI/CD base (typecheck + lint + build).
   - Aggiornare `CLAUDE.md`.

### Semplicita d'uso per nuovi dev

Il progetto e **impressionante ma intimidatorio**. Per un nuovo sviluppatore:
- **Pro:** Build pulito, componenti organizzati per feature, Appwrite semplice da capire.
- **Contro:** 32 script senza documentazione, dual engine (automation + workflow) non spiegato, nessun test da guardare come esempio, env vars sparse.

**Raccomandazione:** Aggiungere `scripts/README.md`, un diagramma architetturale nel README, e almeno 10 test di esempio che mostrino come mockingare Appwrite.

---

## Piano d'Azione Immediate

| Giorno | Azione | Impatto |
|---|---|---|
| 1 | Chiudere endpoint `/workflow/trigger`, `/orchestrator/callback/*`, `/workflow/process-scheduled` con auth obbligatoria | Blocca attacchi esterni |
| 2 | Aggiungere indici unique su `contacts.email`/`phone` + catch errore 409 | Stoppa duplicati |
| 3 | Scegliere motore unico per post-call routing (disattivare l'altro) | Elimina race funnel |
| 4 | Aggiungere `assignedTo` filter in `getOpenCallTaskForLead` | Corregge routing call |
| 5 | Aggiungere idempotenza a `triggerWorkflows` + `await` nelle route | Stoppa azioni duplicate |
| 6 | Rimuovere global fetch patch | Stabilita fetch |
| 7 | Aggiungere `error.tsx` nei layout principali | Resilienza UI |

---

*Report generato con protocollo `/goodcode` — analisi multi-agente con verifica adversaria.*
