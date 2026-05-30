# IMPLEMENTATION_LOG.md — SarconX Auto-CRM AI Orchestrator

> Fase attuale: **Phase 0 — Audit repo completato**
> Data: 2026-05-26

---

## Phase 0 — Audit repo (COMPLETATA)

### Stack rilevato

| Componente | Valore |
|------------|--------|
| Framework | Next.js 16.2.2 (App Router) |
| React | 19.2.4 |
| TypeScript | 5.x (strict) |
| Tailwind | v4 |
| UI | shadcn/ui, base-ui, lucide-react |
| Backend | Appwrite self-hosted (node-appwrite 17.0.0) |
| AI | OpenRouter (default) → Anthropic SDK (fallback) |
| Forms | react-hook-form + zod |
| Date | date-fns |
| Charts | recharts |

### Struttura progetto

```text
src/
  app/                    — Next.js App Router
    api/                  — API routes esistenti
    (auth)/               — Login/register
    page.tsx              — Dashboard
    layout.tsx            — Root layout con AppShell
  components/             — Feature-based React components
  lib/
    appwrite.ts           — Client Appwrite + COLLECTIONS
    auth.ts               — HMAC session cookie, requireAuth
    claude.ts             — classifyLead (OpenRouter/Anthropic)
    constants.ts          — Config UI, formatCurrency, formatDate
    query17.ts            — Query wrapper per Appwrite 1.7.4
    db/                   — CRUD per ogni collection
  types/index.ts          — TypeScript types CRM
  types/                  — Types
scripts/
  setup-appwrite.ts       — Setup collection + seed pipeline
  seed.ts                 — Seed dati demo
```

### API routes esistenti (29 endpoint)

```text
/api/auth/*              — login, logout, me, register, session
/api/activities          — GET, POST
/api/activities/[id]     — PUT, DELETE
/api/calendar/events     — GET, POST
/api/calendar/events/[id]— PUT, DELETE
/api/classify            — POST (classifica lead via AI)
/api/contacts            — GET, POST
/api/contacts/[id]       — GET, PUT, DELETE
/api/deals               — GET, POST
/api/deals/[id]          — GET, PUT, DELETE
/api/deals/[id]/quotes   — GET, POST
/api/digest              — POST
/api/expenses            — GET, POST
/api/expenses/[id]       — PUT, DELETE
/api/export              — GET
/api/finance/*           — auth, deals, mrr, summary
/api/followups           — GET
/api/import              — POST
/api/messages            — GET, POST
/api/notifications       — GET, POST
/api/notifications/*     — read-by-related, [id]
/api/opportunities       — GET, POST
/api/opportunities/[id]  — GET, PUT, DELETE + convert
/api/pipeline            — GET, PUT
/api/projects            — GET, POST
/api/projects/[id]       — GET, PUT, DELETE
/api/projects/[id]/logs  — GET, POST
/api/quotes              — GET, POST
/api/quotes/[id]         — GET, PUT, DELETE
/api/quotes/[id]/pdf     — GET
/api/report/summary      — GET
/api/revenues            — GET, POST
/api/revenues/[id]       — PUT, DELETE
/api/uploads             — POST
/api/users               — GET
/api/webhook             — POST (lead da form esterni)
```

### Collection Appwrite esistenti (14)

```text
contacts
pipeline_stages
deals
activities
crm_settings
messages
expenses
quotes
opportunities
projects
project_logs
notifications
revenues
calendar_events
```

### AI provider attuale

- File: `src/lib/claude.ts`
- Supporta OpenRouter (default) e Anthropic SDK (fallback)
- Funzione `classifyLead` per classificazione lead
- Usata da `/api/classify`
- Pattern: buildPrompt → call API → parse JSON response

### Auth esistente

- HMAC-SHA256 signed session cookie (`appwrite-session`)
- `requireAuth` helper per API routes
- Appwrite Admin API per verifica user
- Nessun ruolo/fine-grained permissions (solo autenticato/non)

### Webhook esistente

- `/api/webhook` — riceve lead da Typeform/Tally/form esterni
- Rate limit in-memory (30 req/min per IP)
- Supporta `x-webhook-secret`
- Mappa campi normalizzati (name, email, phone, company, notes)
- **NON è un webhook Chatwoot**

### Pattern UI

- AppShell con sidebar
- shadcn/ui components
- Tailwind v4 (config via CSS, no tailwind.config.ts)
- Lucide React per icone (no emoji)
- Form: react-hook-form + zod
- Date: date-fns, Appwrite salva ISO 8601
- Valori: centesimi (integer), `formatCurrency()` per display

### Env attuali (da CLAUDE.md)

```text
NEXT_PUBLIC_APPWRITE_ENDPOINT
APPWRITE_PROJECT_ID
APPWRITE_API_KEY
APPWRITE_DATABASE_ID
ANTHROPIC_API_KEY (opzionale)
RESEND_API_KEY (opzionale)
DIGEST_EMAIL (opzionale)
DIGEST_FROM (opzionale)
```

### Pattern DB

- Ogni collection ha un file in `src/lib/db/{collection}.ts`
- Helper `fromDoc<T>` per mappare `$id` → `id`, `$createdAt` → `createdAt`
- Helper `toIsoDate` per normalizzare date
- Query via `src/lib/query17` (wrapper Appwrite 1.7.4)
- Denormalizzazione: es. `contactName` salvato in deals/activities
- `COLLECTIONS` object in `src/lib/appwrite.ts`

### Note per l'implementazione

1. **Chatwoot non è ancora integrato** — il webhook esistente è per form esterni.
2. **Nessuna collection orchestrator** — vanno create tutte (chatwoot_messages, orchestrator_runs, workflow_events, agent_tasks, project_artifacts, deployment_results, automation_policies).
3. **Auth esistente è solo session-based** — per WhatsApp/Chatwoot serve permission layer basato su numero telefono (`ADMIN_WHATSAPP_NUMBERS`).
4. **AI esiste già** — possiamo riutilizzare il pattern in `claude.ts` per l'intent classifier.
5. **UI usa App Router** — `/orchestrator/page.tsx` è il path corretto per la dashboard.
6. **Feature flags non esistono** — vanno aggiunti in `.env.local` e in un config object.
7. **Collection `tasks` esiste già nello script setup** ma non è esportata in `COLLECTIONS` né ha CRUD in `src/lib/db/`.

---

---

## Phase 1 — Chatwoot webhook (COMPLETATA)

### File creati

```text
src/lib/chatwoot/types.ts              — Tipi TypeScript per payload Chatwoot
src/lib/chatwoot/verify.ts             — Verifica signature/secret webhook
src/lib/chatwoot/normalize-message.ts  — Normalizza payload in formato interno
src/lib/chatwoot/client.ts             — Client API Chatwoot (send message, get conversation/contact)
src/lib/db/chatwoot-messages.ts        — CRUD collection chatwoot_messages
src/app/api/chatwoot/webhook/route.ts  — Endpoint webhook POST
```

### File modificati

```text
src/lib/appwrite.ts                    — Aggiunto chatwootMessages a COLLECTIONS
src/lib/db/index.ts                    — Esporta chatwoot-messages CRUD
```

### Comportamento webhook

- Riceve eventi `message_created` da Chatwoot
- Ignora messaggi `outgoing` per evitare loop
- Ignora messaggi senza contenuto
- Valida `CHATWOOT_WEBHOOK_SECRET` via HMAC-SHA256 o header secret
- Rate limit: 60 req/min per IP
- Normalizza il payload estraendo: messageId, conversationId, contactId, phone, name, direction, text, type
- Salva su collection `chatwoot_messages` (graceful se collection non esiste ancora)
- Risponde con `{ success, messageId, conversationId, saved }`

### Env da aggiungere (predisposti)

```text
CHATWOOT_URL=
CHATWOOT_ACCOUNT_ID=
CHATWOOT_API_ACCESS_TOKEN=
CHATWOOT_WEBHOOK_SECRET=
```

### Note

- La collection `chatwoot_messages` va ancora creata in Appwrite (Phase 4).
- Il webhook ha un try-catch intorno al DB save: se la collection manca, logga l'errore ma risponde 200 ugualmente.
- L'inoltro all'orchestrator è segnato come TODO per Phase 3.

---

## Phase 2 — Permission layer (COMPLETATA)

### File creati

```text
src/lib/orchestrator/types.ts          — Tipi core: SenderRole, RunStatus, RiskLevel, Intent, WorkflowEventType
src/lib/orchestrator/config.ts         — Feature flags da env (ENABLE_INTERNAL_COMMANDS, etc.)
src/lib/orchestrator/permissions.ts    — Permission layer: resolveSenderRole, checkMessagePermission
src/lib/orchestrator/logger.ts         — logWorkflowEvent (graceful fino a Phase 4)
```

### File modificati

```text
src/app/api/chatwoot/webhook/route.ts  — Aggiunto permission check dopo normalizzazione
```

### Comportamento permission layer

- `ADMIN_WHATSAPP_NUMBERS` env determina chi è `founder_admin`
- Solo `founder_admin` può eseguire comandi interni (Step 1)
- Numeri non in lista → ruolo `customer` → bloccato
- Se bloccato, il CRM risponde su Chatwoot: "Questo canale al momento è riservato ai comandi interni SarconX."
- Ogni blocco crea un log `unauthorized` via `logWorkflowEvent`
- Step 2 (customer automation) è **sempre disabilitato** — `ENABLE_CUSTOMER_AUTOMATION=false`, `CUSTOMER_AUTOMATION_UNLOCKED=false`

### Env da aggiungere

```text
ADMIN_WHATSAPP_NUMBERS=+393331234567,+393331111111
ENABLE_INTERNAL_COMMANDS=true
ENABLE_GITAGENT_DISPATCH=false
ENABLE_AUTODEPLOY_PREVIEW=false
ENABLE_CUSTOMER_AUTOMATION=false
CUSTOMER_AUTOMATION_UNLOCKED=false
```

---

## Phase 3 — Orchestrator core (COMPLETATA)

### File creati

```text
src/lib/orchestrator/intents.ts        — Classificatore intenti (AI + keyword fallback)
src/lib/orchestrator/runs.ts           — Gestione run (create, update, list) — graceful se collection manca
src/lib/orchestrator/router.ts         — Router principale: handleCommand → classify → execute → reply
src/lib/db/orchestrator-runs.ts        — CRUD collection orchestrator_runs
src/app/api/orchestrator/command/route.ts — Endpoint HTTP per comandi (test/direct API)
src/app/api/orchestrator/runs/route.ts    — Endpoint HTTP per listare runs
```

### File modificati

```text
src/lib/appwrite.ts                    — Aggiunto orchestratorRuns a COLLECTIONS
src/lib/db/index.ts                    — Esporta orchestrator-runs CRUD
src/app/api/chatwoot/webhook/route.ts  — Ora inoltra a handleCommand invece di rispondere 200 vuoto
```

### Comportamento orchestrator

1. **Riceve messaggio** dal webhook Chatwoot (o da API diretta)
2. **Crea una run** con status `running`
3. **Classifica intent** usando AI (OpenRouter/Anthropic) o keyword fallback
   - Intenti supportati: project_status_query, revenue_today_query, lead_summary_query, blocked_projects_query, agent_status_query, deployment_status_query, create_project_command, create_deal_command, create_task_command, start_static_site_workflow, generate_app_for_client, unknown
4. **Esegue handler** specifico per intento
   - Query handler → stub (Phase 5 implementerà query reali)
   - Command handler → stub (Phase 6 implementerà comandi reali)
   - Workflow handler → stub (Phase 6/7 implementerà workflow reali)
   - Unknown → risponde con lista comandi disponibili
5. **Aggiorna run** con resultSummary e status (completed/failed)
6. **Invia risposta** su Chatwoot via API
7. **Logga workflow events** per ogni step

### Pattern intent classifier

- Se `OPENROUTER_API_KEY` o `ANTHROPIC_API_KEY` è configurato: usa AI con prompt strutturato
- Se nessuna API key: keyword fallback (regex su parole chiave in italiano)
- Risultato: uno dei 12 intenti definiti in `src/lib/orchestrator/types.ts`

### Note

- Tutti gli handler query/command sono stub che rispondono con "_(implementazione in arrivo — Phase 5/6)_"
- Le collection `orchestrator_runs` e `workflow_events` vanno create in Appwrite (Phase 4)
- Il router è già funzionale end-to-end: riceve messaggio → classifica → risponde

---

## Phase 4 — Appwrite collections (COMPLETATA)

### File modificati

```text
src/lib/appwrite.ts                    — Aggiunte 6 nuove collection a COLLECTIONS + tasks
scripts/setup-appwrite.ts              — Setup script aggiornato con 7 nuove collection + seed policy
```

### Collection create

| Collection | Schema chiave |
|------------|---------------|
| `chatwoot_messages` | chatwootMessageId, conversationId, chatwootContactId, senderPhone, senderName, direction (inbound/outbound/system), messageText, messageType, rawPayload, processed |
| `orchestrator_runs` | source, senderPhone, senderRole, contactId, dealId, projectId, intent, workflow, status, commandText, resultSummary, riskLevel, autodeploy, currentStep, finalUrl, repoUrl, error |
| `workflow_events` | runId, eventType (16 tipi), message, metadata |
| `agent_tasks` | runId, agentName, taskType, status, input, output, error, startedAt, completedAt |
| `project_artifacts` | runId, projectId, artifactType (8 tipi), name, url, content, metadata |
| `deployment_results` | runId, projectId, environment (preview/staging/production), status, url, provider, healthcheckStatus, rollbackAvailable, logs |
| `automation_policies` | name, workflow, enabled, allowedRiskLevels (JSON), requireQA, requireHealthCheck, rollbackOnFail, customerEnabled |

### Index create per collection

- **chatwoot_messages**: conversationId, senderPhone, processed, createdAt
- **orchestrator_runs**: status, senderPhone, intent, createdAt
- **workflow_events**: runId, eventType, createdAt
- **agent_tasks**: runId, status, createdAt
- **project_artifacts**: runId, projectId, artifactType, createdAt
- **deployment_results**: runId, projectId, environment, createdAt
- **automation_policies**: workflow, enabled, createdAt

### Seed

- Default automation policy creata se non esiste:
  - Name: "Internal preview automation"
  - Workflow: `generate_app`
  - enabled=true, requireQA=true, requireHealthCheck=true, rollbackOnFail=true, customerEnabled=false
  - allowedRiskLevels: `["low"]`

### Note

- `tasks` era già nello script setup ma mancava in `COLLECTIONS` — aggiunta.
- Per creare le collection: `npm run setup` (richiede Appwrite running e env configurati).
- Tutte le nuove collection usano gli stessi helper (`str`, `enm`, `bool`, `dt`, `text`) dello script esistente.

---

## Phase 5 — Query read-only (COMPLETATA)

### File creati

```text
src/lib/orchestrator/query-tools.ts      — Query reali su progetti, ricavi, lead, agenti, deploy
```

### File modificati

```text
src/lib/db/index.ts                      — Esporta listRevenues
src/lib/orchestrator/router.ts           — Query handler usano query-tools.ts invece di stub
```

### Query implementate

| Query | Funzione | Fonte dati |
|-------|----------|------------|
| `project_status_query` | `getActiveProjects()` | Collection `projects` (status ≠ consegnato) |
| `blocked_projects_query` | `getBlockedProjects()` | Collection `projects` (status = bloccato) |
| `revenue_today_query` | `getTodayRevenue()` | `revenues` (data = oggi) + `deals` (wonAt = oggi) + pipeline aperta |
| `lead_summary_query` | `getLeadSummary()` | `contacts` (count per temperature e source) |
| `agent_status_query` | `getAgentStatus()` | `orchestrator_runs` (ultime 10 run) |
| `deployment_status_query` | `getDeploymentStatus()` | `deployment_results` (graceful se vuota) |

### Comportamento

- **Progetti attivi**: lista con titolo, descrizione e stato tradotto (Aperto, In lavorazione, ecc.)
- **Progetti bloccati**: lista progetti con status "bloccato"
- **Ricavi oggi**: aggrega incassi da `revenues`, deal vinti da `deals`, pipeline aperta da deal non vinti
- **Lead summary**: totale contatti, suddivisione per temperatura (freddi/tiepidi/caldi), top 5 fonti
- **Agenti**: ultime 10 orchestrator runs con intento e status
- **Deploy**: controlla se esistono record in `deployment_results` (altrimenti "Nessun deployment registrato")

### Regola "Non inventare mai"

- Se una collection è vuota, la query risponde con messaggio trasparente:
  - *"Nessun progetto attivo al momento."*
  - *"Dato non ancora disponibile: non ho trovato ricavi o deal vinti per oggi nel CRM."*
- Se una collection non esiste ancora, risponde graceful senza crashare.

---

## Phase 6 — Command tools (COMPLETATA)

### File creati

```text
src/types/index.ts                     — Aggiunto tipo Task
src/lib/db/tasks.ts                    — CRUD completo collection tasks
src/lib/orchestrator/command-tools.ts  — Implementazione comandi: progetto, deal, task, workflow, app
```

### File modificati

```text
src/lib/db/index.ts                    — Esporta task CRUD (listTasks, getTask, createTask, updateTask, deleteTask)
src/lib/orchestrator/router.ts         — Command/workflow handler usano command-tools.ts invece di stub
```

### Comandi implementati

| Comando | Funzione | Comportamento |
|---------|----------|---------------|
| `create_project_command` | `createProjectFromMessage(text, runId)` | Estrae cliente dal testo, cerca o crea contact, crea progetto con status "aperto", linka contact |
| `create_deal_command` | `createDealFromMessage(text, runId)` | Estrae cliente e importo, cerca/crea contact, trova prima fase pipeline, crea deal (value in centesimi) |
| `create_task_command` | `createTaskFromMessage(text, runId)` | Estrae descrizione, supporta keyword "oggi"/"domani"/"tra N giorni" per scadenza, crea task |
| `start_static_site_workflow` | `startStaticSiteWorkflow(text, runId)` | Crea progetto + logga workflow, setta run status `pending_dispatch` |
| `generate_app_for_client` | `generateAppForClient(text, runId)` | Crea progetto + deal + logga workflow, setta run status `pending_dispatch` |

### Estrazione dati da testo libero

- **Cliente**: regex su `per [Nome]` — es. "Crea progetto per Mario Rossi"
- **Importo**: regex su numeri con `k`, `euro`, `€` — es. "da 5000 euro" → 500000 centesimi
- **Scadenza task**: keyword italiane `oggi`, `domani`, `tra N giorni`
- **Titolo progetto**: testo dopo `per [cliente]` o dopo `-` / `:`

### Regola "Non inventare mai"

- Se non trova il cliente nel testo → risposta guidata con esempio
- Se non trova l'importo nel deal → chiede esplicitamente di specificarlo
- Se il pipeline è vuoto → spiega di configurarlo prima
- Contact non trovato → viene creato automaticamente con source "orchestrator"

### Workflow handlers (Phase 7 prep)

- `startStaticSiteWorkflow` e `generateAppForClient` creano le entità CRM reali
- Poi settano la run in stato `pending_dispatch` / `currentStep: waiting_for_gitagent`
- Il dispacciamento a GitAgent è bloccato da feature flag `ENABLE_GITAGENT_DISPATCH=false`
- Risposta trasparente: "messo in coda per il dispacciamento GitAgent (attualmente disabilitato)"

---

## Phase 7 — GitAgent dispatcher (COMPLETATA)

### File creati

```text
src/lib/orchestrator/types.ts           — Aggiunti tipi AgentTask, ArtifactType, ProjectArtifact, DeploymentResult
src/lib/db/agent-tasks.ts               — CRUD collection agent_tasks
src/lib/db/project-artifacts.ts         — CRUD collection project_artifacts
src/lib/db/deployment-results.ts        — CRUD collection deployment_results
src/lib/orchestrator/dispatchers/gitagent.ts — Dispatcher GitAgent (HTTP POST + tracking)
src/app/api/orchestrator/callback/gitagent/route.ts — Callback GitAgent
src/app/api/orchestrator/callback/deploy/route.ts   — Callback deploy
```

### File modificati

```text
scripts/setup-appwrite.ts               — Aggiunto conversationId a orchestrator_runs
src/lib/db/orchestrator-runs.ts         — Supporta conversationId in CRUD
src/lib/orchestrator/runs.ts            — Supporta conversationId in createRun/updateRun
src/lib/orchestrator/router.ts          — Passa conversationId a createRun
src/lib/db/index.ts                     — Esporta agent-tasks, project-artifacts, deployment-results
src/lib/orchestrator/command-tools.ts   — Chiama dispatcher se ENABLE_GITAGENT_DISPATCH=true
```

### Env aggiunti (predisposti)

```text
GITAGENT_ENDPOINT=
GITAGENT_API_KEY=
GITAGENT_CALLBACK_SECRET=
DEPLOY_CALLBACK_SECRET=
NEXT_PUBLIC_APP_URL=
```

### Comportamento dispatcher

- Se `ENABLE_GITAGENT_DISPATCH=false` (default): run rimane in `pending_dispatch`
- Se `ENABLE_GITAGENT_DISPATCH=true` e env configurati:
  1. Crea `agent_task` con status `running`
  2. Invia POST a `GITAGENT_ENDPOINT` con payload JSON
  3. Aggiorna run a `dispatched`
  4. Logga `gitagent_dispatched`
- Se dispatch fallisce: run va in `failed`, task va in `failed`

### Callback GitAgent (`POST /api/orchestrator/callback/gitagent`)

- Valida `x-gitagent-callback-secret` se configurato
- Accetta: `runId`, `status`, `repoUrl`, `branch`, `qaStatus`, `artifacts`, `deployRequested`
- Aggiorna run con `repoUrl` e status
- Crea `agent_task` con il risultato
- Crea `project_artifacts` per ogni artifact ricevuto
- Se `deployRequested=true`: run va in `waiting_for_data`
- Se `deployRequested=false` e status=completed: run va in `completed`

### Callback Deploy (`POST /api/orchestrator/callback/deploy`)

- Valida `x-deploy-callback-secret` se configurato
- Accetta: `runId`, `projectId`, `status`, `environment`, `url`, `provider`, `healthcheckStatus`
- Crea `deployment_result`
- Aggiorna run con `finalUrl` e status `completed`/`failed`
- Logga `deploy_callback_received` e `final_url_saved`
- Se successo e `conversationId` è presente: invia messaggio Chatwoot con il link

### Note

- Tutti i callback sono graceful: se le collection non esistono, loggano errore ma rispondono 200
- `conversationId` viene salvato nella run per poter rispondere su Chatwoot al completamento
- Il deploy callback è implementato in questa fase perché è il completamento naturale del flusso GitAgent

---

## Phase 9 — UI /orchestrator (COMPLETATA)

### File creati

```text
src/lib/db/workflow-events.ts              — CRUD collection workflow_events (logger ora salva davvero)
src/components/orchestrator/RunStatusBadge.tsx — Badge colorato per ogni RunStatus
src/components/orchestrator/RunsTable.tsx  — Tabella runs con filtri (search, status) e navigazione
src/components/orchestrator/RunDetail.tsx  — Dettaglio run: overview, eventi, agent tasks, artifacts
src/app/orchestrator/page.tsx              — Dashboard lista runs (Server Component)
src/app/orchestrator/[id]/page.tsx         — Pagina dettaglio run (Server Component)
src/app/api/orchestrator/runs/[id]/route.ts           — GET run by id
src/app/api/orchestrator/runs/[id]/events/route.ts    — GET workflow events per run
src/app/api/orchestrator/runs/[id]/tasks/route.ts     — GET agent tasks per run
src/app/api/orchestrator/runs/[id]/artifacts/route.ts — GET project artifacts per run
```

### File modificati

```text
src/components/layout/Sidebar.tsx         — Aggiunto link "Orchestrator" con icona Bot
src/lib/orchestrator/logger.ts            — Ora usa createWorkflowEvent invece di console.log
src/lib/db/index.ts                       — Esporta workflow-events CRUD
```

### Caratteristiche UI

- **Lista runs** (`/orchestrator`): tabella con stato colorato, testo comando, intento, sorgente, data. Filtri per testo libero e status. Click per aprire dettaglio.
- **Dettaglio run** (`/orchestrator/[id]`):
  - **Panoramica**: stato, intento, workflow, sorgente, telefono, ruolo, step corrente, data, URL finale, repo, errore, risultato
  - **Eventi**: lista cronologica di tutti i workflow events con tipo, messaggio, metadata JSON, timestamp
  - **Agent Tasks**: stato, input, output, errori dei task agente
  - **Artifacts**: tipo, nome, link diretto
- **Navigazione**: bottone "Indietro" dal dettaglio alla lista
- **Responsive**: layout adattivo su mobile

### Note

- `logger.ts` ora salva davvero i workflow events su Appwrite (prima era solo console.log)
- Le pagine sono Server Components dove possibile; i componenti interattivi (tabella, filtri) sono Client Components
- Il dettaglio usa `Promise.all` per caricare events/tasks/artifacts in parallelo

---

---

## Phase 11 — README e documentazione (COMPLETATA)

### File creati

```text
.env.example                             — Template variabili d'ambiente con descrizioni
```

### File modificati

```text
README.md                                — Aggiunta sezione AI Orchestrator completa
```

### Cosa e stato documentato

1. **`.env.example`** — Template completo con tutte le variabili:
   - Appwrite (required)
   - Auth SESSION_SECRET (required)
   - AI Provider (OpenRouter + Anthropic fallback, opzionali)
   - Email Digest (Resend, opzionale)
   - Orchestrator Chatwoot/WhatsApp (opzionale)
   - Feature flags (ENABLE_INTERNAL_COMMANDS, ENABLE_GITAGENT_DISPATCH, ecc.)
   - GitAgent e Deploy secrets (opzionali)

2. **`README.md`** — Intera sezione primaria tradotta da spagnolo a italiano. Contiene:
   - Introduzione, avvio rapido, personalizzazione
   - Tutte le funzionalita CRM (dashboard, kanban, contatti, attivita, ecc.)
   - Comandi Claude Code, integrazioni, stack tecnico, deploy
   - Sezione AI Orchestrator completa (setup Chatwoot, comandi, flusso end-to-end, test curl)
   - Tabella variabili d'ambiente estesa con tutte le nuove variabili orchestrator
   - Avviso Step 2 bloccato fino a validazione Gate
   - Sezione inglese mantenuta per pubblico internazionale

### Note

- Il README e ora bilingue italiano/inglese (prima era spagnolo/inglese)
- La sezione AI Orchestrator e in italiano
- Step 2 (customer automation) rimane BLOCCATO — i flag sono documentati ma non attivabili

---

## Validazione Gate 1 — Blockers risolti (2026-05-28)

### Blocker 1: Workflow app e sito statico NON esposti all'AI
**Stato: RISOLTO**
- Aggiunti `generateAppForClient` e `startStaticSiteWorkflow` alle `TOOL_DEFINITIONS` in `src/lib/orchestrator/tools.ts`
- Aggiunti case in `executeTool` che chiamano le funzioni in `src/lib/orchestrator/command-tools.ts`
- Aggiunti a `FINAL_TOOLS` per il ReAct loop

### Blocker 2: Messaggio deploy callback troppo povero
**Stato: RISOLTO**
- `src/app/api/orchestrator/callback/deploy/route.ts` ora recupera progetto e contatto dal DB
- Il messaggio Chatwoot include: Cliente, Tipo, Link, QA status, Deploy status
- Allineato al formato richiesto dal piano (sezione 26)

### Blocker 3: Protezione loop bot insufficiente
**Stato: RISOLTO**
- `src/app/api/chatwoot/webhook/route.ts` ora ignora anche messaggi con sender name che include "bot", "crm" o "automation"
- Protezione aggiuntiva oltre al check `message_type === "outgoing"`

### Gap 4: Fallback unknown senza lista comandi
**Stato: RISOLTO**
- `executeTool` case `reply` ora appende la lista comandi disponibili quando la risposta e generica ("Non ho capito.")

### Test automatici eseguiti
- `npx tsx scripts/test-parsers.ts` — **70/70 pass**
- `npx tsc --noEmit` — **Build pulito, zero errori TypeScript**

### Test end-to-end automatici
**Stato: COMPLETATO**
Creato `scripts/gate1-e2e.ts` che esegue la suite completa senza bisogno di Chatwoot/GitAgent reali (usa mock HTTP interno):

1. ✅ T1 — Non-admin blocked (`checkMessagePermission`)
2. ✅ T2 — Admin query progetti (`executeTool` → `getActiveProjects`)
3. ✅ T3 — Admin query ricavi (`executeTool` → `getTodayRevenue`, skipped se collection mancante)
4. ✅ T4 — Creazione progetto + verifica DB (`createProjectFromMessage`)
5. ✅ T5 — Workflow project creation smoke test
6. ✅ T6 — Generate app con GitAgent mock (`generateAppForClient` → mock dispatch)
7. ✅ T7 — Deploy callback + notifica Chatwoot mock (`createDeploymentResult`, `updateOrchestratorRun`, `sendChatwootMessage`)

**Esecuzione:**
```bash
node --env-file=.env.local --import tsx scripts/gate1-e2e.ts
```

**Risultato ultima run: 7/7 passed.**

### Flusso deploy post-GitAgent
Il piano non richiede un `dispatchers/deploy.ts` separato per Gate 1. Il payload verso GitAgent include `autodeploy: true` e il callback GitAgent include `deployRequested`. Il deploy e gestito esternamente da GitAgent o da un deploy adapter che chiama il CRM al completamento. Il CRM riceve il callback e notifica il founder. Questo flusso e coerente con l'architettura documentata.

---

## Prossima fase: Validazione Gate (end-to-end app generation) / Step 2 — Customer mode (futuro)

---

## Integrazione Hermes Agent — Sostituzione orchestrator interno (2026-05-29)

### Contesto
L'utente ha deciso di abbandonare Gate 2 (customer automation) e sostituire l'orchestrator interno ReAct con Hermes Agent (Nous Research) per l'interazione founder-only in linguaggio naturale via Telegram/Chatwoot.

### Architettura
- **Chatwoot** rimane il messaging gateway (Telegram → Chatwoot → CRM Webhook → Hermes)
- **Hermes Agent** sostituisce `handleCommand` / `tools.ts` / `router.ts`
- **GitAgent** resta invariato (dispatcher build/deploy)
- Il CRM espone 10 tool MCP via `mcp-server/crm-server.ts`

### File modificati / creati

| File | Azione | Note |
|------|--------|------|
| `src/app/api/chatwoot/webhook/route.ts` | Modificato | Sostituito `handleCommand` con `callHermes`; aggiunta mappa sessioni in-memory |
| `src/lib/hermes/client.ts` | Creato | Wrapper Node.js per `hermes chat -q`; path resolution cross-platform; fallback su resume failure |
| `scripts/mcp-crm-launcher.cmd` | Creato | Launcher Windows che carica `.env.local` prima di avviare il server MCP |
| `mcp-server/crm-server.ts` | Spostato (da `mcp/`) | Rinominato per evitare conflitto con pacchetto Python `mcp` |
| `scripts/test-hermes-webhook-e2e.ts` | Creato | Test E2E multi-turn: webhook → Hermes → tool MCP → Chatwoot mock |

### Bug risolti

1. **MCP server non raggiungibile da Hermes**
   - Root cause: il pacchetto Python `mcp` non era installato nella venv di Hermes
   - Fix: `uv pip install --python <hermes-venv> mcp`

2. **Conflitto nome directory `mcp/`**
   - Root cause: la directory `mcp/` nel progetto sovrascriveva il namespace package Python `mcp` quando Hermes avviava il server dal CWD del progetto
   - Fix: rinominata `mcp/` → `mcp-server/`

3. **Launcher `.cmd` non eseguibile direttamente da Hermes**
   - Root cause: Hermes usa `subprocess.Popen` senza shell; Windows non esegue `.cmd` direttamente
   - Fix: config Hermes cambiata in `command: cmd` + `args: ["/c", "...launcher.cmd"]`

4. **`score: 0` causava errore Appwrite "Unknown attribute"**
   - Root cause: la collection `contacts` non ha l'attributo `score`
   - Fix: rimosso `score` dal payload `crm_create_contact`

5. **`createdAt`/`updatedAt` mancanti**
   - Fix: re-aggiunti i timestamp al payload di creazione contatto

### Limiti noti

- **Memoria multi-turn limitata**: `hermes chat -q` non supporta `--resume` in modo affidabile. Ogni messaggio è tecnicamente una nuova sessione. Il webhook tenta il resume ma fa graceful fallback a fresh session. Per conversazioni multi-turn il founder deve fornire tutto il contesto in un singolo messaggio, oppure Hermes deve essere avviato in modalità persistente (non `-q`).

### Test risultati

- `npx tsc --noEmit` — zero errori
- `scripts/test-hermes-webhook-e2e.ts` — webhook riceve messaggio, Hermes crea contatto in Appwrite, risponde via Chatwoot mock
- `hermes mcp test auto-crm` — 10 tool MCP discoverati e funzionanti

### Comandi utili

```bash
# Test diretto Hermes + CRM
hermes chat -q "Crea un contatto di test chiamato X" -Q

# Test MCP connection
PYTHONIOENCODING=utf-8 hermes mcp test auto-crm

# E2E webhook test
npx tsx scripts/test-hermes-webhook-e2e.ts
```
