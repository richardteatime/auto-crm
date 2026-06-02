// ---------------------------------------------------------------------------
// SarconX Workflow Builder — registry dei campi di configurazione per nodo.
// Trasforma il pannello proprietà da "JSON grezzo" a form guidati (stile Make).
//
// IMPORTANTE: le `key` dei campi corrispondono ESATTAMENTE alle config lette
// dagli executor in src/lib/workflows/handlers.ts. Non inventare chiavi nuove
// o l'automazione si configura ma non esegue.
// ---------------------------------------------------------------------------

import {
  TRIGGER_NODE_TYPES,
  TRIGGER_LABELS,
  ACTION_NODE_TYPES,
  ACTION_LABELS,
  CONDITION_NODE_TYPES,
  CONDITION_LABELS,
  DELAY_NODE_TYPES,
  DELAY_LABELS,
} from "./types";

export interface NodeField {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select";
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
}

// Sottotipi selezionabili per categoria (= node.type del grafo ReactFlow).
export const NODE_SUBTYPES: Record<string, { value: string; label: string }[]> = {
  trigger: TRIGGER_NODE_TYPES.map((t) => ({ value: t, label: TRIGGER_LABELS[t] })),
  action: ACTION_NODE_TYPES.map((t) => ({ value: t, label: ACTION_LABELS[t] })),
  condition: CONDITION_NODE_TYPES.map((t) => ({ value: t, label: CONDITION_LABELS[t] })),
  delay: DELAY_NODE_TYPES.map((t) => ({ value: t, label: DELAY_LABELS[t] })),
};

// Mappa piatta sottotipo → nome leggibile (per aggiornare data.label).
export const SUBTYPE_LABELS: Record<string, string> = {
  ...TRIGGER_LABELS,
  ...ACTION_LABELS,
  ...CONDITION_LABELS,
  ...DELAY_LABELS,
};

// Campi guidati per sottotipo. Array vuoto = nessuna configurazione richiesta.
export const NODE_FIELDS: Record<string, NodeField[]> = {
  // --- Trigger (no-op: il trigger passa solo il contesto) ---
  contact_created: [],
  deal_moved: [],
  form_submitted: [],
  booking_created: [],
  call_outcome_recorded: [],
  schedule: [],
  webhook: [],

  // --- Azioni ---
  create_contact: [
    { key: "name", label: "Nome", type: "text", placeholder: "{{trigger.payload.name}}" },
    { key: "email", label: "Email", type: "text", placeholder: "{{trigger.payload.email}}" },
    { key: "phone", label: "Telefono", type: "text" },
    { key: "company", label: "Azienda", type: "text" },
  ],
  update_contact: [
    { key: "contactId", label: "ID Contatto", type: "text", hint: "Vuoto = usa il contatto del contesto" },
    { key: "name", label: "Nome", type: "text" },
    { key: "email", label: "Email", type: "text" },
    { key: "phone", label: "Telefono", type: "text" },
    { key: "company", label: "Azienda", type: "text" },
    {
      key: "temperature",
      label: "Temperatura",
      type: "select",
      options: [
        { value: "", label: "— invariata —" },
        { value: "cold", label: "Freddo" },
        { value: "warm", label: "Tiepido" },
        { value: "hot", label: "Caldo" },
      ],
    },
    { key: "notes", label: "Note", type: "textarea" },
  ],
  create_deal: [
    { key: "title", label: "Titolo", type: "text" },
    { key: "value", label: "Valore (in centesimi)", type: "number" },
    { key: "stageId", label: "ID Stage", type: "text" },
    { key: "contactId", label: "ID Contatto", type: "text", hint: "Vuoto = usa il contatto del contesto" },
  ],
  update_deal: [
    { key: "dealId", label: "ID Deal", type: "text", hint: "Vuoto = usa il deal del contesto" },
    { key: "title", label: "Titolo", type: "text" },
    { key: "value", label: "Valore (in centesimi)", type: "number" },
    { key: "stageId", label: "ID Stage", type: "text" },
    { key: "probability", label: "Probabilità (%)", type: "number" },
  ],
  create_task: [
    { key: "title", label: "Titolo del task", type: "text" },
    { key: "description", label: "Descrizione", type: "textarea" },
    { key: "assignedTo", label: "Assegna a (ID utente)", type: "text", hint: "Vuoto = nessun assegnatario" },
  ],
  send_email: [
    { key: "to", label: "Destinatario", type: "text", placeholder: "{{trigger.payload.email}}" },
    { key: "subject", label: "Oggetto", type: "text" },
    { key: "body", label: "Corpo (HTML)", type: "textarea" },
  ],
  send_internal_message: [
    { key: "userId", label: "ID Utente", type: "text" },
    { key: "message", label: "Messaggio", type: "textarea" },
  ],
  move_pipeline_stage: [
    { key: "dealId", label: "ID Deal", type: "text", hint: "Vuoto = usa il deal del contesto" },
    { key: "stageId", label: "ID Stage di destinazione", type: "text" },
  ],

  // --- Azioni sul LEAD (pipeline call) — agiscono sul lead che ha avviato il workflow ---
  create_lead_call_task: [
    {
      key: "assignee",
      label: "Assegna la chiamata a",
      type: "select",
      options: [
        { value: "setter", label: "Cugina (setter — call a freddo)" },
        { value: "closer", label: "Leo (closer — chiusura)" },
      ],
      hint: "Crea un task chiamata per il lead, assegnato alla persona scelta.",
    },
    { key: "notes", label: "Note", type: "textarea", placeholder: "{{trigger.payload.message}}" },
  ],
  set_lead_status: [
    {
      key: "status",
      label: "Nuovo stato del lead",
      type: "select",
      options: [
        { value: "to_call", label: "Da chiamare" },
        { value: "working", label: "In lavorazione" },
        { value: "qualified", label: "Qualificato" },
        { value: "won", label: "Vinto" },
        { value: "lost", label: "Perso" },
      ],
    },
  ],
  move_lead_stage: [
    {
      key: "stage",
      label: "Fase pipeline lead",
      type: "select",
      options: [
        { value: "prospect", label: "Potenziale" },
        { value: "opportunity", label: "Opportunità" },
        { value: "contacted", label: "Contattato" },
        { value: "proposal", label: "Proposta" },
      ],
    },
  ],
  http_request: [
    {
      key: "method",
      label: "Metodo",
      type: "select",
      options: [
        { value: "GET", label: "GET" },
        { value: "POST", label: "POST" },
        { value: "PUT", label: "PUT" },
        { value: "DELETE", label: "DELETE" },
      ],
    },
    { key: "url", label: "URL", type: "text", placeholder: "https://..." },
    { key: "body", label: "Body", type: "textarea" },
  ],

  // --- Condizioni (i rami Sì/No si impostano collegando le uscite del nodo) ---
  if_field_equals: [
    { key: "field", label: "Campo da controllare", type: "text", placeholder: "es. email" },
    { key: "compareValue", label: "È uguale a", type: "text", placeholder: "valore atteso" },
  ],
  if_field_exists: [
    { key: "field", label: "Campo da controllare", type: "text", placeholder: "es. email" },
  ],
  if_field_in: [
    { key: "field", label: "Campo da controllare", type: "text", placeholder: "es. outcomeLabel" },
    {
      key: "values",
      label: "Valori ammessi (separati da virgola)",
      type: "text",
      placeholder: "Qualificato, Interessato, Vuole preventivo",
      hint: "Per l'esito chiamata usa le etichette italiane: Qualificato, Non qualificato, Nessuna risposta, Richiamare, Numero errato, Interessato, Non interessato, Vuole preventivo.",
    },
  ],
  if_score_above: [{ key: "threshold", label: "Score maggiore di", type: "number" }],
  if_has_tag: [{ key: "tag", label: "Ha il tag", type: "text" }],
  if_stage_is: [{ key: "stage", label: "Lo stage è", type: "text" }],

  // --- Attese ---
  wait_for: [
    { key: "amount", label: "Quantità", type: "number" },
    {
      key: "unit",
      label: "Unità",
      type: "select",
      options: [
        { value: "minutes", label: "Minuti" },
        { value: "hours", label: "Ore" },
        { value: "days", label: "Giorni" },
      ],
    },
  ],
  wait_until: [
    {
      key: "dayOfWeek",
      label: "Giorno",
      type: "select",
      options: [
        { value: "-1", label: "Oggi" },
        { value: "1", label: "Lunedì" },
        { value: "2", label: "Martedì" },
        { value: "3", label: "Mercoledì" },
        { value: "4", label: "Giovedì" },
        { value: "5", label: "Venerdì" },
        { value: "6", label: "Sabato" },
        { value: "0", label: "Domenica" },
      ],
    },
    { key: "hour", label: "Ora (0-23)", type: "number" },
    { key: "minute", label: "Minuto (0-59)", type: "number" },
  ],
};
