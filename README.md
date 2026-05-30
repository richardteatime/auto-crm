<div align="center">

# Auto-CRM

### Il tuo CRM Locale con Intelligenza Artificiale | Your Local AI-Powered CRM

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Appwrite](https://img.shields.io/badge/Appwrite-Self--Hosted-F02E65?logo=appwrite)](https://appwrite.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss)](https://tailwindcss.com/)
[![Claude Code](https://img.shields.io/badge/Claude_Code-Ready-DA7756)](https://claude.ai/code)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Un CRM completo che gira al 100% sulla tua macchina. Senza Salesforce. Senza HubSpot. Senza abbonamenti.**

**A complete CRM that runs 100% on your machine. No Salesforce. No HubSpot. No subscriptions.**

[Italiano](#italiano) | [English](#english)

</div>

---

# Italiano

## Cos'e Auto-CRM?

Auto-CRM e un CRM open-source che si personalizza automaticamente al tuo business. Aprilo con Claude Code, esegui `/setup`, e il CRM si adatta alla tua industria, al tuo pipeline e al tuo modo di lavorare. Tutto gira sul tuo computer — i tuoi dati non lasciano mai la tua macchina.

## Perche Auto-CRM?

- **Self-hosted** — Database Appwrite sul tuo server. Nessun SaaS. I tuoi dati restano tuoi.
- **Si personalizza da solo** — Esegui `/setup` e Claude adatta il pipeline, le fonti dei lead, la lingua e il tema al tuo business.
- **IA inclusa** — Classifica lead, analizza il tuo pipeline, suggerisce i prossimi passi. Nessuna API key richiesta.
- **Gratis per sempre** — Open source. Nessun abbonamento. Nessun limite di contatti o deal.
- **Pronto in 3 comandi** — Clona, installa, esegui. Il tuo CRM funzionante in meno di 2 minuti.

## Avvio Rapido

```bash
git clone https://github.com/Hainrixz/auto-crm.git
cd auto-crm && npm install
npm run dev
```

Apri **http://localhost:3000** — il tuo CRM e pronto.

```bash
# Opzionale: configura Appwrite e carica dati demo
npm run setup
npm run seed
```

## Personalizza con Claude Code

Apri il progetto con Claude Code e scrivi:

```
/setup
```

L'assistente ti chiede:
1. Tipo di business e industria
2. Fasi del tuo pipeline di vendita
3. Da dove arrivano i tuoi lead
4. Lingua e tema visivo

E personalizza tutto automaticamente.

## Funzionalita

### Dashboard
Pannello principale con KPI in tempo reale: contatti totali, deal attivi, valore in pipeline, lead caldi. Grafici del pipeline e attivita recente.

### Pipeline Kanban
Tabellone visivo drag & drop. Trascina deal tra le fasi. Ogni carta mostra valore, contatto e temperatura del lead.

### Gestione Contatti
Tabella con ricerca, filtri per temperatura (freddo/tiepido/caldo) e fonte. Score di ogni lead. Clicca per vedere il dettaglio completo con lo storico.

### Azioni Rapide
Pulsanti WhatsApp, chiamata e copia direttamente su ogni contatto. Un clic per aprire la chat di WhatsApp o avviare una chiamata.

### Tracciamento Attivita
Timeline di tutte le interazioni: chiamate, email, riunioni, note. Sistema di follow-up con alert per i follow-up scaduti.

### Classificazione Lead
Due modalita: regole automatiche (senza API key) o IA con Claude (opzionale). Score da 0-100 e temperatura automatica.

### Webhook
Ricevi lead automaticamente da form web (Typeform, Tally, Google Forms, Zapier). Supporta campi in spagnolo e inglese.

### Esportazione CSV
Scarica i tuoi contatti e deal come CSV con un clic. Compatibile con Excel.

### Notifiche
Banner nel dashboard per i follow-up scaduti. Notifiche del browser opzionali ogni 5 minuti.

### Email Digest
Riepilogo giornaliero via email con follow-up in sospeso, lead caldi e metriche. Richiede Resend (gratis).

## Comandi di Claude Code

| Comando | Cosa fa |
|---------|---------|
| `/setup` | Personalizza CRM per il tuo business |
| `/add-lead` | Aggiungi un lead in modo conversazionale |
| `/analyze-pipeline` | Analisi del pipeline con raccomandazioni |
| `/daily-briefing` | Riepilogo esecutivo della giornata |
| `/import-contacts` | Importa contatti da CSV |
| `/customize` | Cambia configurazione |
| `/connect` | Connetti con Gmail, Calendar, Sheets, WhatsApp |
| `/digest` | Invia riepilogo via email |

## Integrazioni

### Webhook — Ricevi lead automaticamente

```bash
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"name":"Juan","email":"juan@ejemplo.com","phone":"555-1234","company":"Mi Empresa"}'
```

Supporta nomi di campi in spagnolo (`nombre`, `correo`, `telefono`, `empresa`) e formato Typeform annidato.

### Esporta dati

```bash
# Scarica contatti come CSV
curl http://localhost:3000/api/export?type=contacts -o contactos.csv

# Scarica deal come CSV
curl http://localhost:3000/api/export?type=deals -o deals.csv
```

### MCP — Claude Desktop / Claude.ai

Connetti il tuo CRM direttamente a Claude Desktop:

```json
{
  "mcpServers": {
    "auto-crm": {
      "command": "npx",
      "args": ["tsx", "/percorso/a/auto-crm/mcp/crm-server.ts"]
    }
  }
}
```

Ora puoi dire a Claude: *"Mostrami i miei lead caldi"* o *"Aggiungi un nuovo contatto"* da qualsiasi chat.

## Stack Tecnico

| Componente | Tecnologia |
|-----------|-----------|
| Frontend | Next.js 16 + React 19 + TypeScript |
| Stili | Tailwind CSS v4 + shadcn/ui |
| Database | Appwrite (self-hosted) |
| Drag & Drop | @dnd-kit |
| Grafici | Recharts |
| IA | OpenRouter (scegli modello) / Claude API (fallback) |
| MCP | Server integrato |
| Container | Docker |

## Deploy

### Opzione 1 — Sviluppo locale
```bash
npm run dev
```

### Opzione 2 — Produzione
```bash
npm run build && npm start
```

### Opzione 3 — Docker
```bash
docker compose up -d
```

### Opzione 4 — MCP (Claude Desktop)
Aggiungi la configurazione MCP mostrata sopra al tuo `claude_desktop_config.json`.

## Struttura del Progetto

```
auto-crm/
├── CLAUDE.md                # Istruzioni per Claude Code
├── .claude/commands/        # 8 comandi interattivi
├── mcp/crm-server.ts        # Server MCP (10 strumenti)
├── scripts/                 # Setup Appwrite + seed dati
├── src/
│   ├── app/                 # Pagine e 18 API routes
│   ├── components/          # Componenti React + shadcn/ui
│   ├── lib/db/              # Layer dati Appwrite
│   ├── lib/                 # Utilita (scoring, AI, constants)
│   └── types/               # TypeScript types
├── Dockerfile               # Contenitore Docker
└── docker-compose.yml       # Docker Compose + Appwrite
```

## AI Orchestrator (SarconX Auto-CRM)

Il CRM include un **Orchestrator AI** che permette al founder/admin di comandare il CRM in linguaggio naturale via WhatsApp/Chatwoot e ottenere operazioni reali:

- Chiedere stato progetti, ricavi, lead, blocchi operativi
- Creare progetti, deal, task
- Avviare workflow tecnici (sito statico, generazione app)
- Ricevere su WhatsApp il link dell'app/sito deployato

### Setup Chatwoot

1. Configura un account Chatwoot e collegalo a WhatsApp
2. Vai in **Settings > Integrations > Webhooks** e aggiungi:
   ```
   https://TUO-CRM/api/chatwoot/webhook
   ```
3. Imposta `CHATWOOT_WEBHOOK_SECRET` nel `.env.local`
4. Aggiungi i numeri admin in `ADMIN_WHATSAPP_NUMBERS`

### Comandi supportati (WhatsApp/Chatwoot)

| Comando | Esempio | Risultato |
|---------|---------|-----------|
| Query progetti | *"A che progetti stiamo lavorando?"* | Lista progetti attivi |
| Query ricavi | *"Quanti ricavi abbiamo fatto oggi?"* | Incassi + deal vinti + pipeline |
| Query lead | *"Dammi un riepilogo dei lead"* | Totale, freddi/tiepidi/caldi, fonti |
| Query blocchi | *"Quali progetti sono bloccati?"* | Lista progetti bloccati |
| Query agenti | *"Stato agenti"* | Ultime 10 run orchestrator |
| Crea progetto | *"Crea progetto per Mario Rossi"* | Progetto + contact creati |
| Crea deal | *"Crea deal per Mario da 5000 euro"* | Deal + contact creati |
| Crea task | *"Crea task chiamare Mario domani"* | Task creato con scadenza |
| Workflow sito | *"Avvia workflow sito per Mario"* | Progetto + dispacciamento GitAgent |
| Genera app | *"Genera app per Mario"* | Progetto + deal + dispacciamento GitAgent |

### Flusso end-to-end (generazione app)

```text
Founder scrive su WhatsApp -> Chatwoot -> Webhook CRM
-> Verifica permission (solo ADMIN_WHATSAPP_NUMBERS)
-> Classifica intento (AI o keyword fallback)
-> Crea progetto/deal/run
-> Dispaccia a GitAgent (se ENABLE_GITAGENT_DISPATCH=true)
-> GitAgent genera codice -> Callback con repoUrl
-> Deploy preview -> Callback con finalUrl
-> CRM risponde su WhatsApp: "App deployata. Link: ..."
```

### Test locali

```bash
# Test comando diretto via API
curl -X POST http://localhost:3000/api/orchestrator/command \
  -H "Content-Type: application/json" \
  -d '{"messageText":"Crea progetto per Test","senderPhone":"+393331234567","conversationId":1}'

# Lista runs
curl http://localhost:3000/api/orchestrator/runs

# Dettaglio run
curl http://localhost:3000/api/orchestrator/runs/RUN_ID

# Simula callback GitAgent
curl -X POST http://localhost:3000/api/orchestrator/callback/gitagent \
  -H "Content-Type: application/json" \
  -d '{"runId":"RUN_ID","status":"completed","repoUrl":"https://github.com/...","deployRequested":true}'

# Simula callback deploy
curl -X POST http://localhost:3000/api/orchestrator/callback/deploy \
  -H "Content-Type: application/json" \
  -d '{"runId":"RUN_ID","status":"success","url":"https://preview.example.com"}'
```

### Step 2 (Customer Automation) — BLOCCATO

La modalita customer e **disabilitata di default**:
```env
ENABLE_CUSTOMER_AUTOMATION=false
CUSTOMER_AUTOMATION_UNLOCKED=false
```

Lo Step 2 si attiva solo quando il flusso end-to-end e validato (founder puo generare app da WhatsApp e ricevere il link deployato). **Non cambiare questi flag finche il Gate non e superato.**

## Lead Pipeline (MVP)

Sistema automatico, indipendente dall'orchestrator, che porta un lead dal form
fino alla bozza di preventivo:

```text
Form email -> CRM -> Pipeline -> Automazioni -> Chiamata Leo -> Preventivo (bozza)
```

### Fasi pipeline

`prospect` -> `opportunity` -> `contacted` -> `proposal`

Ogni cambio di fase e tracciato in `pipeline_movements` e fa partire le
automazioni associate (`automation_runs`). Nessun movimento avviene senza log.

### Endpoint

| Endpoint | Metodo | Auth | Cosa fa |
|----------|--------|------|---------|
| `/api/leads/email-inbound` | POST | webhook secret opzionale + rate limit IP | Riceve l'email del form, fa parsing (chiave-valore/HTML/AI), scoring, deduplica, crea il lead in `prospect` e fa partire `lead_created` |
| `/api/leads/[id]/move-stage` | POST | sessione | Sposta il lead di fase (idempotente) e fa partire `stage_changed_to_<fase>` |
| `/api/leads/[id]/call-outcome` | POST | sessione | Leo registra l'esito chiamata; instrada il lead in base all'esito e fa partire `call_completed` |
| `/api/leads/[id]/generate-quote` | POST | sessione | Genera/persiste la bozza preventivo (idempotente; `{regenerate:true}` per rigenerare) |

### Scoring lead

+20 per ciascuno di: email, telefono, richiesta chiara, categoria nota, budget
(max 100). Banda: `>=70` hot, `40-69` medium, `<40` weak.

### UI

`/leads` mostra la board a 4 colonne (una per fase) con ricerca. Il dettaglio
`/leads/[id]` mostra dati email, email raw, campi personalizzati, storico
automazioni, call task Leo e bozza preventivo, e permette di cambiare fase,
registrare l'esito chiamata e generare la bozza.

### Regola di sicurezza — preventivo sempre bozza

Il preventivo viene **sempre** generato come bozza con la nota *"NON inviata al
cliente: richiede approvazione manuale prima dell'invio"*. Nessun invio
automatico al cliente.

### Esecutore automazioni — interno (default) o n8n

L'engine interno gira le regole in-process ed e la rete di sicurezza. Per
delegare a [n8n](https://n8n.io) (workflow visuali/esterni) bastano **entrambe**
le env (nessuna modifica al codice):

```env
ENABLE_N8N_AUTOMATIONS=true
N8N_WEBHOOK_URL=https://<tuo-n8n>/webhook/<id>
# opzionale
N8N_API_KEY=
```

Se n8n e disabilitato o un dispatch fallisce, il sistema torna automaticamente
all'engine interno: il flusso lead non si blocca mai.

### Test end-to-end

Scenario "Marco Rossi" completo (parser -> scoring -> categoria -> pipeline ->
automazioni -> esito chiamata -> proposal -> bozza preventivo):

```bash
# Lo script carica .env.local. PART A gira sempre; PART B usa Appwrite se raggiungibile.
npx tsx scripts/lead-pipeline-e2e.ts

# Gate persistente: fallisce se PART B Appwrite viene saltata.
REQUIRE_APPWRITE_E2E=true npx tsx scripts/lead-pipeline-e2e.ts
```

Il test non cancella mai i lead: la PART B crea dati univoci per run e stampa
l'id del lead per ispezione manuale. La deduplicazione viene verificata
richiamando l'endpoint inbound una seconda volta nello stesso run.

### Verifiche locali consigliate

```bash
npm run lint
npx tsc --noEmit
npx tsx scripts/gate1-e2e.ts
REQUIRE_APPWRITE_E2E=true npx tsx scripts/lead-pipeline-e2e.ts
npx tsx scripts/test-hermes-webhook-e2e.ts
npm audit --audit-level=low
```

## Variabili d'Ambiente

> **Template**: copia `.env.example` a `.env.local` e riempi i valori.

| Variabile | Descrizione |
|-----------|-------------|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | URL della tua istanza Appwrite |
| `APPWRITE_PROJECT_ID` | ID del progetto in Appwrite |
| `APPWRITE_API_KEY` | API key con permessi di database |
| `APPWRITE_DATABASE_ID` | ID del database (default: crm) |
| `SESSION_SECRET` | Secret per la sessione HMAC (cambia con una stringa casuale) |
| `OPENROUTER_API_KEY` | Classificazione lead con IA (scegli modello). Fallback: `ANTHROPIC_API_KEY` |
| `OPENROUTER_MODEL` | Modello OpenRouter (default: `anthropic/claude-sonnet-4`) |
| `ANTHROPIC_API_KEY` | Fallback diretto Anthropic (opzionale) |
| `RESEND_API_KEY` | Email digest giornaliero (resend.com, gratis) |
| `DIGEST_EMAIL` | Email dove ricevere il digest |
| `DIGEST_FROM` | Email mittente del digest (default: onboarding@resend.dev) |
| `ADMIN_WHATSAPP_NUMBERS` | Numeri founder admin (es: `+393331234567,+393331111111`) |
| `CHATWOOT_URL` | URL istanza Chatwoot |
| `CHATWOOT_ACCOUNT_ID` | ID account Chatwoot |
| `CHATWOOT_API_ACCESS_TOKEN` | Token API Chatwoot |
| `CHATWOOT_WEBHOOK_SECRET` | Secret per validare webhook Chatwoot |
| `ENABLE_INTERNAL_COMMANDS` | Abilita comandi interni (`true`) |
| `ENABLE_GITAGENT_DISPATCH` | Dispaccia a GitAgent (`false` di default) |
| `ENABLE_AUTODEPLOY_PREVIEW` | Auto-deploy preview (`false` di default) |
| `ENABLE_CUSTOMER_AUTOMATION` | Modalita customer (`false` di default, BLOCCATO) |
| `CUSTOMER_AUTOMATION_UNLOCKED` | Sblocco customer (`false` di default) |
| `GITAGENT_ENDPOINT` | Endpoint GitAgent per dispatch |
| `GITAGENT_API_KEY` | API key GitAgent |
| `GITAGENT_CALLBACK_SECRET` | Secret per validare callback GitAgent |
| `DEPLOY_CALLBACK_SECRET` | Secret per validare callback deploy |
| `NEXT_PUBLIC_APP_URL` | URL pubblico del CRM (per callback) |
| `LEAD_INBOUND_WEBHOOK_SECRET` | Secret opzionale per `/api/leads/email-inbound` |
| `LEAD_FROM_EMAIL` | Mittente delle email automazioni lead (Resend) |
| `LEAD_NOTIFY_EMAIL` | Email del team interno per le notifiche lead |
| `LEO_EMAIL` | Email di Leo (riceve le call task) |
| `FOUNDER_EMAIL` | Email del founder (notifica in fase proposal) |
| `LEO_USER_ID` | ID agente per le call task (default: `leo`) |
| `LEO_NAME` | Nome agente per le call task (default: `Leo`) |
| `ENABLE_N8N_AUTOMATIONS` | Delega le automazioni lead a n8n (`false` di default) |
| `N8N_WEBHOOK_URL` | Webhook n8n; serve insieme al flag per attivare n8n |
| `N8N_API_KEY` | API key opzionale inviata come header `x-n8n-api-key` |

## Modalita IA

| Modalita | Richiede API Key | Come funziona |
|----------|-----------------|---------------|
| **Terminale** | No | Comandi in Claude Code (`/add-lead`, `/analyze-pipeline`) |
| **MCP** | No | Claude Desktop/Web parla diretto con il tuo CRM |
| **Web** | Si (opzionale) | L'interfaccia web classifica lead automaticamente |

## Script

```bash
npm run dev        # Server di sviluppo
npm run build      # Build di produzione
npm run start      # Server di produzione
npm run setup      # Inizializza database Appwrite
npm run seed       # Carica dati demo
npm run mcp        # Server MCP per Claude Desktop
npm run lint       # Verifica codice
```

## Contribuisci

1. Fork il repository
2. Crea il tuo branch (`git checkout -b feature/mia-feature`)
3. Fai commit delle tue modifiche (`git commit -m 'Aggiungi feature'`)
4. Push sul tuo branch (`git push origin feature/mia-feature`)
5. Apri una Pull Request

---

# English

## What is Auto-CRM?

Auto-CRM is an open-source CRM that automatically customizes itself to your business. Open it with Claude Code, run `/setup`, and the CRM adapts to your industry, pipeline, and workflow. Everything runs on your computer — your data never leaves your machine.

## Why Auto-CRM?

- **Self-hosted** — Appwrite database on your server. No SaaS. Your data stays yours.
- **Self-customizing** — Run `/setup` and Claude adapts the pipeline, lead sources, language, and theme to your business.
- **AI included** — Classifies leads, analyzes your pipeline, suggests next steps. No API key required.
- **Free forever** — Open source. No subscriptions. No limits on contacts or deals.
- **Ready in 3 commands** — Clone, install, run. Your CRM working in under 2 minutes.

## Quick Start

```bash
git clone https://github.com/Hainrixz/auto-crm.git
cd auto-crm && npm install
npm run dev
```

Open **http://localhost:3000** — your CRM is ready.

```bash
# Optional: set up Appwrite and load demo data
npm run setup
npm run seed
```

## Customize with Claude Code

Open the project with Claude Code and type:

```
/setup
```

The assistant asks about:
1. Business type and industry
2. Sales pipeline stages
3. Where your leads come from
4. Language and visual theme

And customizes everything automatically.

## Features

### Dashboard
Main panel with real-time KPIs: total contacts, active deals, pipeline value, hot leads. Pipeline charts and recent activity.

### Kanban Pipeline
Visual drag & drop board. Drag deals between stages. Each card shows value, contact, and lead temperature.

### Contact Management
Table with search, temperature filters (cold/warm/hot), and source filters. Lead score for each contact. Click for full detail with history.

### Quick Actions
WhatsApp, call, and copy buttons directly on each contact. One click to open WhatsApp chat or start a call.

### Activity Tracking
Timeline of all interactions: calls, emails, meetings, notes. Follow-up system with alerts for overdue items.

### Lead Classification
Two modes: automatic rules (no API key) or AI with Claude (optional). Score from 0-100 and automatic temperature.

### Webhook
Receive leads automatically from web forms (Typeform, Tally, Google Forms, Zapier). Supports fields in Spanish and English.

### CSV Export
Download your contacts and deals as CSV with one click. Excel compatible.

### Notifications
Dashboard banner for overdue follow-ups. Optional browser notifications every 5 minutes.

### Email Digest
Daily email summary with pending follow-ups, hot leads, and metrics. Requires Resend (free tier).

## Claude Code Commands

| Command | What it does |
|---------|-------------|
| `/setup` | Customize CRM for your business |
| `/add-lead` | Add a lead conversationally |
| `/analyze-pipeline` | Pipeline analysis with recommendations |
| `/daily-briefing` | Executive summary of the day |
| `/import-contacts` | Import contacts from CSV |
| `/customize` | Change configuration |
| `/connect` | Connect with Gmail, Calendar, Sheets, WhatsApp |
| `/digest` | Send summary via email |

## Integrations

### Webhook — Receive leads automatically

```bash
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com","phone":"555-1234","company":"Acme Inc"}'
```

Supports Spanish field names (`nombre`, `correo`, `telefono`, `empresa`) and nested Typeform format.

### Export data

```bash
# Download contacts as CSV
curl http://localhost:3000/api/export?type=contacts -o contacts.csv

# Download deals as CSV
curl http://localhost:3000/api/export?type=deals -o deals.csv
```

### MCP — Claude Desktop / Claude.ai

Connect your CRM directly to Claude Desktop:

```json
{
  "mcpServers": {
    "auto-crm": {
      "command": "npx",
      "args": ["tsx", "/path/to/auto-crm/mcp/crm-server.ts"]
    }
  }
}
```

Now you can tell Claude: *"Show me my hot leads"* or *"Add a new contact"* from any chat.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 16 + React 19 + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Appwrite (self-hosted) |
| Drag & Drop | @dnd-kit |
| Charts | Recharts |
| AI | OpenRouter (choose model) / Claude API (fallback) |
| MCP | Built-in server |
| Container | Docker |

## Deployment

### Option 1 — Local development
```bash
npm run dev
```

### Option 2 — Production
```bash
npm run build && npm start
```

### Option 3 — Docker
```bash
docker compose up -d
```

### Option 4 — MCP (Claude Desktop)
Add the MCP config shown above to your `claude_desktop_config.json`.

## Project Structure

```
auto-crm/
├── CLAUDE.md                # Instructions for Claude Code
├── .claude/commands/        # 8 interactive commands
├── mcp/crm-server.ts        # MCP server (10 tools)
├── scripts/                 # Appwrite setup + data seed
├── src/
│   ├── app/                 # Pages and 18 API routes
│   ├── components/          # React components + shadcn/ui
│   ├── lib/db/              # Appwrite data access layer
│   ├── lib/                 # Utilities (scoring, AI, constants)
│   └── types/               # TypeScript types
├── Dockerfile               # Docker container
└── docker-compose.yml       # Docker Compose + Appwrite
```

## Environment Variables

> **Template**: copy `.env.example` to `.env.local` and fill in the values.

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | URL of your Appwrite instance |
| `APPWRITE_PROJECT_ID` | Project ID in Appwrite |
| `APPWRITE_API_KEY` | API key with database permissions |
| `APPWRITE_DATABASE_ID` | Database ID (default: crm) |
| `SESSION_SECRET` | HMAC session secret (change to a random string) |
| `OPENROUTER_API_KEY` | AI lead classification (choose your model). Fallback: `ANTHROPIC_API_KEY` |
| `OPENROUTER_MODEL` | OpenRouter model (default: `anthropic/claude-sonnet-4`) |
| `ANTHROPIC_API_KEY` | Direct Anthropic fallback (optional) |
| `RESEND_API_KEY` | Daily email digest (resend.com, free) |
| `DIGEST_EMAIL` | Email address to receive digest |
| `DIGEST_FROM` | Sender email for digest (default: onboarding@resend.dev) |
| `ADMIN_WHATSAPP_NUMBERS` | Founder admin numbers (e.g. `+393331234567,+393331111111`) |
| `CHATWOOT_URL` | Chatwoot instance URL |
| `CHATWOOT_ACCOUNT_ID` | Chatwoot account ID |
| `CHATWOOT_API_ACCESS_TOKEN` | Chatwoot API token |
| `CHATWOOT_WEBHOOK_SECRET` | Secret to validate Chatwoot webhooks |
| `ENABLE_INTERNAL_COMMANDS` | Enable internal commands (`true`) |
| `ENABLE_GITAGENT_DISPATCH` | Dispatch to GitAgent (`false` by default) |
| `ENABLE_AUTODEPLOY_PREVIEW` | Auto-deploy preview (`false` by default) |
| `ENABLE_CUSTOMER_AUTOMATION` | Customer mode (`false` by default, LOCKED) |
| `CUSTOMER_AUTOMATION_UNLOCKED` | Customer unlock (`false` by default) |
| `GITAGENT_ENDPOINT` | GitAgent dispatch endpoint |
| `GITAGENT_API_KEY` | GitAgent API key |
| `GITAGENT_CALLBACK_SECRET` | Secret to validate GitAgent callbacks |
| `DEPLOY_CALLBACK_SECRET` | Secret to validate deploy callbacks |
| `NEXT_PUBLIC_APP_URL` | Public CRM URL (for callbacks) |

## AI Modes

| Mode | Requires API Key | How it works |
|------|-----------------|--------------|
| **Terminal** | No | Commands in Claude Code (`/add-lead`, `/analyze-pipeline`) |
| **MCP** | No | Claude Desktop/Web talks directly to your CRM |
| **Web** | Yes (optional) | Web UI classifies leads automatically |

## Scripts

```bash
npm run dev        # Development server
npm run build      # Production build
npm run start      # Production server
npm run setup      # Initialize Appwrite database
npm run seed       # Load demo data
npm run mcp        # MCP server for Claude Desktop
npm run lint       # Check code
```

## Contributing

1. Fork the repository
2. Create your branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add feature'`)
4. Push to your branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

<div align="center">

**Auto-CRM** — Built with Claude Code for the community.

Your data. Your machine. Your CRM.

I tuoi dati. La tua macchina. Il tuo CRM.

</div>
