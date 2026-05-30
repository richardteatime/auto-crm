# PLAN.md — SarconX Lead Pipeline Automation MVP

## Missione

Configurare il CRM per gestire automaticamente i lead in ingresso da form email, organizzarli in una pipeline commerciale e attivare automazioni operative fino alla generazione automatica del preventivo.

**Questo è un MVP da completare entro 10 giorni.**

L'obiettivo NON è automatizzare tutta SarconX.
L'obiettivo è costruire il primo processo concreto:

```
Form cliente
↓
Email ricevuta dal CRM
↓
Estrazione automatica dati lead
↓
Creazione/aggiornamento contatto
↓
Inserimento in pipeline
↓
Automazioni per fase
↓
Notifica a Leo per chiamata
↓
Aggiornamento post-chiamata
↓
Spostamento pipeline
↓
Generazione automatica preventivo
```

---

## Obiettivo finale

Entro 10 giorni il sistema deve permettere questo flusso:

1. Un cliente compila un form.
2. Il form invia una email al CRM.
3. Il CRM legge l'email.
4. Il CRM estrae nome, cognome, email, telefono, azienda, richiesta e altri campi disponibili.
5. Il CRM crea automaticamente il lead.
6. Il lead entra nella pipeline in fase **prospect**.
7. Il CRM classifica il lead per categoria.
8. Il CRM attiva le automazioni della fase prospect.
9. Leo riceve notifica per chiamare il lead.
10. Dopo la chiamata, Leo aggiorna l'esito.
11. Il CRM sposta il lead nella fase corretta.
12. Quando il lead arriva in **proposal**, il CRM genera automaticamente una bozza di preventivo.

---

## Principio fondamentale

Il CRM deve diventare il centro del processo.
Le automazioni devono partire dai movimenti della pipeline.
Ogni fase della pipeline deve poter attivare azioni automatiche.

```
Pipeline movement = trigger
Trigger = automation
Automation = email / WhatsApp / task / reminder / quote draft
```

---

## Scope di questa fase

Implementare **SOLO** il sistema lead pipeline.

**Non implementare in questa fase:**

- Customer automation completa
- App generation
- Deploy automatico
- Orchestrator completo
- Automazioni clienti avanzate
- Paperclip
- OpenClaw
- Sim complesso
- Hermes Dev Worker per codice

**Questa fase riguarda solo:**

```
Email form → CRM → Pipeline → Automazioni → Leo call → Preventivo automatico
```

---

## Stack

Il CRM (auto-crm) è già il centro operativo — Next.js 16, Appwrite, TypeScript strict.

Componenti da aggiungere/integrare:

| Componente | Descrizione |
|------------|-------------|
| **Email Parser** | Legge email in arrivo e trasforma testo/HTML in dati strutturati |
| **Pipeline Engine** | Gestisce fasi, trigger, automazioni |
| **Automation Adapter** | Livello astratto per email, WhatsApp, task, reminder |
| **Leo Call System** | Gestione notifica chiamata e aggiornamento esito |
| **Quote Generator** | Generatore bozza preventivo automatico |
| **N8N** *(opzionale)* | Workflow engine esterno — predisposto ma non obbligatorio per MVP |

---

## Pipeline commerciale

Creare una pipeline con queste fasi (in ordine):

```
prospect → opportunity → contacted → proposal
```

### prospect

Fase iniziale. Un lead entra qui quando viene ricevuto dal form/email.

Automazioni principali:
- Creare contatto/lead
- Classificare categoria
- Inviare notifica interna
- Creare task per Leo
- Inviare eventuale email di conferma ricezione
- Impostare stato "da chiamare"

### opportunity

Il lead passa qui quando sembra qualificato.

Automazioni principali:
- Arricchire dati lead
- Creare task di approfondimento
- Preparare riepilogo per Leo
- Preparare domande da fare in chiamata
- Impostare priorità

### contacted

Il lead passa qui dopo che Leo ha effettuato la chiamata o registrato un tentativo di contatto.

Automazioni principali:
- Salvare esito chiamata
- Generare riepilogo
- Decidere prossimo step
- Se qualificato → spostare verso `proposal`
- Se non qualificato → marcare come non idoneo o follow-up

### proposal

Il lead passa qui quando è pronto per ricevere un preventivo.

Automazioni principali:
- Generare bozza preventivo
- Generare riepilogo progetto
- Preparare email di invio preventivo
- Notificare founder/admin
- Salvare preventivo nel CRM

---

## Categorie lead

Il sistema deve supportare categorie configurabili.

**Categorie iniziali:**

```
static_website
webapp
crm
automation
other
unknown
```

La categoria può essere dedotta da:
- Oggetto email
- Testo email
- Campi del form
- Parole chiave
- Scelta esplicita nel form
- Classificazione AI (opzionale)

**Esempi:**

| Input | Categoria |
|-------|-----------|
| "mi serve un sito" | `static_website` |
| "mi serve una webapp" | `webapp` |
| "mi serve un gestionale" | `crm` |
| "voglio automatizzare un processo" | `automation` |
| Campo insufficiente | `unknown` |

---

## Form email integration

Il sistema deve ricevere email generate dai form.
I form possono essere diversi — il parser deve adattarsi a campi variabili.

### Input possibili

**Email plain text:**
```
Nome: Marco
Cognome: Rossi
Email: marco@example.com
Telefono: +393331234567
Azienda: Trattoria Rossi
Richiesta: Mi serve un sito per il mio ristorante
```

**Email HTML:**
```html
<p>Nome: Marco</p>
<p>Email: marco@example.com</p>
<p>Telefono: +393331234567</p>
<p>Richiesta: Mi serve un sito</p>
```

**Email con campi personalizzati:**
```
Nome attività: Studio Bianchi
Tipo progetto: CRM
Budget: 3000
Messaggio: Vorrei un gestionale clienti
```

---

## Email parser

Implementare un parser robusto che:

1. Riceve email
2. Legge subject
3. Legge body text
4. Legge body HTML se presente
5. Normalizza il contenuto
6. Estrae campi noti
7. Conserva anche campi custom
8. Classifica categoria lead
9. Crea lead/contact nel CRM

### Campi standard da estrarre

```
firstName       lastName        fullName
email           phone           company
businessName    website         projectType
budget          message         source
formName        rawSubject      rawBody
receivedAt
```

### Campi custom

Ogni campo non riconosciuto deve essere salvato in:

```json
{
  "customFields": {
    "nome_attivita": "...",
    "tipo_locale": "...",
    "budget_indicativo": "..."
  }
}
```

Non buttare via dati.

---

## Deduplicazione lead

Prima di creare un nuovo lead, controllare se esiste già un contatto con:
- Stessa email
- Stesso telefono
- Stesso nome azienda (se disponibile)

**Se esiste:**
- Aggiornare contatto esistente
- Aggiungere nuova activity
- Non duplicare inutilmente
- Creare eventualmente nuovo deal se la richiesta è nuova

---

## Data model

Creare o adattare queste collection in Appwrite.

### leads (estende `contacts`)

```
id                firstName         lastName
fullName          email             phone
company           businessName      website
projectType       category          source
formName          message           rawSubject
rawBody           customFields      status
pipelineStage     assignedTo        leadScore
createdAt         updatedAt
```

### pipeline_stages *(già esistente)*

```
id        name      order
description         enabled
createdAt           updatedAt
```

Valori iniziali: `prospect`, `opportunity`, `contacted`, `proposal`

### pipeline_movements

```
id          leadId          fromStage
toStage     reason          triggeredBy
metadata    createdAt
```

### automation_rules

```
id              name            enabled
triggerType     pipelineStage   leadCategory
conditions      actions
createdAt       updatedAt
```

### automation_runs

```
id              ruleId          leadId
status          actionsExecuted error
createdAt       updatedAt
```

### call_tasks

```
id              leadId          assignedTo
assigneeName    status          scheduledAt
completedAt     callOutcome     notes
createdAt       updatedAt
```

### quotes *(estende collection esistente)*

```
id              leadId          status
category        amountSuggested items
summary         generatedText
createdAt       updatedAt
```

---

## Trigger pipeline

Ogni movimento di pipeline deve poter attivare automazioni.

**Trigger iniziali:**

```
lead_created
stage_changed_to_prospect
stage_changed_to_opportunity
stage_changed_to_contacted
stage_changed_to_proposal
call_task_created
call_completed
quote_requested
quote_generated
```

Ogni trigger deve creare un log in `automation_runs`.

---

## Automazioni per fase

### Quando arriva un lead — `lead_created`

```
- classify_lead_category
- create_or_update_contact
- set_pipeline_stage_prospect
- create_leo_call_task
- notify_internal_team
- send_ack_email_optional
```

### Quando entra in prospect — `stage_changed_to_prospect`

```
- create_call_task_for_leo
- send_internal_email_to_leo
- optionally_send_whatsapp_internal_notification
```

### Quando entra in opportunity — `stage_changed_to_opportunity`

```
- enrich_lead_summary
- prepare_call_questions
- notify_sales
```

### Quando entra in contacted — `stage_changed_to_contacted`

```
- save_call_outcome
- summarize_call_notes
- decide_next_stage_if_possible
```

### Quando entra in proposal — `stage_changed_to_proposal`

```
- generate_quote_draft
- create_quote_record
- notify_founder_admin
- prepare_proposal_email_draft
```

---

## Processo chiamate Leo

Leo deve fare la chiamata manualmente. Il sistema automatizza tutto il contorno.

**Flusso:**

```
Lead entra
↓
CRM crea call_task per Leo
↓
CRM invia notifica/email a Leo
↓
Leo chiama manualmente
↓
Leo aggiorna esito nel CRM
↓
CRM attiva trigger call_completed
↓
CRM decide/sposta lead nella prossima fase
```

### Stati call_task

```
pending       scheduled     completed
failed        no_answer     reschedule
not_interested              qualified
```

### Esiti chiamata

```
qualified         not_qualified     no_answer
call_later        wrong_number      interested
not_interested    needs_quote
```

### Regole post-chiamata

| Outcome | Azione |
|---------|--------|
| `qualified`, `interested`, `needs_quote` | Sposta a `proposal` |
| `no_answer`, `call_later` | Crea follow-up task, lascia in `contacted` o `opportunity` |
| `not_qualified`, `not_interested`, `wrong_number` | Imposta `lead.status = lost` |

---

## Preventivo automatico

Il preventivo viene generato quando il lead entra in `proposal`.

**Per ora: generare una BOZZA — non inviare automaticamente al cliente.**

La bozza deve contenere:
- Nome cliente
- Categoria progetto
- Riepilogo richiesta
- Informazioni raccolte
- Proposta di soluzione
- Elementi inclusi
- Prezzo suggerito (se possibile)
- Note e prossimi step

### Pricing base (placeholder configurabile)

```json
{
  "static_website": { "basePrice": 1200, "label": "Sito statico HTML/PHP admin" },
  "webapp":         { "basePrice": 3500, "label": "Webapp custom" },
  "crm":            { "basePrice": 5000, "label": "CRM custom" },
  "automation":     { "basePrice": 2500, "label": "Automazione processo" }
}
```

Se il budget del cliente è presente, salvarlo e mostrarlo nel preventivo.
**Non inviare preventivo al cliente senza approvazione manuale.**

---

## Automation Adapter

Non hardcodare le automazioni — creare un'astrazione.

```ts
type AutomationEngine = {
  runTrigger(triggerName: string, payload: unknown): Promise<AutomationResult>
}
```

**Implementazioni:**

| Adapter | Stato |
|---------|-------|
| `internal` | Da implementare (MVP) |
| `n8n` | Predisposto, disabilitato |
| `webhook` | Predisposto |

**Env predisposte (non obbligatorie per MVP):**

```env
N8N_WEBHOOK_URL=
N8N_API_KEY=
ENABLE_N8N_AUTOMATIONS=false
```

---

## Email sending

Usare il provider esistente (Resend via `RESEND_API_KEY`) oppure creare adapter generico:

```
EmailAdapter
  sendEmail(to, subject, body)
  sendInternalNotification(to, subject, body)
```

---

## WhatsApp sending

Per MVP: se non configurato, non crashare — loggare e continuare.

```
MessagingAdapter
  sendWhatsAppMessage(to, message)
  sendInternalMessage(to, message)
```

Se adapter non configurato:
```
WhatsApp adapter not configured; skipped message.
```

---

## UI richiesta

### Vista Pipeline (Kanban o lista)

Colonne: `prospect | opportunity | contacted | proposal`

Ogni lead mostra:
- Nome, email, telefono, azienda
- Categoria
- Stato chiamata
- Ultimo aggiornamento

### Lead detail

- Dati estratti da email
- Raw email
- Custom fields
- Pipeline stage
- Automation history
- Call task + call outcome
- Quote draft

### Automation logs

- Trigger attivato
- Azioni eseguite
- Success / failure
- Errore eventuale
- Timestamp

---

## API da implementare

### Email inbound

```
POST /api/leads/email-inbound
```

Riceve payload email normalizzato (o JSON testabile manualmente se non c'è provider).

### Pipeline movement

```
POST /api/leads/[id]/move-stage
```

```json
{ "toStage": "opportunity", "reason": "Lead qualificato" }
```

### Call outcome

```
POST /api/leads/[id]/call-outcome
```

```json
{ "outcome": "qualified", "notes": "Cliente interessato a sito ristorante con admin." }
```

### Quote generation

```
POST /api/leads/[id]/generate-quote
```

---

## Parser email — formati supportati

### Chiave-valore

```
Nome: Marco
Cognome: Rossi
Email: marco@example.com
Telefono: +393331234567
Azienda: Trattoria Rossi
Messaggio: Mi serve un sito per il mio ristorante
```

### HTML semplice

```html
<p>Nome: Marco</p>
<p>Email: marco@example.com</p>
<p>Telefono: +393331234567</p>
<p>Messaggio: Vorrei un CRM</p>
```

### Testo libero

```
Ciao sono Marco Rossi, la mia email è marco@example.com.
Mi serve un sito per il mio ristorante.
Potete chiamarmi al +393331234567.
```

Per testo libero: usare AI extraction se provider disponibile, altrimenti regex/fallback.
Non bloccare mai il flusso se AI non è disponibile.

### Output AI extraction

```json
{
  "firstName": "", "lastName": "", "fullName": "",
  "email": "", "phone": "", "company": "",
  "businessName": "", "projectType": "", "category": "",
  "budget": "", "message": "", "customFields": {}
}
```

---

## Lead scoring

| Condizione | Punti |
|------------|-------|
| Email presente | +20 |
| Telefono presente | +20 |
| Messaggio contiene richiesta chiara | +20 |
| Categoria non `unknown` | +20 |
| Budget presente | +20 |

| Score | Classificazione |
|-------|----------------|
| ≥ 70 | Lead caldo |
| 40–69 | Lead medio |
| < 40 | Lead debole |

---

## Automazioni MVP — minimo da implementare

### 1. New lead

**Trigger:** `lead_created`

```
- classify category
- set stage prospect
- create Leo call task
- log automation run
```

### 2. Prospect

**Trigger:** `stage_changed_to_prospect`

```
- notify Leo by email/internal notification
```

### 3. Call completed

**Trigger:** `call_completed`

```
- save outcome
- if qualified/interested/needs_quote → move to proposal
- if no_answer → create follow-up task
- if not_interested → mark lost
```

### 4. Proposal

**Trigger:** `stage_changed_to_proposal`

```
- generate quote draft
- create quote record
- notify founder/admin
```

---

## Sicurezza — regole obbligatorie

```
- Non loggare secrets o token
- Non cancellare lead
- Non inviare preventivi al cliente senza approvazione manuale
- Non mandare WhatsApp se adapter non configurato
- Non bloccare il flusso se AI provider non disponibile
- Non duplicare lead se email/telefono già esistono
- Tutte le automazioni devono essere loggate
- Ogni movimento pipeline deve essere tracciato
```

---

## Piano 10 giorni

### Giorno 1 — Audit + data model
- Analizzare repo esistente (collection, API, tipi)
- Capire cosa riusare da `contacts`, `deals`, `quotes`, `pipeline_stages`
- Aggiornare `IMPLEMENTATION_LOG.md`
- Definire collection mancanti: `pipeline_movements`, `automation_rules`, `automation_runs`, `call_tasks`
- Aggiungere campi mancanti a `leads/contacts`

### Giorno 2 — Email inbound + parser
- Creare endpoint `POST /api/leads/email-inbound`
- Parser chiave-valore
- Parser HTML base (strip tag)
- Regex email/telefono
- Salvataggio raw email
- Creazione lead con deduplicazione

### Giorno 3 — Pipeline
- Implementare/verificare pipeline stages (prospect, opportunity, contacted, proposal)
- Inserimento automatico lead in prospect
- Movimento manuale tra fasi
- Log `pipeline_movements`

### Giorno 4 — Automation engine interno
- Creare `AutomationEngine` internal
- Implementare trigger `lead_created`
- Implementare trigger `stage_changed_to_*`
- Creare `automation_runs`

### Giorno 5 — Leo call tasks
- Creare `call_tasks`
- Task automatico per Leo quando lead entra in prospect
- Notifica Leo (email interna)
- Endpoint `POST /api/leads/[id]/call-outcome`

### Giorno 6 — Post-call automations
- Trigger `call_completed`
- Spostamento automatico a `proposal` se qualificato
- Follow-up task se `no_answer`
- `lead.status = lost` se `not_interested`

### Giorno 7 — Quote draft generator
- Creare/adattare collection `quotes`
- Generare bozza preventivo da categoria + dati lead
- Pricing base per categoria (placeholder)
- Salvare quote draft

### Giorno 8 — UI pipeline
- Vista pipeline (kanban o lista per fasi)
- Lead detail con email raw, custom fields, automation history, call task, quote draft
- Automation logs
- UI aggiornamento call outcome

### Giorno 9 — N8N adapter placeholder + cleanup
- Creare adapter N8N (disabled)
- Documentare quando usarlo
- Cleanup TypeScript
- Error handling robusto

### Giorno 10 — Test end-to-end + documentazione
- Test completo scenario Marco Rossi (vedi sotto)
- Aggiornare README
- Aggiornare `IMPLEMENTATION_LOG.md`

---

## Test end-to-end finale

**Input email:**

```
Nome: Marco
Cognome: Rossi
Email: marco@example.com
Telefono: +393331234567
Azienda: Trattoria Rossi
Messaggio: Mi serve un sito per il mio ristorante
Budget: 1500
```

**Output atteso:**

```
1.  Lead creato.
2.  Categoria = static_website.
3.  Score calcolato (80/100 — email, telefono, messaggio, categoria, budget).
4.  Pipeline stage = prospect.
5.  Call task per Leo creata.
6.  Automation run loggata.
7.  Leo aggiorna outcome = needs_quote.
8.  Lead passa a proposal.
9.  Quote draft generato (basePrice 1200, budget cliente 1500).
10. Founder/admin notificato.
```

---

## Definition of Done

Il lavoro è completato quando:

- [x] Typecheck passa — TypeScript zero errori bloccanti (`npx tsc --noEmit`; build non eseguita per regola repo)
- [x] Email inbound endpoint funziona
- [x] Parser estrae dati base (chiave-valore + HTML)
- [x] Lead viene creato o aggiornato (deduplicazione attiva)
- [x] Lead entra automaticamente in `prospect`
- [x] Pipeline ha fasi `prospect / opportunity / contacted / proposal`
- [x] Movimento pipeline genera trigger e log in `pipeline_movements`
- [x] `automation_runs` vengono creati per ogni trigger
- [x] Leo call task viene creato automaticamente
- [x] Leo può aggiornare esito chiamata via UI o API
- [x] `call_completed` attiva automazioni
- [x] Lead qualificato passa a `proposal`
- [x] Quote draft viene generato con dati reali
- [x] UI pipeline mostra lead nelle fasi corrette
- [x] Lead detail mostra: dati email, raw email, custom fields, automation history, call task, quote
- [x] N8N adapter predisposto ma non obbligatorio
- [x] Nessun preventivo inviato al cliente senza approvazione
- [x] README aggiornato
- [x] `IMPLEMENTATION_LOG.md` aggiornato

---

## Istruzioni operative per Claude Code

Leggi questo file e seguilo esattamente. Inizia da **Giorno 1 — Audit + data model**.

Dopo ogni fase aggiorna `IMPLEMENTATION_LOG.md`.

Se ci sono ambiguità:
1. Scegli l'opzione più sicura
2. Documentala in `IMPLEMENTATION_LOG.md`
3. Continua

Non implementare customer automation completa.
Non implementare generazione app/deploy.
Concentrarsi solo su:

```
Email form → CRM → Pipeline → Automazioni → Leo call → Preventivo automatico
```
