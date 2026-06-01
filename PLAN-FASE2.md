# PLAN-FASE2.md — SarconX Capture & Conversion Platform

## Missione

Trasformare SarconX da CRM operativo interno a **piattaforma di capture e conversion completa**. L'obiettivo è permettere a un utente (o a un'agenzia che usa SarconX in white-label futuro) di generare lead direttamente dal web senza usare tool esterni.

**Questo piano copre la Fase 2 del roadmap GoHighLevel-like:**

```
Landing Page → Form/CTA → Lead in CRM
               ↓
         Booking Page → Evento in Calendario
               ↓
      Funnel Multi-step → Deal in Pipeline
```

Ogni punto di contatto deve essere **tracciato, attribuito e convertibile** dentro SarconX.

---

## Obiettivo finale

Entro la fine di questa fase, SarconX deve permettere:

1. Creare landing pages drag-and-drop con template predefiniti.
2. Pubblicare landing pages su slug pubblici (`/l/[slug]`) con SSR.
3. Creare form embeddabili (drag-and-drop) che generano contatti in CRM.
4. Pubblicare pagine di prenotazione pubbliche (`/book/[slug]`) collegate al calendario.
5. Costruire funnel multi-step (sequenza di pagine con condizioni e conversion tracking).
6. Tracciare views, submissions e conversioni per ogni asset.
7. Ogni lead generato deve avere `source`, `landingPageId`, `formId`, `funnelId`, `bookingLinkId` per attribuzione completa.

---

## Principio fondamentale

**"Ogni lead ha un'origine tracciata."**

```
Asset pubblico (landing/form/funnel/booking)
↓
Interazione (view / submit / book / step-complete)
↓
Contatto/Deal in CRM con metadati attribuzione
↓
Analytics visibili nel dashboard
```

Nessun lead entra nel CRM senza sapere da quale pagina, form o funnel è arrivato.

---

## Scope

**Implementare in questa fase:**

| # | Feature | Priorità |
|---|---------|----------|
| 1 | Landing Page Builder + pubblicazione | Alta |
| 2 | Form Builder embeddabile | Alta |
| 3 | Public Booking Page | Media |
| 4 | Funnel Builder (sequenza + condizioni) | Media |
| 5 | Analytics base (views, submissions, conversions) | Alta |

**NON implementare in questa fase:**

- Custom domain mapping (white-label DNS) — predisposto ma non attivo
- A/B testing nativo
- Payments/Stripe integration
- Membership/protected content
- Email marketing campaigns (drip sequences)
- AI chatbot widget
- Mobile app / PWA
- Social media planner
- Call tracking telefonico

---

## Stack & Dipendenze

### Stack esistente (da mantenere)
- Next.js 16 App Router
- React 19 + TypeScript strict
- Tailwind CSS v4
- shadcn/ui + @base-ui/react
- Appwrite (self-hosted)
- Resend (email)

### Nuove dipendenze candidate

| Dipendenza | Scopo | Repo/URL |
|------------|-------|----------|
| `grapesjs` + `@grapesjs/react` | Landing page editor drag-and-drop | [GrapesJS](https://github.com/GrapesJS/grapesjs) |
| `grapesjs-preset-webpage` | Blocchi predefiniti (hero, features, footer) | npm |
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag-and-drop form builder | npm (già usato in Kanban) |
| `zustand` | Stato globale editor (se necessario) | npm |
| `react-frame-component` | Preview iframe isolata per landing pages | npm |
| `slugify` | Generazione slug univoci | npm |
| `zod` | Validazione form config (già presente) | npm |

**Alternativa a GrapesJS:** [`chaibuilder/sdk`](https://github.com/chaibuilder/sdk) se si preferisce un builder TS-first più moderno. **Decisione architetturale da documentare in fase di kickoff.**

---

## Architettura generale

### Flusso dati

```
[Admin UI]
   ↓
[Builder Editor] → salva JSON/HTML in Appwrite
   ↓
[Public Route /l/[slug], /f/[slug], /book/[slug]]
   ↓
[Lead/Contact/Deal/CalendarEvent] in Appwrite
   ↓
[Analytics Events] in Appwrite
```

### Pattern chiave

1. **Storage dei template:** Ogni landing/funnel/form è salvato come documento Appwrite con campi `config` (JSON), `html` (stringa), `css` (stringa), `metadata`.
2. **Rendering pubblico:** Route Next.js dinamiche che pescano il documento da Appwrite e renderizzano SSR (o static generation con `revalidate`).
3. **Form submission:** I form embeddati POSTano a `/api/public/leads` che crea un contatto/deal con attribuzione.
4. **Booking:** La public booking page interroga `/api/calendar/availability` e crea eventi via `/api/calendar/events`.
5. **Analytics:** Ogni view/submit è tracciato in una collection `analytics_events` (lightweight, per reporting).

---

## Feature 1: Landing Page Builder

### Requisiti funzionali

**Admin side:**
- Lista landing pages (nome, slug, stato, views, submissions, ultima modifica).
- Crea nuova landing page da template vuoto o template predefinito.
- Editor drag-and-drop (GrapesJS o Chai Builder).
- Blocchi disponibili: Hero, Features, Testimonials, CTA Button, Form Embed, Image, Text, Divider, Footer.
- Configurazione meta: title, description, favicon, OG image.
- Preview desktop / tablet / mobile.
- Pubblica / depubblica.
- Duplica / elimina.

**Public side:**
- Route `/l/[slug]` che renderizza la landing page salvata.
- SSR per SEO (title, meta description, OG tags).
- Form embeddato funzionante (vedi Feature 2).
- Tracking pixel (invia view event a `analytics_events`).

### Data model (Appwrite)

**Collection: `landing_pages`**

```
id              string
name            string
slug            string (unique)
status          enum ["draft", "published", "archived"]
templateId      string? (ref a landing_templates)
config          json (GrapesJS project JSON o Chai Builder JSON)
html            string (rendered HTML)
css             string (rendered CSS)
metaTitle       string
metaDescription string
ogImageUrl      string?
createdBy       string (userId)
organizationId  string? (per futuro multi-tenant)
createdAt       datetime
updatedAt       datetime
```

**Collection: `landing_templates`**

```
id          string
name        string
category    enum ["blank", "saas", "local_business", "event", "lead_gen"]
config      json (template JSON)
thumbnailUrl string?
createdAt   datetime
```

**Collection: `analytics_events`**

```
id          string
eventType   enum ["page_view", "form_submit", "booking_complete", "funnel_step"]
assetType   enum ["landing", "form", "booking", "funnel"]
assetId     string
sessionId   string
ipHash      string (hashed per privacy)
userAgent   string?
referrer    string?
createdAt   datetime
```

### API endpoints

```
GET    /api/landing-pages          → lista (admin)
POST   /api/landing-pages          → crea
GET    /api/landing-pages/[id]     → dettaglio
PUT    /api/landing-pages/[id]     → aggiorna
DELETE /api/landing-pages/[id]     → elimina
POST   /api/landing-pages/[id]/publish    → pubblica
POST   /api/landing-pages/[id]/duplicate  → duplica

GET    /api/public/landing/[slug]  → fetch pubblico (SSR)
POST   /api/public/analytics       → track event (public, no auth)
```

### UI Components

- `LandingPageList` — tabella/card con metriche
- `LandingPageEditor` — wrapper GrapesJS/Chai Builder
- `LandingPagePreview` — iframe con device toggle
- `LandingPageSettings` — meta tags, slug, status
- `PublicLandingPage` — rendering SSR della pagina pubblica

### Integrazione con Forms

Nel builder, l'utente deve poter trascinare un blocco "Form" che seleziona un form da Feature 2. Al render pubblico, il blocco Form carica il form embeddato.

---

## Feature 2: Form Builder

### Requisiti funzionali

**Admin side:**
- Lista form (nome, submissions, conversion rate, embed code).
- Editor drag-and-drop per costruire form: aggiungi/rimuovi/ordina campi.
- Tipi campo: Text, Email, Phone, Textarea, Select, Checkbox, Radio, Date, Number.
- Validazione per campo (required, min, max, pattern).
- Mapping campo → campo CRM: ogni campo del form mappa a un campo Contact/Lead.
- Styling: scegliere tema (light/dark) e colori primari.
- Genera embed code (`<script>` o `<iframe>`) per siti esterni.
- Preview del form.
- Duplica / elimina.

**Public side:**
- Embed via `<script>` che monta il form React in un div target.
- Embed via `<iframe>` per siti statici.
- Route `/form/[id]` per preview diretta.
- Submit POST a `/api/public/leads` con `formId` e `landingPageId` (se presente).
- Messaggio di successo / errore configurabile.
- Redirect dopo submit opzionale (URL configurabile).

### Data model (Appwrite)

**Collection: `forms`**

```
id              string
name            string
description     string?
fields          json[] (array di field config)
style           json { theme, primaryColor, borderRadius }
successMessage  string
redirectUrl     string?
embedEnabled    boolean
status          enum ["draft", "active", "archived"]
createdBy       string
organizationId  string?
createdAt       datetime
updatedAt       datetime
```

**Field config JSON schema (esempio):**

```json
{
  "id": "fld_email_1",
  "type": "email",
  "label": "Email",
  "placeholder": "la tua email",
  "required": true,
  "crmField": "email",
  "validation": { "pattern": "^[^@]+@[^@]+$" }
}
```

**Collection: `form_submissions`**

```
id          string
formId      string
landingPageId string? (se embedded in landing)
funnelId    string? (se embedded in funnel)
contactId   string? (ref al contact creato)
data        json (valori inviati)
ipHash      string
userAgent   string?
referrer    string?
createdAt   datetime
```

### API endpoints

```
GET    /api/forms                → lista
POST   /api/forms                → crea
GET    /api/forms/[id]           → dettaglio
PUT    /api/forms/[id]           → aggiorna
DELETE /api/forms/[id]           → elimina

GET    /api/public/forms/[id]    → config pubblico (per embed)
POST   /api/public/forms/[id]/submit  → submit form
POST   /api/public/leads         → endpoint unificato (landing/form/funnel)
```

### UI Components

- `FormBuilder` — canvas drag-and-drop con `@dnd-kit`
- `FormFieldConfig` — sidebar per configurare ogni campo
- `FormPreview` — live preview del form
- `FormEmbedCode` — copia script/iframe
- `PublicForm` — componente React embeddabile

### Implementazione tecnica Embed

**Script embed:**
```html
<div id="sx-form-123"></div>
<script src="https://tuodominio.com/embed/form.js?id=123"></script>
```

Lo script carica un bundle React leggero che monta `PublicForm` nel div target.

---

## Feature 3: Public Booking Page

### Requisiti funzionali

**Admin side:**
- Lista booking links (nome, slug, utente assegnato, prenotazioni ricevute).
- Crea booking link configurando:
  - Utente/i disponibili (chi riceve la prenotazione).
  - Durata slot (15, 30, 45, 60, 90 min).
  - Giorni e orari disponibili (es. Lun-Ven 09:00-18:00).
  - Buffer prima/dopo appuntamento.
  - Numero massimo prenotazioni/giorno.
  - Messaggio di conferma.
  - Redirect dopo prenotazione.
- Preview del calendario di disponibilità.
- Duplica / elimina.

**Public side:**
- Route `/book/[slug]` con calendario settimanale.
- Mostra slot disponibili in base alla configurazione e agli eventi esistenti nel calendario.
- Selezione slot → form (nome, email, telefono, note) → conferma.
- Crea `CalendarEvent` nel calendario dell'utente assegnato.
- Manda email di conferma al prenotante e all'utente assegnato (via Resend).
- Aggiunge il prenotante come `Contact` nel CRM con `source: "booking"`.

### Data model (Appwrite)

**Collection: `booking_links`**

```
id              string
name            string
slug            string (unique)
assignedTo      string[] (userIds)
durationMinutes integer
availability    json {
  days: { mon: { start: "09:00", end: "18:00", enabled: true }, ... },
  bufferBefore: 0,
  bufferAfter: 0,
  maxPerDay: 10
}
successMessage  string
redirectUrl     string?
requireApproval boolean (default false)
status          enum ["active", "paused", "archived"]
createdBy       string
organizationId  string?
createdAt       datetime
updatedAt       datetime
```

**Collection: `booking_appointments`** (estende o referenzia `calendar_events`)

```
id              string
bookingLinkId   string
calendarEventId string
contactId       string
guestName       string
guestEmail      string
guestPhone      string?
guestNotes      string?
status          enum ["confirmed", "pending", "cancelled", "completed"]
createdAt       datetime
```

### API endpoints

```
GET    /api/booking-links           → lista
POST   /api/booking-links           → crea
GET    /api/booking-links/[id]      → dettaglio
PUT    /api/booking-links/[id]      → aggiorna
DELETE /api/booking-links/[id]      → elimina

GET    /api/public/booking/[slug]/availability?start=...&end=...
POST   /api/public/booking/[slug]/book
```

### UI Components

- `BookingLinkList` — lista con metriche
- `BookingLinkForm` — configurazione disponibilità
- `AvailabilityCalendar` — preview settimanale
- `PublicBookingPage` — calendario pubblico + form
- `BookingConfirmation` — schermata post-prenotazione

### Logica availability

1. Leggi `booking_links.availability` per sapere giorni/orari abilitati.
2. Per ogni giorno, genera slot della durata configurata.
3. Interroga `calendar_events` per lo user `assignedTo` nel range.
4. Rimuovi slot che si sovrappongono a eventi esistenti.
5. Applica bufferBefore/bufferAfter.
6. Limita a `maxPerDay` slot.

---

## Feature 4: Funnel Builder

### Requisiti funzionali

**Admin side:**
- Lista funnel (nome, slug, steps, conversion rate).
- Editor visuale per costruire sequenze di step:
  - Ogni step è una pagina (landing page reusa o custom).
  - Tra gli step si possono aggiungere condizioni (if/then).
  - Condizioni: campo form = valore, tag presente, deal stage, etc.
- Tracciamento conversion per ogni step (drop-off rate).
- Duplica / elimina.

**Public side:**
- Route `/f/[slug]/step/[stepIndex]`.
- Navigazione sequenziale tra step.
- Condizioni valutate server-side o client-side per routing dinamico.
- Ogni submit salva `funnel_sessions` e `funnel_events`.
- Alla fine del funnel, redirect a thank-you page o deal creato.

### Data model (Appwrite)

**Collection: `funnels`**

```
id              string
name            string
slug            string (unique)
steps           json[] (array di step config)
entryPageId     string (landing_page id)
thankYouPageId  string? (landing_page id)
status          enum ["draft", "active", "archived"]
createdBy       string
organizationId  string?
createdAt       datetime
updatedAt       datetime
```

**Step config JSON schema:**

```json
{
  "id": "step_1",
  "name": "Opt-in",
  "type": "landing",
  "landingPageId": "lp_123",
  "nextStepId": "step_2",
  "conditions": [
    {
      "field": "email",
      "operator": "exists",
      "trueNextStepId": "step_2",
      "falseNextStepId": "step_3"
    }
  ]
}
```

**Collection: `funnel_sessions`**

```
id          string
funnelId    string
sessionId   string (cookie/session)
contactId   string?
currentStep string
completed   boolean
abandoned   boolean
startedAt   datetime
completedAt datetime?
```

**Collection: `funnel_events`**

```
id          string
funnelId    string
sessionId   string
stepId      string
eventType   enum ["step_view", "step_submit", "step_skip", "funnel_complete", "funnel_abandon"]
data        json?
createdAt   datetime
```

### API endpoints

```
GET    /api/funnels              → lista
POST   /api/funnels              → crea
GET    /api/funnels/[id]         → dettaglio
PUT    /api/funnels/[id]         → aggiorna
DELETE /api/funnels/[id]         → elimina

GET    /api/public/funnel/[slug]         → entry step
GET    /api/public/funnel/[slug]/step/[stepId] → specific step
POST   /api/public/funnel/[slug]/step/[stepId]/submit → submit step
```

### UI Components

- `FunnelList` — lista con funnel visualization
- `FunnelEditor` — canvas per sequenza step (inspirato a Miro/Notion)
- `FunnelStepConfig` — configura landing page associata e condizioni
- `FunnelAnalytics` — drop-off per step, conversion rate
- `PublicFunnelStep` — render step pubblico

### Note implementazione

**Funnel Builder è la feature più complessa.** Per l'MVP si consiglia:
1. Step = riferimento a una landing page esistente (reuso Feature 1).
2. Condizioni = solo 1-2 operatori (`field_exists`, `field_equals`).
3. No drag-and-drop del funnel editor per MVP — lista ordinata di step con select dropdown.
4. Funnel analytics = conteggio base views/submits per step.

---

## Analytics & Attribution

### Tracking obbligatorio per ogni asset

| Asset | Eventi tracciati |
|-------|-----------------|
| Landing | `page_view`, `cta_click`, `scroll_50`, `scroll_90` |
| Form | `form_view`, `form_start`, `form_submit`, `form_field_error` |
| Booking | `booking_page_view`, `slot_select`, `booking_submit`, `booking_confirm` |
| Funnel | `funnel_start`, `step_view`, `step_submit`, `funnel_complete`, `funnel_abandon` |

### Dashboard analytics

- Views totali per asset
- Submission rate / conversion rate
- Trend giornaliero/settimanale
- Top performing assets
- Attribution: quali landing page generano più deals

**UI:** Nuova pagina `/analytics` con card e grafici (Recharts).

---

## Piano di implementazione

### Fase A — Fondamenta (Settimana 1)

**Giorno 1 — Data model + API scaffold**
- Creare collections Appwrite: `landing_pages`, `landing_templates`, `forms`, `form_submissions`, `booking_links`, `booking_appointments`, `funnels`, `funnel_sessions`, `funnel_events`, `analytics_events`.
- Creare API routes scaffold (vuote ma tipizzate).
- Aggiornare tipi TypeScript.

**Giorno 2 — Landing Page Builder (base)**
- Integrare GrapesJS (o Chai Builder) nel progetto.
- Creare pagina `/admin/landing-pages` con lista.
- Creare editor base con preview.
- Salva/carica config da Appwrite.

**Giorno 3 — Landing Page Public + Analytics**
- Route `/l/[slug]` con SSR.
- Render HTML/CSS salvato.
- Tracking `page_view` in `analytics_events`.
- Meta tags dinamici.

**Giorno 4 — Form Builder (admin)**
- Form builder drag-and-drop con `@dnd-kit`.
- Configurazione campi (tipo, label, required, mapping CRM).
- Preview form.

**Giorno 5 — Form Embed + Submit**
- Endpoint `/api/public/forms/[id]/submit`.
- Creazione contatto con `source: "form"`, `formId`, `landingPageId`.
- Generazione embed code (script + iframe).
- Integrazione blocco Form nel Landing Page Builder.

### Fase B — Conversion (Settimana 2)

**Giorno 6 — Public Booking Page**
- Configurazione booking link (disponibilità, durata, buffer).
- Endpoint availability.
- Public page `/book/[slug]` con calendario e form.
- Creazione evento calendario + contatto.
- Email conferma via Resend.

**Giorno 7 — Booking Admin + Analytics base**
- Lista booking links.
- Lista appointments.
- Dashboard analytics con Recharts (views, submissions, bookings).

**Giorno 8 — Funnel Builder MVP**
- Data model funnel + step config.
- Editor lista step (no canvas drag per MVP).
- Public funnel routing (`/f/[slug]/step/[stepId]`).
- Session tracking con cookie.

**Giorno 9 — Funnel Submit + Analytics**
- Submit per step con salvataggio dati.
- Condizioni base (field_exists).
- Funnel completion → creazione deal.
- Analytics per funnel (drop-off rate).

**Giorno 10 — Polish, Testing, Documentazione**
- TypeScript strict check pass.
- Test end-to-end:
  1. Crea landing page → pubblica → visita → vedi analytics.
  2. Crea form → embed in landing → submit → contatto creato con attribuzione.
  3. Crea booking link → prenota → evento in calendario → email inviata.
  4. Crea funnel → naviga step → submit → deal creato.
- README aggiornato.
- `IMPLEMENTATION_LOG.md` aggiornato.

---

## Definition of Done

- [x] TypeScript `npx tsc --noEmit` passa senza errori.
- [x] Landing page builder crea, edita, pubblica pagine con SSR.
- [x] Form builder crea form drag-and-drop con almeno 6 tipi campo.
- [x] Form embeddabile via script funziona su sito esterno.
- [x] Submit form crea contatto in CRM con `source` e `formId`.
- [x] Public booking page mostra disponibilità reale.
- [x] Prenotazione crea evento calendario + contatto + email conferma.
- [x] Funnel builder crea sequenza di step navigabili pubblicamente.
- [x] Ogni asset (landing/form/booking/funnel) ha analytics base (views, submissions).
- [x] Dashboard `/analytics` mostra metriche aggregate.
- [x] Nessuna feature rompe il CRM esistente.
- [x] README aggiornato con istruzioni per ogni feature.

---


### Verifica finale ? 2026-05-31

**12/12 verificati.** Il piano Fase 2 ? completato. La build non ? stata eseguita
intenzionalmente per rispettare la regola repository; il gate TypeScript equivalente
? verde con `npx tsc --noEmit`.

Decisioni MVP documentate:

- il builder landing usa blocchi tipizzati interni con `@dnd-kit` al posto di
  GrapesJS/Chai Builder, mantenendo drag-and-drop e SSR;
- il funnel usa lista ordinata di step e condizioni `exists` / `equals`, come
  mitigazione prevista dal piano;
- i booking link supportano pool di userId separati da virgola e conservano un
  guard atomico prudenziale: una prenotazione per link + slot;
- gli orari booking sono interpretati in UTC.

Comando E2E dedicato: `npm run e2e:capture` ? **7/7 passed** su Next dev +
Appwrite remoto configurato. Evidenza dettagliata in `IMPLEMENTATION_LOG.md`.

## Rischi & Mitigazioni

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| GrapesJS non si integra bene con Next.js 16 / React 19 | Media | Alto | Testare subito in Giorno 2. Fallback a Chai Builder. |
| Form embed via script confligge con siti host (CSS/JS) | Media | Medio | Usare Shadow DOM per isolamento stili. Fornire anche iframe. |
| Availability calculation lenta su calendario grande | Bassa | Medio | Cache availability per 5 min. Paginazione slot. |
| Funnel builder troppo complesso per 10 giorni | Alta | Alto | Ridurre scope funnel per MVP (lista step, no canvas, condizioni semplici). |
| Analytics senza indici su Appwrite lente | Media | Medio | Aggiungere index su `analytics_events.assetType`, `assetId`, `createdAt`. |

---

## Istruzioni operative per Claude Code

1. Leggi questo file e seguilo esattamente.
2. Inizia dalla **Fase A — Giorno 1** (Data model).
3. Non saltare giorni. Ogni giorno dipende dal precedente.
4. Se un tool esterno (GrapesJS) non funziona con il tuo stack, **documenta il problema** e passa al fallback (Chai Builder o custom).
5. Ogni feature deve avere:
   - Tipi TypeScript aggiornati
   - API route tipizzata
   - Componente UI
   - Test manuale almeno del golden path
6. Non rompere il CRM esistente. Feature nuove = pagine/route nuove, non modifiche distruttive.
7. Aggiorna `IMPLEMENTATION_LOG.md` dopo ogni giorno.
8. Se ambiguità: scegli l'opzione più semplice che funziona, documenta, continua.

**Focus:**

```
Landing Page → Form → Lead in CRM
Booking Page → Evento in Calendario
Funnel Steps → Deal in Pipeline
```

Tutto il resto è fuori scope per questa fase.
