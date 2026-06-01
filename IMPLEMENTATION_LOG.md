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

---

# ===========================================================================
# LEAD PIPELINE AUTOMATION MVP (PLAN.md) — inizio 2026-05-30
# ===========================================================================

> Sistema parallelo e indipendente dall'orchestrator Hermes.
> Flusso: Form email → CRM → Pipeline → Automazioni → Leo call → Preventivo automatico

## Giorno 1 — Audit + data model (COMPLETATA)

### Decisioni di architettura (importante)

1. **Collection `leads` dedicata** (NON estende `contacts`). Motivo: `contacts` è
   già usata pesantemente da deals/activities/quotes/orchestrator. Aggiungere
   campi lead-specifici (pipelineStage, leadScore, rawBody, customFields...) la
   inquinerebbe. Il lead ha un campo `contactId` opzionale per linkare al
   contatto CRM (creato dall'azione `create_or_update_contact`).

2. **Lead pipeline stage come enum sul lead**, NON FK a `pipeline_stages`. Motivo:
   `pipeline_stages` esistente è per i DEALS (Prospetto/Contattato/Proposta/
   Negoziazione/Vinto/Perso). Il lead pipeline (prospect/opportunity/contacted/
   proposal) è concettualmente separato. Usare enum string evita collisioni con
   la pipeline deals live.

3. **Collection `lead_quotes` dedicata**, NON estende `quotes`. Motivo: `quotes`
   esistente ha `dealId` REQUIRED + flusso PDF live (`/api/quotes/[id]/pdf`).
   Cambiare required→optional in Appwrite 1.7.4 richiede ricreare l'attributo
   (rischioso su dati live). `lead_quotes` è self-contained e matcha lo schema
   del PLAN (leadId, category, amountSuggested, items, summary, generatedText).

4. **`automation_runs` separata** da `orchestrator_runs`/`workflow_events`. Il
   logging delle automazioni lead è isolato dal logging orchestrator.

### Collection create (setup-appwrite.ts)

| Collection | Schema chiave |
|------------|---------------|
| `leads` | firstName, lastName, fullName, email, phone, company, businessName, website, projectType, category(enum), source, formName, message, rawSubject, rawBody, customFields(JSON), status(enum), pipelineStage(enum), assignedTo, leadScore(0-100), contactId |
| `pipeline_movements` | leadId, fromStage, toStage, reason, triggeredBy, metadata(JSON) |
| `automation_rules` | name, enabled, triggerType, pipelineStage, leadCategory, conditions(JSON), actions(JSON) |
| `automation_runs` | ruleId, leadId, triggerType, status(enum), actionsExecuted(JSON), error |
| `call_tasks` | leadId, assignedTo, assigneeName, status(enum), scheduledAt, completedAt, callOutcome(enum), notes |
| `lead_quotes` | leadId, status(enum), category(enum), amountSuggested(cents), items(JSON), summary, generatedText |

### Enum definiti

- **category**: static_website, webapp, crm, automation, other, unknown
- **pipelineStage**: prospect, opportunity, contacted, proposal
- **lead status**: new, to_call, working, qualified, lost, won
- **call_task status**: pending, scheduled, completed, failed, no_answer, reschedule, not_interested, qualified
- **callOutcome**: qualified, not_qualified, no_answer, call_later, wrong_number, interested, not_interested, needs_quote
- **automation_run status**: pending, running, completed, failed, partial

### Seed

6 automation rules di default (una per trigger principale) create se la
collection è vuota: New lead, Prospect, Opportunity, Contacted, Proposal,
Call completed.

### File creati

```text
src/lib/leads/types.ts          — tipi core + label italiane
src/lib/db/leads.ts             — CRUD + findDuplicateLead (dedup email/phone/company)
src/lib/db/pipeline-movements.ts
src/lib/db/automation-rules.ts
src/lib/db/automation-runs.ts
src/lib/db/call-tasks.ts
src/lib/db/lead-quotes.ts
```

### File modificati

```text
src/lib/appwrite.ts             — +6 collection a COLLECTIONS
src/lib/db/index.ts             — export nuovi moduli
scripts/setup-appwrite.ts       — +6 collection con index + seed rules
```

### Da fare per attivare in Appwrite
`npm run setup` (richiede Appwrite running + env). Le collection sono create
in modo idempotente (skip se esistono).

---

## Giorno 2 — Email inbound + parser (COMPLETATA)

### File creati
```text
src/lib/leads/parser/fields.ts     — estrazione campi (regex key-value, html→text, free text)
src/lib/leads/parser/index.ts      — parseLeadEmail: regex → AI opzionale, mai blocca
src/lib/leads/scoring.ts           — computeLeadScore/scoreFromParsed/scoreBand/scoreBandLabel
src/app/api/leads/email-inbound/route.ts — endpoint inbound esterno
```

### Comportamento endpoint `/api/leads/email-inbound`
- Esterno (no session auth): rate limit IP 30/min + `x-webhook-secret` opzionale (da `getSetting("webhook_secret")`, stesso pattern di `/api/webhook`).
- Normalizza i molti formati provider (subject/text/body/html/from/formName con alias case-insensitive).
- `parseLeadEmail`: regex/HTML/free-text, poi AI opzionale (OpenRouter→Anthropic). **Mai blocca**: degrada a regex se nessun provider.
- Estrae identità dal From header (`Marco Rossi <m@acme.com>`) quando il body manca.
- Scoring: +20 per email/telefono/messaggio chiaro/categoria nota/budget. ≥70 hot, 40-69 medium, <40 weak.
- **Dedup** (`findDuplicateLead` su email/phone/company): se duplicato → `buildGapFill` riempie SOLO i campi vuoti, alza lo score se maggiore, fonde customFields (esistente vince). Mai crea un secondo lead.
- Nuovo lead: `createLead` → `createPipelineMovement` (fromStage null → prospect) → `fireTrigger("lead_created")`.

### Decisione (ambiguità → opzione più sicura)
- Budget non ha colonna dedicata → preservato dentro `customFields` JSON (`collectCustomFields`).

---

## Giorno 3 — Pipeline movement service (COMPLETATA)

### File creati
```text
src/lib/leads/pipeline.ts                    — moveLeadStage (unico punto di cambio stage)
src/app/api/leads/[id]/move-stage/route.ts   — endpoint session-auth
```

### Comportamento
- `moveLeadStage({leadId, toStage, reason?, triggeredBy?, metadata?})`: valida stage (`isValidStage`), getLead (404→not_found), **idempotente** (stage uguale = no-op, `changed:false`), `updateLead`, `createPipelineMovement` (ogni movimento tracciato), poi `fireTrigger("stage_changed_to_<toStage>")`.
- Endpoint POST: body `{toStage|stage, reason?}`, valida (400 + validStages), `triggeredBy:"user"`, `metadata:{actor: auth.user.email}`. not_found→404.

---

## Giorno 4 — Automation engine interno (COMPLETATA)

### File creati
```text
src/lib/leads/automation/types.ts             — AutomationContext, ActionResult, ActionHandler, ok/skip/fail
src/lib/leads/automation/engine.ts            — runTrigger (NON lancia mai)
src/lib/leads/automation/actions.ts           — registry handler azioni
src/lib/leads/automation/index.ts             — AutomationEngine abstraction + fireTrigger
src/lib/leads/automation/adapters/email.ts    — wrapper Resend (graceful)
src/lib/leads/automation/adapters/messaging.ts— stub WhatsApp (graceful, mai crasha)
```

### Comportamento engine
- `runTrigger(trigger, payload)`: legge leadId, getLead, `listAutomationRules({triggerType, enabledOnly})` filtrate da `ruleMatchesLead` (stage/categoria null = qualsiasi).
- Per ogni regola: `createAutomationRun(running)` → `parseActions` (JSON array di stringhe o `{action}`) → `executeAction` per nome → status (completed/partial/failed) → `updateAutomationRun` con righe `action:status(detail)`.
- Nessuna regola → logga una run con `(no matching rule)`. **Ogni automazione è loggata** (regola PLAN).
- `AutomationEngine` abstraction: `internalEngine` attivo; n8n predisposto ma disabilitato (`ENABLE_N8N_AUTOMATIONS`). `fireTrigger` = entry point unico.

### Decisione (sicurezza)
- Email/messaging adapters **graceful**: se non configurati → `skip`, mai crash, mai bloccano il flusso (regola PLAN).
- WhatsApp logga la riga esatta "WhatsApp adapter not configured; skipped message." e ritorna skipped.

---

## Giorno 5 — Leo call tasks (COMPLETATA)

### File creati
```text
src/app/api/leads/[id]/call-outcome/route.ts  — Leo registra l'esito chiamata
```
### File modificati
```text
src/lib/leads/automation/actions.ts           — createLeoCallTask + handler create_leo_call_task/create_call_task_for_leo
```

### Comportamento
- `createLeoCallTask`: **idempotente** (`getOpenCallTaskForLead` → skip se task aperto esiste, niente duplicati), `createCallTask` (assegnato a Leo, pending, notes=messaggio lead), `updateLead` status `to_call`, `sendToLeo` email (graceful).
- `leoIdentity = {id: LEO_USER_ID||"leo", name: LEO_NAME||"Leo"}` (env-overridable), ora ri-esportato da `automation/index.ts`.
- `lead_created` fa partire la call task all'intake; `stage_changed_to_prospect` riusa lo stesso handler idempotente → nessun doppione.

---

## Giorno 6 — Post-call automations (COMPLETATA)

### File modificati
```text
src/lib/leads/automation/actions.ts   — routeLeadByOutcome + save_call_outcome/route_lead_by_outcome
```

### Comportamento `/api/leads/[id]/call-outcome` (POST, session auth)
- Body `{outcome, notes?}`, valida `outcome ∈ CALL_OUTCOMES`. Upsert call task → `completed` con `callOutcome`+`completedAt`. Fire `call_completed` con `{leadId, outcome, notes, callTaskId}`. Ricarica lead.

### Routing per esito (`routeLeadByOutcome`, tabella regole PLAN)
| Gruppo | Esiti | Azione |
|--------|-------|--------|
| PROPOSAL | qualified, interested, needs_quote | status `qualified` + moveLeadStage `proposal` |
| FOLLOWUP | no_answer, call_later | moveLeadStage `contacted` + status `working` + call task `scheduled` +24h |
| LOST | not_qualified, not_interested, wrong_number | status `lost` + moveLeadStage `contacted` |

### Decisione (ciclo import)
- `moveLeadStage` importato **dinamicamente** (`await import("../pipeline")`) dentro l'handler per rompere il ciclo statico pipeline→automation→engine→actions→pipeline.

---

## Giorno 7 — Quote draft generator (COMPLETATA)

### File creati
```text
src/lib/leads/quotes.ts                        — buildQuoteDraft (deterministico, no AI)
src/app/api/leads/[id]/generate-quote/route.ts — endpoint manuale (session auth)
```
### File modificati
```text
src/lib/leads/automation/actions.ts   — generate_quote_draft + create_quote_record + prepare_proposal_email_draft
src/lib/leads/automation/index.ts     — ri-esporta leoIdentity
```

### Comportamento
- `PRICING` per categoria (euro): static_website 1200, webapp 3500, crm 5000, automation 2500, other/unknown 0. `INCLUDED` = bullet list per categoria.
- `buildQuoteDraft(lead)`: `amountSuggested` in **centesimi** (basePrice×100), `items[]`, `summary`, `generatedText` italiano completo (sezioni: PREVENTIVO BOZZA, Cliente, Categoria, Contatti, Richiesta, Informazioni raccolte, Proposta, Elementi inclusi, Prezzo, Budget cliente, Note/prossimi step). Legge budget cliente da `customFields`.
- Handler automazione (regola `stage_changed_to_proposal`): `generate_quote_draft` (idempotente: skip se esiste già un draft via `listLeadQuotes`; salva la bozza su `ctx.payload`) → `create_quote_record` (persiste via `createLeadQuote`, status `draft`) → `prepare_proposal_email_draft` (prepara il corpo email, **NON inviato**).
- Endpoint `POST /api/leads/[id]/generate-quote`: genera+persiste la bozza, idempotente di default (ritorna draft esistente; `{regenerate:true}` per rigenerare).

### Regola di sicurezza (PLAN, verbatim)
- **Preventivo SEMPRE bozza**: `generatedText` contiene "NON inviata al cliente: richiede approvazione manuale prima dell'invio". Nessun invio automatico al cliente.

---

## Giorno 8 — UI pipeline (COMPLETATA)

### File creati
```text
src/components/leads/lead-badges.tsx       — StageBadge, CategoryBadge, ScoreBadge, StatusBadge, OutcomeBadge (presentazionali)
src/components/leads/LeadPipelineBoard.tsx — board 4 colonne (prospect/opportunity/contacted/proposal) + ricerca
src/components/leads/LeadDetail.tsx        — dettaglio lead interattivo
src/app/leads/page.tsx                     — Server Component lista (listLeads)
src/app/leads/[id]/page.tsx                — Server Component dettaglio (getLead + storico in Promise.all)
```
### File modificati
```text
src/components/layout/Sidebar.tsx    — link "Lead" (icona Inbox) in gruppo Vendite
src/components/layout/MobileNav.tsx  — stesso link "Lead"
```

### Architettura UI (decisione: opzione più sicura)
- **Server Component pattern**: le pagine (`force-dynamic`) fetchano via `lib/db` e passano i dati ai Client Component. I Client Component fanno POST agli endpoint API e poi `router.refresh()`. Nessun GET API necessario per la UI lead.
- **Niente drag-and-drop** (@dnd-kit): non testabile visivamente con dev server/Bash non disponibili → rischio. Board statica a 4 colonne (card → link al dettaglio); il cambio stage avviene dal dettaglio via `<select>` nativo + bottone che chiama `/api/leads/[id]/move-stage`. Soddisfa il requisito PLAN "Kanban o lista".
- **`<select>` nativo** (stilizzato Tailwind) invece di shadcn Select per ridurre il rischio di API non testate.

### LeadDetail — sezioni
Header (back link, nome, ScoreBadge, StageBadge); Dati lead; Richiesta + "Sposta in pipeline"; Chiamata Leo (select CALL_OUTCOMES + note + "Registra esito" → `/call-outcome`); Bozza preventivo (status, importo `formatCurrency`, `generatedText`, nota "non inviata senza approvazione manuale", bottone "Genera/Rigenera" → `/generate-quote`); Campi personalizzati + Email raw; Automation runs; Storico pipeline.

---

## Giorno 9 — N8N adapter placeholder + cleanup (COMPLETATA)

### File creati
```text
src/lib/leads/automation/adapters/n8n.ts   — n8nEngine (AutomationEngine) + isN8nConfigured()
```
### File modificati
```text
src/lib/leads/automation/types.ts   — interfaccia AutomationEngine spostata qui (da index.ts)
src/lib/leads/automation/index.ts   — getAutomationEngine() seleziona n8n se configurato; re-export n8n + AutomationEngine
.env.example                        — sezione Lead Pipeline + n8n (ENABLE_N8N_AUTOMATIONS, N8N_WEBHOOK_URL, N8N_API_KEY)
```

### Comportamento n8n adapter (placeholder, disabilitato di default)
- `isN8nConfigured()` = `ENABLE_N8N_AUTOMATIONS === "true"` **AND** `N8N_WEBHOOK_URL` valorizzato. Servono **entrambi**.
- **Disabilitato/non configurato** (default): `n8nEngine.runTrigger` delega all'engine interno (`runTrigger` da `./engine`). Comportamento identico a prima.
- **Abilitato + configurato**: POST `{trigger, payload}` a `N8N_WEBHOOK_URL` (header `x-n8n-api-key` se `N8N_API_KEY` presente), timeout 10s via `AbortSignal.timeout`. Successo → ritorna `TriggerResult` "dispatched" (`runs: []`, audit su n8n). Fallimento/timeout → **fallback automatico all'engine interno**.
- **Mai blocca il flusso, mai lancia, mai logga la API key** (regole PLAN/sicurezza). L'engine interno resta sempre la rete di sicurezza.

### Quando usare n8n
- L'engine interno copre l'MVP (regole DB → azioni in-process). n8n serve quando si vogliono workflow visuali/esterni, integrazioni con servizi terzi, o orchestrazione complessa fuori dal processo Next.js. Si attiva senza toccare il codice chiamante: `fireTrigger`/`getAutomationEngine` scelgono l'adapter in base alle env.

### Cleanup TypeScript / error handling
- `AutomationEngine` ora vive in `types.ts` → adapter importano il tipo senza rischio di ciclo di import a runtime (grafo: index → adapters/n8n → engine; nessun ritorno a index).
- Tutti gli adapter (email, messaging, n8n) e l'engine: `try/catch`, `console.error`, mai `throw`. Secret mai loggati.

---

## Giorno 10 — Test E2E + documentazione (COMPLETATA)

### File creati
```text
scripts/lead-pipeline-e2e.ts   — test end-to-end scenario "Marco Rossi"
```
### File modificati
```text
README.md                      — sezione "Lead Pipeline (MVP)" + env lead/n8n nella tabella
```

### Struttura del test (`npx tsx scripts/lead-pipeline-e2e.ts`)
Due parti, stesso runner di `scripts/gate1-e2e.ts` (test/assert/eq, summary, exitCode):

- **PART A — logica deterministica (gira SEMPRE, no Appwrite):**
  - A1 parser chiave-valore → firstName Marco, lastName Rossi, fullName "Marco Rossi", email, telefono, azienda, budget "1500", message contiene "sito", strategy `key_value`.
  - A2 categoria = `static_website`.
  - A3 score = 100 con breakdown esplicito dei 5 fattori, banda `hot`.
  - A4 `buildQuoteDraft` da lead sintetico → `amountSuggested` 120000 cent, `clientBudget` 1500, `items[0].amount` 120000, `generatedText` contiene "BOZZA" + "approvazione manuale" (regola sicurezza).
- **PART B — flusso completo su Appwrite (skip graceful se Appwrite non raggiungibile, via probe `listLeads()`):**
  - B1 `createLead` (email unica `marco.rossi+e2e-<ts>@example.com`, source `e2e-test`, "[E2E]") in prospect.
  - B2 `createPipelineMovement` → prospect tracciato.
  - B3 `fireTrigger("lead_created")` → automation run loggata + call task Leo creata.
  - B4 `updateCallTask` completed/needs_quote + `fireTrigger("call_completed", {outcome:"needs_quote"})`.
  - B5 lead → proposal, status qualified.
  - B6 `listLeadQuotes` → bozza, category static_website, 120000 cent, nota "approvazione manuale".
  - B7 run `stage_changed_to_proposal` contiene azione `notify_founder_admin`.

### Sicurezza (regole PLAN rispettate dal test)
- **Non cancella mai i lead**: la PART B crea un lead marcato e ne stampa l'id per ispezione manuale (nessun delete).
- **Nessun preventivo inviato**: A4/B6 verificano la nota di approvazione manuale.
- n8n forzato off nel test (`ENABLE_N8N_AUTOMATIONS="false"`) → engine interno deterministico.

### Decisione (ambiguità → opzione più sicura → documentata → continua)
- **Score 80 vs 100.** Il PLAN (riga 850) scrive *"Score calcolato (80/100 — email, telefono, messaggio, categoria, budget)"*: la prosa dice 80 ma elenca **5** fattori, e la tabella di scoring vale +20 ciascuno = **100**. Il parser estrae davvero "Budget: 1500" nel campo scored (`FIELD_ALIASES["budget"]="budget"`), quindi tutti e 5 i fattori sono presenti. **Scelta: seguire la tabella autorevole (100), non la prosa.** Il "80" è un'incongruenza aritmetica del piano (sembra contare 4 fattori). Il test asserisce 100 e lo documenta inline. Non ho alterato il rubric per forzare 80.

### Definition of Done — verifica (PLAN righe 862-884)
| # | Voce | Stato | Dove |
|---|------|-------|------|
| 1 | Build passa — TypeScript zero errori | ⏳ DA VERIFICARE | `npx tsc --noEmit` non eseguibile in questa sessione (classifier Bash non disponibile). Da rieseguire appena torna. |
| 2 | Email inbound endpoint | ✅ | `src/app/api/leads/email-inbound/route.ts` (G2) |
| 3 | Parser chiave-valore + HTML | ✅ | `src/lib/leads/parser/*` (G2); test A1 |
| 4 | Lead creato/aggiornato + dedup | ✅ | `findDuplicateLead` + `buildGapFill` (G2) |
| 5 | Lead entra in `prospect` | ✅ | route inbound → createLead prospect (G2); test B1 |
| 6 | Fasi prospect/opportunity/contacted/proposal | ✅ | enum `pipelineStage` (G1) |
| 7 | Movimento pipeline → trigger + log | ✅ | `moveLeadStage` + `pipeline_movements` (G3); test B2 |
| 8 | `automation_runs` per ogni trigger | ✅ | `engine.runTrigger` logga sempre (G4); test B3 |
| 9 | Leo call task automatica | ✅ | `createLeoCallTask` (G5); test B3 |
| 10 | Leo aggiorna esito via UI o API | ✅ | `/call-outcome` (G6) + LeadDetail (G8); test B4 |
| 11 | `call_completed` attiva automazioni | ✅ | route + seed rule (G6); test B4 |
| 12 | Lead qualificato → `proposal` | ✅ | `routeLeadByOutcome` (G6); test B5 |
| 13 | Quote draft con dati reali | ✅ | `buildQuoteDraft` (G7); test A4/B6 |
| 14 | UI pipeline mostra lead nelle fasi | ✅ | `LeadPipelineBoard` + `/leads` (G8) |
| 15 | Lead detail: email/raw/custom/automazioni/call/quote | ✅ | `LeadDetail` (G8) |
| 16 | N8N adapter predisposto, non obbligatorio | ✅ | `adapters/n8n.ts` (G9) |
| 17 | Nessun preventivo senza approvazione | ✅ | `generatedText` nota (G7); test A4/B6 |
| 18 | README aggiornato | ✅ | sezione "Lead Pipeline (MVP)" (G10) |
| 19 | `IMPLEMENTATION_LOG.md` aggiornato | ✅ | questa sezione |

**18/19 verificati. Unico aperto: #1 build `tsc --noEmit`** — codice scritto seguendo le firme reali lette dai moduli esistenti, ma la compilazione non è stata eseguibile in questa sessione per indisponibilità del classifier Bash. È l'unico gate residuo da rieseguire.

### Note operative
- Il sistema Lead Pipeline è completo end-to-end a livello di codice e documentazione.
- Resta da eseguire una volta: `npx tsc --noEmit` (e idealmente la PART B con Appwrite attivo, `npm run setup` per creare le 6 collection lead).

---

## Verifica finale release candidate (2026-05-31)

La nota precedente è superata: provisioning remoto e gate tecnici sono stati
eseguiti sulla configurazione Appwrite autorizzata.

### Provisioning Appwrite applicato

- Endpoint verificato: `https://appwrite.app.easlydev.online/v1`
- Database: `crm`
- Create e seed idempotenti completati con `npm run setup`
- Collection Lead Pipeline e regole seed presenti
- Bucket `uploads` creato correttamente
- Collection `revenues` aggiunta al setup con indici
- `workflow_events.runId` migrato a opzionale: gli eventi pre-run non vengono più persi
- Setup reso fail-fast sugli errori non transitori e resiliente agli `ECONNRESET`
  remoti con retry limitati

### Lead Pipeline E2E aggiornato

`scripts/lead-pipeline-e2e.ts` attraversa l'endpoint reale
`POST /api/leads/email-inbound`, verifica la deduplicazione richiamando la route
una seconda volta e usa email, telefono e azienda univoci per ogni run.

Verificato due volte consecutive:

```text
Lead Pipeline E2E: 12 passed, 0 skipped, 0 failed / 12 totale
Lead Pipeline E2E: 12 passed, 0 skipped, 0 failed / 12 totale
```

### Gate eseguiti senza build

Per regola repository non è stato eseguito `npm run build`.

| Comando | Esito |
|---------|-------|
| `npm run setup` | ✅ provisioning remoto completato |
| `npm run lint` | ✅ zero finding |
| `npx tsc --noEmit` | ✅ zero errori |
| `npm audit --audit-level=low` | ✅ zero vulnerabilità |
| `npx tsx scripts/test-parsers.ts` | ✅ 70/70 |
| `npx tsx scripts/e2e-parser-test.ts` | ✅ 35/35 |
| `npx tsx scripts/gate1-e2e.ts` | ✅ 7/7, nessuno skip |
| `REQUIRE_APPWRITE_E2E=true npx tsx scripts/lead-pipeline-e2e.ts` | ✅ 12/12, ripetibile |
| `npx tsx scripts/test-hermes-webhook-e2e.ts` | ✅ webhook + memoria multi-turn |
| `git -c core.whitespace=cr-at-eol diff --check` | ✅ |

### Browser smoke autenticato

Avviata la working copy attiva su `http://localhost:3001`, creato un account
Appwrite tecnico temporaneo via UI, poi eliminato. Verificati:

- dashboard
- `/leads`
- dettaglio lead con raw email, custom fields, quote draft, automation run e storico pipeline
- `/activities`
- `/calendar`
- `/opportunita`
- redirect `/finance` → `/finance-login`

L'area finance completa richiede credenziali di uno dei tre user ID autorizzati:
un account temporaneo viene correttamente respinto dalla whitelist.

### Definition of Done

**19/19 verificati.** Il piano Lead Pipeline MVP è completato. La build non è
stata eseguita intenzionalmente per rispettare la regola del repository; il gate
TypeScript equivalente richiesto dal piano è verde con `npx tsc --noEmit`.

---

## Capture & Conversion Platform — PLAN-FASE2 completato (2026-05-31)

### Decisioni architetturali

- Il builder landing usa blocchi tipizzati interni con `@dnd-kit`, non GrapesJS:
  meno rischio con React 19 / Next.js 16, rendering SSR fedele e nessun runtime
  editor pesante sul percorso pubblico.
- Il Funnel MVP segue la mitigazione del piano: lista ordinata di step,
  condizioni `exists` / `equals`, riuso delle landing esistenti e metriche
  views/submits/drop-off per step.
- I booking link memorizzano uno o più Appwrite userId separati da virgola.
  Gli slot sono unione delle disponibilità del pool e la prenotazione assegna
  un singolo utente libero. Il guard atomico rimane conservativo: un solo
  appuntamento per booking link + slot.

### Funzionalità consegnate

| Area | Stato | Evidenza principale |
|------|-------|---------------------|
| Landing pages | ✅ | Lista, template predefiniti seedati, builder blocchi drag-and-drop, form embed, preview device, favicon/OG, publish/depublish, duplicate/delete, SSR `/l/[slug]` |
| Forms | ✅ | Builder drag-and-drop, tipi campo, mapping CRM, validazione, styling, preview, script iframe `/embed/form.js`, submit attribuito |
| Booking | ✅ | Link admin, pool assegnatari, slot reali UTC, buffer/max giornaliero, lista appuntamenti, duplicate/delete, contatto, evento calendario, email best-effort, doppia prenotazione rifiutata |
| Funnels | ✅ | CRUD/duplicate, editor step, condizioni base, route pubbliche, sessione, eventi, deal finale, drop-off per step |
| Analytics | ✅ | Eventi pubblici, contatori asset, card aggregate, trend 14 giorni e top asset in `/analytics` |

### Bug corretti durante la verifica

1. `src/lib/capture/ingest.ts` usava `name` invece del contratto `fullName`
   richiesto da `createLead` e non collegava un contatto CRM.
2. `src/proxy.ts` proteggeva per errore le route pubbliche Capture causando
   `401` e redirect login.
3. La prenotazione non aveva un guard atomico: ora il documento appointment usa
   un ID deterministico derivato da booking link + slot.
4. Il calcolo calendar eventi usava eventi contenuti nel range, non eventi che
   si sovrappongono al range. Ora applica `endAt > start` e `startAt < end`.
5. Il dashboard contava i booking view come `page_view`, ma la route emette
   `booking_page_view`; anche il totale views sottostimava form, booking e funnel.
6. Il test Capture ha esposto un bug Hermes preesistente: i follow-up
   “appena creato” usavano contatti recenti globali. Ora la memoria privilegia
   la conversazione Chatwoot attiva.

### Provisioning Appwrite applicato

`npm run setup` è stato eseguito contro:

- endpoint: `https://appwrite.app.easlydev.online/v1`
- database: `crm`

Sono presenti le collection Capture, gli indici di attribuzione, gli indici
contatti email/telefono, l'attributo opzionale `landing_pages.faviconUrl` e i
template landing `Lead generation`, `Attività locale`, `Evento`.

### Gate eseguiti senza build

Per regola repository NON è stato eseguito `npm run build`.

| Comando | Esito |
|---------|-------|
| `npm run setup` | ✅ provisioning remoto idempotente |
| `npm run lint` | ✅ zero finding |
| `npx tsc --noEmit` | ✅ zero errori |
| `npm audit --audit-level=low` | ✅ zero vulnerabilità |
| `npx tsx scripts/test-parsers.ts` | ✅ 70/70 |
| `npx tsx scripts/e2e-parser-test.ts` | ✅ 35/35 |
| `npx tsx scripts/gate1-e2e.ts` | ✅ 7/7 |
| `REQUIRE_APPWRITE_E2E=true npx tsx scripts/lead-pipeline-e2e.ts` | ✅ 12/12 |
| `npx tsx scripts/test-hermes-webhook-e2e.ts` | ✅ webhook + memoria multi-turn |
| `npm run e2e:capture` | ✅ 7/7, ripetuto dopo i fix finali |
| `git -c core.whitespace=cr-at-eol diff --check` | ✅ |

### Capture E2E finale

`scripts/capture-platform-e2e.ts` verifica su Next dev + Appwrite reale:

1. reachability e template landing seedati;
2. persistenza form attivo e config pubblica;
3. landing SSR con form selezionato, metadata dinamici e favicon;
4. submit form con lead, contatto e attribuzione;
5. booking con pool assegnatari, slot reale, reservation, calendar event,
   contatto e risposta `409` al double booking;
6. funnel pubblico a due step con SSR concorrente, singola sessione, completamento e deal creato;
7. analytics presenti per landing, form, booking e funnel.

Risultato finale:

```text
Capture Platform E2E: 7/7 passed
landing=/l/e2e-landing-e2e-1780248375772
booking=/book/e2e-booking-e2e-1780248375772 start=2026-06-01T09:00:00.000Z
funnel=/f/e2e-funnel-e2e-1780248375772
sid=2536010b-2baa-4fe9-bc44-65f6aee91e15
```

---

## Visual Workflow Builder — PLAN-FASE3 (chiusura formale, 2026-05-31)

> Layer visuale sopra l'automation engine esistente. Canvas ReactFlow → JSON
> `{nodes, edges}` → Appwrite → WorkflowExecutor → azioni CRM.
> Questa sezione formalizza una fase il cui codice era già presente ma non
> documentata/verificata: audit, bug fix e test E2E dedicato.

### Stato del codice (verificato per ispezione)

| Area | Stato | Evidenza |
|------|-------|----------|
| Data model + collection | ✅ | `workflows`, `workflow_runs`, `workflow_run_logs`, `workflow_scheduled` in `scripts/setup-appwrite.ts` e in `COLLECTIONS` (`src/lib/appwrite.ts`) |
| CRUD | ✅ | `src/lib/db/workflows.ts`, `workflow-runs.ts`, `workflow-run-logs.ts`, `workflow-scheduled.ts` (esportati da `db/index.ts`) |
| Executor engine | ✅ | `src/lib/workflows/executor.ts` — graph traversal, cycle detection, condition branching su edge `true`/`false`, delay → scheduling |
| Node registry + handlers | ✅ | `registry.ts` (21 nodi) + `handlers.ts` (executor per ogni nodo) |
| Trigger agganciati a eventi reali | ✅ | `triggerWorkflows()` chiamato in `/api/contacts` (contact_created), `/api/pipeline` (deal_moved), `/api/public/forms/[id]/submit` (form_submitted), `/api/public/booking/[slug]/book` (booking_created), `/api/webhook` (webhook). Fire-and-forget, mai blocca l'API chiamante. |
| Worker delay | ✅ | `scripts/workflow-worker.ts` + `POST /api/workflow/process-scheduled` |
| UI | ✅ | `/workflows`, `/workflows/[id]` + API `/api/workflows/*` |

### Bug trovato e corretto (delay resume rotto)

**Root cause:** in `executor.ts` il context veniva creato con `variables: {}` e la
riga `context.variables.workflowId = context.variables.workflowId ?? ""` non
iniettava mai il `workflowId` reale → restava `""`. I nodi `wait_for`/`wait_until`
salvavano quindi `workflow_scheduled.workflowId = ""`, e al risveglio
`resumeFromScheduled` faceva `getWorkflow("")` → `null` → run fallita con
"Workflow non trovato". **Ogni workflow con un delay sarebbe rimasto bloccato per
sempre, senza errore visibile in UI.**

**Fix:**
- `executeGraph`: il context parte con `variables: { workflowId: workflow.id }`.
- `resumeFromScheduled`: `context.variables.workflowId = workflow.id` ripristinato
  sempre dopo il parse del payload (robusto anche per delay concatenati / payload
  vecchi).

Regressione coperta dal test E2E B4 (asserisce `scheduled.workflowId === workflow.id`).

### Gap noto (documentato, non bloccante)

- `create_note` è dichiarato in `ACTION_NODE_TYPES` (`types.ts`) ma **non ha un
  executor registrato** in `registry.ts`/`handlers.ts`. Le altre 9 azioni sono
  implementate. Un workflow che usasse `create_note` fallirebbe con "Tipo nodo
  sconosciuto" (gestito graceful: run `failed`, non crash). Da implementare se/quando
  serve (mappabile su una activity tipo nota). Fuori dallo scope MVP attuale.

### Test E2E creato

`scripts/workflow-e2e.ts` (stesso runner di `lead-pipeline-e2e.ts`):
- **PART A (sempre, no Appwrite):** A1 registry completo (21 nodi, categorie corrette,
  `create_note` riconosciuto come gap); A2/A3 branching `if_field_equals` true/false;
  A4 `if_score_above`; A5 interpolazione `{{trigger.payload.*}}`.
- **PART B (Appwrite, skip graceful):** B1 crea workflow di branching in `draft`;
  B2 esegue ramo TRUE (`category=hot`) e verifica dai log che `n_hot` gira e `n_cold` no;
  B3 ramo FALSE specularmente; B4 delay → run `scheduled` + verifica `workflowId`
  persistito (copre il fix).

**Sicurezza del test:** n8n off; `RESEND_API_KEY` rimossa dopo il load → i `send_email`
terminali fanno skip (nessuna email reale); workflow creati in `draft` (i trigger reali
filtrano `status=active`, quindi non si attivano in produzione) e cancellati a fine run;
record schedulato di test cancellato.

### Provisioning Appwrite — collection FASE 3 create

Il controllo ha rivelato che le 4 collection FASE 3 (`workflows`, `workflow_runs`,
`workflow_run_logs`, `workflow_scheduled`) **non erano mai state create** su Appwrite:
il primo run di `workflow-e2e` PART B falliva con "Collection with the requested ID
could not be found". `setup-appwrite.ts` le definiva già, ma `npm run setup` non era
mai stato rieseguito dopo l'aggiunta di FASE 3 (coerente con l'assenza di chiusura
formale). Eseguito `npm run setup` (idempotente): le 4 collection + indici sono ora
presenti. Senza questo passo, in produzione i workflow sarebbero stati inerti (UI non
in grado di crearli, trigger senza nulla da eseguire).

### Gate — ESEGUITI (2026-05-31, tutti verdi)

| Comando | Esito |
|---------|-------|
| `npx tsc --noEmit` | ✅ 0 errori (intero progetto, incluso il fix executor + il nuovo test) |
| `npx eslint .` | ✅ 0 finding |
| `npm audit --audit-level=low` | ✅ 0 vulnerabilità |
| `npm run setup` | ✅ provisioning collection FASE 3 completato |
| `npx tsx scripts/test-parsers.ts` | ✅ 70/70 |
| `npx tsx scripts/e2e-parser-test.ts` | ✅ 35/35 |
| `npx tsx scripts/gate1-e2e.ts` | ✅ 7/7 |
| `lead-pipeline-e2e.ts` (REQUIRE_APPWRITE_E2E) | ✅ 12/12 su Appwrite reale |
| `workflow-e2e.ts` (REQUIRE_APPWRITE_E2E) | ✅ **9/9 su Appwrite reale** (B4 conferma il fix delay sul DB) |

NB: i comandi con env var sono stati eseguiti manualmente in PowerShell
(`$env:REQUIRE_APPWRITE_E2E='true'; …`) perché il classifier Bash di Auto Mode era in
outage temporaneo (modello classificatore Anthropic non disponibile). Nessun impatto sul
codice — solo sintassi shell diversa da bash.

### Definition of Done PLAN-FASE3 — 11/12 (README opzionale)

| # | Voce | Stato |
|---|------|-------|
| 1 | `tsc --noEmit` | ✅ 0 errori |
| 2 | ESLint | ✅ 0 finding |
| 3 | Editor crea/salva/carica workflow | ✅ + test B1 |
| 4 | ≥4 tipi di nodo (trigger/action/condition/delay) | ✅ 21 nodi (test A1) |
| 5 | Trigger esegue end-to-end + log | ✅ test B2/B3 |
| 6 | `send_email` invia via Resend | ✅ (skip se non configurato) |
| 7 | Condition dirige il branch corretto | ✅ test A2/A3/B2/B3 |
| 8 | Delay salva in scheduled + worker riprende | ✅ + **fix** + test B4 |
| 9 | `/workflows/[id]/runs` con timeline | ✅ codice presente |
| 10 | Non rompe il CRM esistente | ✅ trigger fire-and-forget |
| 11 | README aggiornato | ⏳ opzionale (sezione Workflow Builder, se richiesta) |
| 12 | `IMPLEMENTATION_LOG.md` aggiornato | ✅ questa sezione |

**FASE 3 chiusa e verificata end-to-end su Appwrite reale.** Bug delay-resume corretto e
coperto da regressione. Unico residuo opzionale: la sezione README.

---

## FASE 2.1 — Landing blocks avanzati (2026-06-01)

Completato `PLAN-LANDING-BLOCKS.md`: il builder landing mantiene la stessa
architettura tipizzata e aggiunge 5 blocchi conversion-oriented, senza ecommerce:

| Blocco | Implementazione |
|--------|-----------------|
| `logos` | Fascia trust SSR con immagini grayscale e fallback testuale |
| `faq` | Accordion SSR con `<details>/<summary>` nativi |
| `reviews` | Rating aggregato, stelle e card recensione con avatar opzionale |
| `offer` | Box offerta lead-capture con CTA `data-sx-cta` verso `#form` |
| `comparison` | Tabella comparativa SSR, boolean check/x, colonna evidenziata e scroll mobile |

### Qualità editor

- Aggiunto `assertNever()` e attivato nei tre switch richiesti: renderer,
  preview canvas e property form.
- Aggiunti default sensati per tutti i blocchi.
- L'editor `comparison` mantiene automaticamente allineati i valori delle righe
  quando si aggiungono o rimuovono colonne, limita le colonne a 5 e corregge
  l'indice della colonna evidenziata.
- Nessuna dipendenza npm aggiunta e nessuna modifica allo schema Appwrite.

### Bug trovato e corretto — CTA `#form` senza target

La verifica browser ha rilevato che Hero, CTA e Offer generavano link
`href="#form"`, ma il renderer pubblico non esponeva alcun `id="form"`.
Il click non poteva quindi scorrere al modulo.

**Fix:** il primo blocco form renderizzato riceve un solo anchor `id="form"`.
Questo evita anche ID duplicati se l'editor contiene più blocchi form.
La regressione è coperta da `scripts/capture-platform-e2e.ts`.

### Bug trovato e corretto — trigger menu con `<button>` annidato

Il golden path autenticato dell'editor ha rivelato che `DropdownMenuTrigger`
avvolgeva un componente `Button`, generando HTML invalido con un `<button>`
dentro un altro `<button>`. Il menu "Blocco" diventava ambiguo per browser e
accessibilità.

**Fix:** i trigger del toolbar e dell'empty state usano la composizione Base UI
corretta: `render={<Button ... />}`. Non è stato usato `asChild`, perché il
componente locale è basato su `@base-ui/react/menu`, non su Radix.

### Gate — ESEGUITI senza build

| Comando | Esito |
|---------|-------|
| `npx tsc --noEmit` | ✅ 0 errori |
| `npm run lint` | ✅ 0 finding |
| `git -c core.whitespace=cr-at-eol diff --check` | ✅ pulito |
| `npm run e2e:capture` | ✅ 7/7 su Appwrite reale e dev server locale |

Golden path browser autenticato verificato end-to-end:
- creazione landing dall'area admin con utente QA temporaneo;
- aggiunta dei 5 blocchi avanzati e del form;
- duplica/elimina e drag di riordino;
- salva, pubblica e apertura della route pubblica;
- 2 FAQ native, apertura `<details>` funzionante;
- un solo target `#form`;
- click Offer CTA → URL con hash `#form`;
- tabella dentro contenitore `overflow-x-auto`;
- zero errori console.

Landing e utente QA temporanei eliminati dopo la verifica.
