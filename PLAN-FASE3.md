# PLAN-FASE3.md — SarconX Visual Workflow Builder

## Missione

Costruire un **workflow builder visuale integrato** dentro SarconX. L'obiettivo è permettere a un utente non-tecnico di creare automazioni CRM drag-and-drop senza usare servizi esterni (n8n, Sim, Zapier).

Questo è un layer **visuale sopra l'engine di automazione esistente** (`src/lib/leads/automation/`). Non sostituisce l'engine — lo espone.

```
[Evento CRM] → [Workflow Engine] → [Visual Editor configura il grafo]
                     ↓
              [Node Registry] → [Action Handlers esistenti + nuovi]
                     ↓
              [Contact/Deal/Task/Email creati automaticamente]
```

---

## Obiettivo finale

Entro la fine di questa fase, SarconX deve permettere:

1. Disegnare workflow su un canvas drag-and-drop con nodi e connessioni.
2. Configurare trigger (contact_created, deal_moved, form_submitted, schedule, webhook).
3. Aggiungere action nodes (create_contact, update_deal, send_email, create_task, http_request).
4. Aggiungere condition nodes con branching (if/else su campi CRM).
5. Aggiungere delay nodes (wait N minuti/ore/giorni o wait_until ora specifica).
6. Eseguire i workflow in risposta a eventi reali del CRM.
7. Tracciare ogni esecuzione (run) con log dettagliato per ogni nodo.
8. Visualizzare analytics (tassi di successo, nodi che falliscono di più).

---

## Principio fondamentale

**"Il canvas è solo una rappresentazione visiva di un grafo JSON."**

```
Canvas ReactFlow  ←→  JSON { nodes, edges }  ←→  Appwrite  ←→  Executor Engine
```

Il canvas non esegue nulla. L'executor engine legge il JSON salvato e lo esegue. Questo separazione rende il sistema testabile, robusto e indipendente dalla UI.

---

## Scope

**Implementare in questa fase:**

| # | Feature | Priorità |
|---|---------|----------|
| 1 | Visual Workflow Editor (ReactFlow canvas) | Alta |
| 2 | Node System & Registry (trigger/action/condition/delay) | Alta |
| 3 | Workflow Executor Engine (esecuzione grafo) | Alta |
| 4 | Scheduler & Delay System (worker per wait) | Alta |
| 5 | Workflow Analytics (runs, logs, dashboard) | Media |
| 6 | CRM Triggers integration (contact, deal, form, booking) | Alta |

**NON implementare in questa fase:**

- Loop/for-each su array (troppo complesso per MVP)
- Sub-workflow / call another workflow
- Custom code node (JavaScript/TypeScript eseguito runtime)
- Parallel execution (tutti i nodi sono sequenziali)
- Real-time collaborative editing (multi-utente sullo stesso canvas)
- Versioning del workflow (history delle modifiche)
- A/B testing tra workflow
- Import/export da n8n/Sim

---

## Stack & Dipendenze

### Stack esistente (da mantenere)
- Next.js 16 App Router
- React 19 + TypeScript strict
- Tailwind CSS v4
- shadcn/ui + @base-ui/react
- Appwrite (self-hosted)
- Resend (email)

### Nuove dipendenze

| Dipendenza | Scopo | Repo/URL |
|------------|-------|----------|
| `@xyflow/react` | Canvas drag-and-drop per workflow | npm (ReactFlow v12) |
| `date-fns` | Calcolo delay/wait (già presente) | npm |

**NOTA:** Non servono altre dipendenze pesanti. Il canvas è ReactFlow, il backend è l'engine esistente, la persistenza è Appwrite.

---

## Architettura generale

### Flusso dati

```
[Evento CRM] → [API Route /api/workflow/trigger] → [Workflow Engine]
                                                    ↓
                                          [Carica workflow JSON da Appwrite]
                                                    ↓
                                          [Executor: esegue nodes sequenzialmente]
                                                    ↓
                                          [Salva run + log in Appwrite]
                                                    ↓
                                          [Action Handler: crea contatto/deal/email]
```

### Pattern chiave

1. **Canvas ↔ JSON bidirezionale:** ReactFlow serializza in `{ nodes, edges }`. Ogni nodo ha `id`, `type`, `position`, `data` (config). Gli edges hanno `id`, `source`, `target`, `label` (per branch true/false).
2. **Executor engine:** Indipendente dalla UI. Legge il JSON, costruisce un grafo diretto, esegue dal trigger seguendo gli edges.
3. **Node Registry:** Ogni tipo di nodo ha metadata (label, color, icon, input schema, output schema) e un handler di esecuzione.
4. **Scheduler:** I delay node salvano un record in `workflow_scheduled`. Un worker esterno (o cron) processa i record `pending` con `executeAt <= now`.
5. **Audit trail:** Ogni run ha un array di log. Ogni log ha `nodeId`, `status`, `input`, `output`, `error`.

---

## Data model (Appwrite)

### Collection: `workflows`

```
id              string
name            string
description     string?
status          enum ["draft", "active", "paused", "archived"]
triggerType     string          // es. "contact_created"
triggerConfig   json            // filtri trigger (es. stage == "prospect")
nodes           json            // array di flow nodes (ReactFlow format)
edges           json            // array di flow edges (ReactFlow format)
createdBy       string
organizationId  string?
createdAt       datetime
updatedAt       datetime
```

**ReactFlow Node JSON shape (salvato in `nodes`):**

```json
{
  "id": "node_1",
  "type": "trigger",
  "position": { "x": 100, "y": 100 },
  "data": {
    "nodeType": "contact_created",
    "label": "Contatto Creato",
    "config": { "stageFilter": "prospect" }
  }
}
```

**ReactFlow Edge JSON shape (salvato in `edges`):**

```json
{
  "id": "edge_1",
  "source": "node_1",
  "target": "node_2",
  "label": "true",
  "type": "smoothstep"
}
```

### Collection: `workflow_runs`

```
id              string
workflowId      string
triggerType     string
triggerPayload  json            // dati dell'evento che ha scatenato il workflow
status          enum ["running", "scheduled", "completed", "failed", "cancelled"]
startedAt       datetime
completedAt     datetime?
error           string?
createdAt       datetime
```

### Collection: `workflow_run_logs`

```
id              string
runId           string
nodeId          string
nodeType        string             // es. "send_email"
status          enum ["ok", "skipped", "failed", "pending"]
input           json               // dati in ingresso al nodo
output          json               // dati in uscita dal nodo
error           string?
executedAt      datetime
```

### Collection: `workflow_scheduled`

```
id              string
workflowId      string
runId           string
nodeId          string
executeAt       datetime           // quando eseguire il prossimo nodo
payload         json               // stato corrente del workflow (context)
status          enum ["pending", "processing", "completed", "cancelled"]
createdAt       datetime
```

---

## Feature 1: Visual Workflow Editor

### Requisiti funzionali

**Admin side:**
- Lista workflow (nome, stato, trigger, ultima esecuzione, tasso di successo).
- Crea nuovo workflow da template vuoto.
- Canvas drag-and-drop con ReactFlow.
- Sidebar sinistra con nodi disponibili (categorie: Trigger, Action, Condition, Delay).
- Panel destro: proprietà del nodo selezionato.
- Toolbar: save, run test, activate/pause, delete.
- Validazione in tempo reale: trigger mancante, nodi isolati, cicli infiniti.
- Preview del JSON generato (modal per debug).

**Canvas interactions:**
- Drag nodo dalla sidebar al canvas.
- Click nodo → seleziona, mostra properties panel.
- Click e trascina per collegare nodi (edges).
- Click edge → mostra label editor (per condition branches).
- Delete nodo/edge con tasto Canc o bottone.
- Pan e zoom sul canvas.

### UI Components

- `WorkflowList` — tabella/card con metriche per ogni workflow.
- `WorkflowEditor` — wrapper ReactFlow con sidebar, canvas, properties panel.
- `WorkflowCanvas` — componente ReactFlow con custom nodes e edges.
- `NodeSidebar` — lista draggabile dei nodi disponibili (gruppi: Trigger, Action, Condition, Delay).
- `NodePropertiesPanel` — form dinamico basato sul tipo di nodo selezionato.
- `WorkflowToolbar` — save, test run, activate, pause, delete, validate.
- `WorkflowRunViewer` — visualizza i log di una singola esecuzione (timeline dei nodi).

### Custom Node Components (ReactFlow)

Ogni tipo ha un componente visivo distintivo:

| Tipo | Colore | Icona | Forma |
|------|--------|-------|-------|
| Trigger | Verde | Zap | Rettangolo arrotondato con bordo spesso |
| Action | Blu | Play | Rettangolo arrotondato |
| Condition | Giallo | GitBranch | Rombo |
| Delay | Viola | Clock | Rettangolo arrotondato con icona orologio |
| Integration | Arancione | Globe | Rettangolo arrotondato |

---

## Feature 2: Node System & Registry

### Node Registry

File: `src/lib/workflows/registry.ts`

Ogni nodo è definito da:

```typescript
interface WorkflowNodeDefinition {
  type: string;              // id univoco (es. "send_email")
  category: "trigger" | "action" | "condition" | "delay" | "integration";
  label: string;             // nome visualizzato
  description: string;       // tooltip
  icon: string;              // nome Lucide icon
  color: string;             // colore bordo/fill
  inputs: NodePort[];        // porte di ingresso (max 1 per trigger, multiple per action)
  outputs: NodePort[];       // porte di uscita (1 per action, 2 per condition true/false)
  configSchema: ZodSchema;   // schema validazione config
  executor: NodeExecutor;    // funzione che esegue il nodo
}
```

### Trigger Nodes (disponibili)

| Nodo | Descrizione | Config |
|------|-------------|--------|
| `contact_created` | Quando un contatto viene creato | Filtro per source, score minimo |
| `deal_moved` | Quando un deal cambia stage | Filtro per stage da/a |
| `form_submitted` | Quando un form viene inviato | Filtro per formId |
| `booking_created` | Quando una prenotazione viene fatta | Filtro per bookingLinkId |
| `schedule` | Esecuzione schedulata (cron) | Ora, giorni settimana, intervallo |
| `webhook` | Webhook generico inbound | Secret token, path personalizzato |

### Action Nodes (disponibili)

| Nodo | Descrizione | Config |
|------|-------------|--------|
| `create_contact` | Crea un nuovo contatto | Mappa campi dal payload |
| `update_contact` | Aggiorna un contatto esistente | Campi da aggiornare |
| `create_deal` | Crea un deal | Valore, stage, assignedTo |
| `update_deal` | Aggiorna un deal | Campi da aggiornare |
| `create_task` | Crea un task | Titolo, descrizione, dueDate, assignedTo |
| `send_email` | Invia email via Resend | To, subject, body (template con variabili) |
| `send_internal_message` | Crea notifica interna nel CRM | UserId, messaggio |
| `create_note` | Aggiunge nota a contatto/deal | Testo, relatedId |
| `move_pipeline_stage` | Sposta lead/deal in pipeline | Stage target |
| `http_request` | Chiama API esterna | Method, URL, headers, body |

### Condition Nodes (disponibili)

| Nodo | Descrizione | Config |
|------|-------------|--------|
| `if_field_equals` | Se campo == valore | Campo, valore, tipo confronto |
| `if_score_above` | Se score > X | Score minimo |
| `if_has_tag` | Se contatto ha tag | Tag name |
| `if_stage_is` | Se stage è X | Stage name |

### Delay Nodes (disponibili)

| Nodo | Descrizione | Config |
|------|-------------|--------|
| `wait_for` | Aspetta N minuti/ore/giorni | Durata, unità |
| `wait_until` | Aspetta fino a giorno/ora specifica | Giorno settimana, ora |

---

## Feature 3: Workflow Executor Engine

### Architettura

```
Executor.run(workflow, triggerPayload)
  → buildGraph(nodes, edges)
  → findStartNode()
  → traverse(startNode, context)
      → executeNode(node, context)
          → call NodeRegistry.executor[node.type]
          → save log
          → determineNextNode(node, result, edges)
      → if nextNode exists → traverse(nextNode, updatedContext)
      → if delay node → save workflow_scheduled, return
      → if no nextNode → workflow completed
```

### Context

Il context viene passato da nodo a nodo e contiene:

```typescript
interface ExecutionContext {
  trigger: { type: string; payload: unknown };
  variables: Record<string, unknown>;  // variabili accumulate durante l'esecuzione
  contact?: Contact;
  deal?: Deal;
  lead?: Lead;
  // ... altri riferimenti CRM
}
```

Le variabili si popolano con la sintassi `{{nodeId.output.field}}` o `{{trigger.payload.email}}`.

### Action Handlers

I nodi action usano i servizi esistenti:
- `create_contact` → `src/lib/db/contacts.ts`
- `send_email` → `src/lib/leads/automation/adapters/email.ts`
- `create_task` → `src/lib/db/tasks.ts`
- `http_request` → `fetch()` nativo

Se un handler non esiste, viene creato in `src/lib/workflows/handlers/`.

---

## Feature 4: Scheduler & Delay System

### Delay Execution

Quando l'executor incontra un nodo `wait_for` o `wait_until`:

1. Calcola `executeAt` (now + duration, oppure prossimo matching di wait_until).
2. Salva in `workflow_scheduled` con stato `pending`.
3. Salva il context serializzato in `payload`.
4. Segna il `workflow_run` come `scheduled`.
5. Termina l'esecuzione corrente.

### Worker

File: `scripts/workflow-worker.ts`

Loop ogni 60 secondi:
1. Query `workflow_scheduled` con `status = pending AND executeAt <= now`.
2. Per ogni record:
   - Aggiorna stato a `processing`.
   - Carica il workflow e il context.
   - Trova il nodo successivo al delay node.
   - Riprende l'esecuzione dal nodo successivo.
   - Al completamento, aggiorna stato a `completed`.
   - Se errore, aggiorna a `failed` e salva log.

### Deployment del Worker

Dato che il CRM è self-hosted:
- Opzione A: `npx tsx scripts/workflow-worker.ts` in un processo separato (screen/tmux/PM2).
- Opzione B: Cron job esterno che chiama `GET /api/workflow/process-scheduled` ogni minuto.
- Opzione C: Windows Task Scheduler che esegue lo script ogni minuto.

**Raccomandazione:** Opzione A con PM2 o un servizio systemd (Linux) / Windows Service.

---

## Feature 5: Workflow Analytics

### Requisiti

- Lista workflow runs per workflow (filtrabile per stato: success, failed, scheduled).
- Dettaglio run: timeline visiva dei nodi eseguiti, tempo per nodo, input/output.
- Metriche aggregate:
  - Total runs (oggi, 7 giorni, 30 giorni)
  - Success rate %
  - Average execution time
  - Nodi che falliscono più spesso
  - Trigger più attivi

### UI Components

- `WorkflowRunsTable` — lista esecuzioni con stato, durata, timestamp.
- `WorkflowRunTimeline` — timeline verticale dei nodi con colori per stato.
- `WorkflowMetricsCards` — card con metriche aggregate.
- `WorkflowNodeStats` — grafico a barre con failure rate per nodo.

---

## Piano di implementazione

### Fase A — Fondamenta (Settimana 1)

**Giorno 1 — Data model + API scaffold**
- Creare collections Appwrite: `workflows`, `workflow_runs`, `workflow_run_logs`, `workflow_scheduled`.
- Aggiungere collections a `scripts/setup-appwrite.ts`.
- Creare API routes scaffold:
  - `GET|POST /api/workflows`
  - `GET|PUT|DELETE /api/workflows/[id]`
  - `POST /api/workflows/[id]/activate`
  - `POST /api/workflows/[id]/test`
  - `GET /api/workflows/[id]/runs`
  - `POST /api/workflow/trigger`
  - `POST /api/workflow/process-scheduled`
- Aggiornare tipi TypeScript in `src/lib/workflows/types.ts`.

**Giorno 2 — ReactFlow setup + Canvas base**
- Installare `@xyflow/react`.
- Creare pagina `/workflows` con lista workflow.
- Creare pagina `/workflows/[id]` con layout editor.
- Implementare `WorkflowCanvas` con ReactFlow base (pan, zoom, background grid).
- Implementare `NodeSidebar` con lista nodi (senza drag funzionante ancora).

**Giorno 3 — Custom Nodes + Drag-and-Drop**
- Implementare componenti custom:
  - `TriggerNode`, `ActionNode`, `ConditionNode`, `DelayNode`
- Aggiungere colori, icone, badge per tipo.
- Implementare drag dalla sidebar al canvas.
- Implementare connessioni tra nodi (edges).
- Implementare selezione nodo (click → highlight).

**Giorno 4 — Properties Panel + Configurazione**
- Implementare `NodePropertiesPanel`.
- Form dinamico per ogni tipo di nodo:
  - Trigger: select tipo, config JSON editor.
  - Action: select action, mappa campi, template editor.
  - Condition: select campo, operatore, valore.
  - Delay: numero + unità, oppure giorno/ora.
- Validazione per campo con zod.
- Salvataggio del config nel nodo ReactFlow.

**Giorno 5 — Save/Load + Validazione + Test Run**
- Salvare workflow su Appwrite (nodes + edges JSON).
- Caricare workflow da Appwrite nel canvas.
- Validazione grafo:
  - Esattamente 1 trigger.
  - Nessun nodo isolato.
  - Condition ha 2 uscite (true/false).
  - Nessun ciclo (no self-referencing paths).
- Test run manuale: esegue il workflow con payload fittizio, mostra risultato.

### Fase B — Engine & Integrazione (Settimana 2)

**Giorno 6 — Node Registry + Action Handlers**
- Creare `src/lib/workflows/registry.ts` con tutte le definizioni.
- Implementare handlers per nodi CRM:
  - `create_contact`, `update_contact`
  - `create_deal`, `update_deal`
  - `create_task`
  - `send_email` (usa adapter Resend esistente)
  - `send_internal_message`
- Testare ogni handler isolatamente.

**Giorno 7 — Executor Engine**
- Implementare `WorkflowExecutor`:
  - `buildGraph(nodes, edges)`
  - `run(workflow, triggerPayload)`
  - `executeNode(node, context)`
  - `determineNextNode(node, result, edges)`
- Supporto per condition branching.
- Error handling: se un nodo fallisce, il workflow si ferma e il run viene marcato `failed`.
- Salvataggio automatico di `workflow_runs` e `workflow_run_logs`.

**Giorno 8 — Scheduler + Delay + Worker**
- Implementare delay handlers (`wait_for`, `wait_until`).
- Implementare `workflow_scheduled` CRUD.
- Implementare `scripts/workflow-worker.ts`.
- Testare: workflow con delay → pausa → worker riprende → completamento.
- Aggiungere worker script a `package.json` (`npm run workflow-worker`).

**Giorno 9 — CRM Triggers + Webhook**
- Integrare trigger con eventi CRM esistenti:
  - `contact_created`: hook in `/api/contacts/route.ts` POST.
  - `deal_moved`: hook in `/api/deals/[id]/route.ts` PUT.
  - `form_submitted`: hook in `/api/public/forms/[id]/submit/route.ts`.
  - `booking_created`: hook in `/api/public/booking/[slug]/book/route.ts`.
- Implementare trigger `webhook`: route `/api/workflow/webhook/[workflowId]`.
- Implementare trigger `schedule`: usa worker per trigger ricorrenti.

**Giorno 10 — Analytics + Polish + Documentazione**
- Implementare pagina `/workflows/[id]/runs` con lista e timeline.
- Implementare metriche aggregate (success rate, avg time, top failures).
- TypeScript `tsc --noEmit` check.
- Test end-to-end:
  1. Crea workflow trigger `contact_created` → action `send_email`.
  2. Crea contatto → verifica che email venga inviata.
  3. Verifica run log in `/workflows/[id]/runs`.
  4. Crea workflow con condition → testa entrambi i branch.
  5. Crea workflow con delay → verifica scheduling + worker.
- Aggiornare `IMPLEMENTATION_LOG.md` e `README.md`.

---

## Definition of Done

- [ ] TypeScript `npx tsc --noEmit` passa senza errori.
- [ ] ESLint passa senza errori.
- [ ] Workflow editor permette di creare, salvare, caricare workflow visivamente.
- [ ] Almeno 4 tipi di nodo funzionanti: trigger, action, condition, delay.
- [ ] Trigger `contact_created` esegue workflow end-to-end e crea log.
- [ ] Action `send_email` invia effettivamente una email via Resend.
- [ ] Condition node dirige il flusso su branch true/false corretto.
- [ ] Delay node salva in `workflow_scheduled` e il worker riprende l'esecuzione.
- [ ] Pagina `/workflows/[id]/runs` mostra esecuzioni con timeline.
- [ ] Nessuna feature rompe il CRM esistente.
- [ ] `README.md` aggiornato con istruzioni workflow builder.
- [ ] `IMPLEMENTATION_LOG.md` aggiornato.

---

## Rischi & Mitigazioni

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| ReactFlow v12 ha breaking changes con React 19 | Media | Alto | Testare subito in Giorno 2. Se fallisce, usare `@xyflow/react@latest` compatibile. |
| Cicli infiniti nei workflow | Media | Alto | Validazione grafo in Giorno 5 (DFS cycle detection). Timeout massimo per run (30s). |
| Worker single-process non robusto | Media | Medio | Documentare limitazione. Per produzione consigliare PM2 o Kubernetes CronJob. |
| Delay worker non eseguito → workflow bloccati | Media | Alto | Mostrare stato "scheduled" in UI. Alert se worker non ha processato nulla per > 5 min. |
| Variabili template `{{}}` complesse da parsare | Bassa | Medio | Usare regex semplice. Documentare sintassi supportata. Non supportare nested expressions per MVP. |
| Performance con workflow molto lunghi (> 50 nodi) | Bassa | Medio | Aggiungere pagination nei run. Limitare nodi per workflow a 100 in validazione. |
| Concurrency: più run dello stesso workflow contemporaneamente | Bassa | Medio | Non bloccare per MVP. Se necessario, aggiungere `workflowId` lock con Appwrite in futuro. |

---

## Istruzioni operative per Claude Code

1. Leggi questo file e seguilo esattamente.
2. Inizia dalla **Fase A — Giorno 1** (Data model).
3. Non saltare giorni. Ogni giorno dipende dal precedente.
4. ReactFlow è `@xyflow/react` — importare da lì, non da `reactflow` (nome vecchio).
5. Ogni nodo action DEVE usare i servizi esistenti (`src/lib/db/`, `src/lib/leads/automation/adapters/`) quando possibile.
6. L'executor engine NON deve mai throw — logga errore e marca run come `failed`.
7. Il worker è un processo separato. Non integrarlo nel dev server.
8. Se ambiguità: scegli l'opzione più semplice che funziona, documenta, continua.

**Focus:**

```
Canvas ReactFlow → JSON → Appwrite → Executor → CRM Actions
```

Tutto il resto è fuori scope per questa fase.
