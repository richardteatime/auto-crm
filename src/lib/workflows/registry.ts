import type { WorkflowNodeDefinition } from "./types";
import {
  triggerExecutor,
  createContactExecutor,
  updateContactExecutor,
  createDealExecutor,
  updateDealExecutor,
  createTaskExecutor,
  sendEmailExecutor,
  sendInternalMessageExecutor,
  movePipelineStageExecutor,
  createLeadCallTaskExecutor,
  setLeadStatusExecutor,
  moveLeadStageExecutor,
  httpRequestExecutor,
  ifFieldEqualsExecutor,
  ifFieldExistsExecutor,
  ifFieldInExecutor,
  ifScoreAboveExecutor,
  ifHasTagExecutor,
  ifStageIsExecutor,
  waitForExecutor,
  waitUntilExecutor,
} from "./handlers";

export const NODE_REGISTRY: Record<string, WorkflowNodeDefinition> = {};

export function registerNode(definition: WorkflowNodeDefinition): void {
  NODE_REGISTRY[definition.type] = definition;
}

export function getNodeDefinition(type: string): WorkflowNodeDefinition | undefined {
  return NODE_REGISTRY[type];
}

export function getAllNodeDefinitions(): WorkflowNodeDefinition[] {
  return Object.values(NODE_REGISTRY);
}

// ===========================================================================
// Trigger nodes
// ===========================================================================

registerNode({
  type: "contact_created",
  category: "trigger",
  label: "Contatto Creato",
  description: "Si attiva quando un contatto viene creato nel CRM",
  icon: "UserPlus",
  color: "#22c55e",
  inputs: [],
  outputs: [{ id: "out", label: "Successo" }],
  executor: triggerExecutor,
});

registerNode({
  type: "deal_moved",
  category: "trigger",
  label: "Deal Spostato",
  description: "Si attiva quando un deal cambia stage",
  icon: "ArrowRightLeft",
  color: "#22c55e",
  inputs: [],
  outputs: [{ id: "out", label: "Successo" }],
  executor: triggerExecutor,
});

registerNode({
  type: "form_submitted",
  category: "trigger",
  label: "Form Inviato",
  description: "Si attiva quando un form viene inviato",
  icon: "FileInput",
  color: "#22c55e",
  inputs: [],
  outputs: [{ id: "out", label: "Successo" }],
  executor: triggerExecutor,
});

registerNode({
  type: "booking_created",
  category: "trigger",
  label: "Prenotazione Creata",
  description: "Si attiva quando viene creata una prenotazione",
  icon: "CalendarPlus",
  color: "#22c55e",
  inputs: [],
  outputs: [{ id: "out", label: "Successo" }],
  executor: triggerExecutor,
});

registerNode({
  type: "call_outcome_recorded",
  category: "trigger",
  label: "Esito Chiamata Registrato",
  description: "Si attiva quando viene registrato l'esito di una chiamata (call task)",
  icon: "PhoneOutgoing",
  color: "#22c55e",
  inputs: [],
  outputs: [{ id: "out", label: "Successo" }],
  executor: triggerExecutor,
});

registerNode({
  type: "schedule",
  category: "trigger",
  label: "Schedule (Timer)",
  description: "Si attiva in base a una schedulazione temporale",
  icon: "Clock",
  color: "#22c55e",
  inputs: [],
  outputs: [{ id: "out", label: "Successo" }],
  executor: triggerExecutor,
});

registerNode({
  type: "webhook",
  category: "trigger",
  label: "Webhook Inbound",
  description: "Si attiva quando riceve una chiamata webhook",
  icon: "Webhook",
  color: "#22c55e",
  inputs: [],
  outputs: [{ id: "out", label: "Successo" }],
  executor: triggerExecutor,
});

// ===========================================================================
// Action nodes
// ===========================================================================

registerNode({
  type: "create_contact",
  category: "action",
  label: "Crea Contatto",
  description: "Crea un nuovo contatto nel CRM",
  icon: "UserPlus",
  color: "#3b82f6",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [{ id: "out", label: "Successo" }],
  executor: createContactExecutor,
});

registerNode({
  type: "update_contact",
  category: "action",
  label: "Aggiorna Contatto",
  description: "Aggiorna un contatto esistente",
  icon: "UserCog",
  color: "#3b82f6",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [{ id: "out", label: "Successo" }],
  executor: updateContactExecutor,
});

registerNode({
  type: "create_deal",
  category: "action",
  label: "Crea Deal",
  description: "Crea un nuovo deal nel CRM",
  icon: "Briefcase",
  color: "#3b82f6",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [{ id: "out", label: "Successo" }],
  executor: createDealExecutor,
});

registerNode({
  type: "update_deal",
  category: "action",
  label: "Aggiorna Deal",
  description: "Aggiorna un deal esistente",
  icon: "Briefcase",
  color: "#3b82f6",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [{ id: "out", label: "Successo" }],
  executor: updateDealExecutor,
});

registerNode({
  type: "create_task",
  category: "action",
  label: "Crea Task",
  description: "Crea un nuovo task nel CRM",
  icon: "CheckSquare",
  color: "#3b82f6",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [{ id: "out", label: "Successo" }],
  executor: createTaskExecutor,
});

registerNode({
  type: "send_email",
  category: "action",
  label: "Invia Email",
  description: "Invia un'email tramite Resend",
  icon: "Mail",
  color: "#3b82f6",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [{ id: "out", label: "Successo" }],
  executor: sendEmailExecutor,
});

registerNode({
  type: "send_internal_message",
  category: "action",
  label: "Invia Messaggio Interno",
  description: "Invia una notifica interna nel CRM",
  icon: "MessageSquare",
  color: "#3b82f6",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [{ id: "out", label: "Successo" }],
  executor: sendInternalMessageExecutor,
});

registerNode({
  type: "move_pipeline_stage",
  category: "action",
  label: "Sposta in Pipeline",
  description: "Sposta un deal in uno stage diverso",
  icon: "ArrowRightLeft",
  color: "#3b82f6",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [{ id: "out", label: "Successo" }],
  executor: movePipelineStageExecutor,
});

registerNode({
  type: "create_lead_call_task",
  category: "action",
  label: "Crea Call Task (lead)",
  description: "Crea un task chiamata per il lead, assegnato alla setter (Cugina) o al closer (Leo)",
  icon: "PhoneCall",
  color: "#3b82f6",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [{ id: "out", label: "Successo" }],
  executor: createLeadCallTaskExecutor,
});

registerNode({
  type: "set_lead_status",
  category: "action",
  label: "Cambia Stato Lead",
  description: "Imposta lo stato del lead (da chiamare, qualificato, vinto, perso…)",
  icon: "Flag",
  color: "#3b82f6",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [{ id: "out", label: "Successo" }],
  executor: setLeadStatusExecutor,
});

registerNode({
  type: "move_lead_stage",
  category: "action",
  label: "Sposta Fase Lead",
  description: "Sposta il lead in un'altra fase della pipeline (prospect, opportunity…)",
  icon: "Workflow",
  color: "#3b82f6",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [{ id: "out", label: "Successo" }],
  executor: moveLeadStageExecutor,
});

registerNode({
  type: "http_request",
  category: "integration",
  label: "HTTP Request",
  description: "Effettua una chiamata HTTP esterna",
  icon: "Globe",
  color: "#f97316",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [{ id: "out", label: "Successo" }],
  executor: httpRequestExecutor,
});

// ===========================================================================
// Condition nodes
// ===========================================================================

registerNode({
  type: "if_field_equals",
  category: "condition",
  label: "Se campo = valore",
  description: "Verifica se un campo è uguale a un valore",
  icon: "GitBranch",
  color: "#eab308",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [
    { id: "true", label: "Vero" },
    { id: "false", label: "Falso" },
  ],
  executor: ifFieldEqualsExecutor,
});

registerNode({
  type: "if_field_exists",
  category: "condition",
  label: "Se campo compilato",
  description: "Verifica se un campo è stato compilato (non vuoto)",
  icon: "GitBranch",
  color: "#eab308",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [
    { id: "true", label: "Vero" },
    { id: "false", label: "Falso" },
  ],
  executor: ifFieldExistsExecutor,
});

registerNode({
  type: "if_field_in",
  category: "condition",
  label: "Se campo è uno tra",
  description: "Verifica se un campo è uguale a uno dei valori elencati (separati da virgola)",
  icon: "GitBranch",
  color: "#eab308",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [
    { id: "true", label: "Vero" },
    { id: "false", label: "Falso" },
  ],
  executor: ifFieldInExecutor,
});

registerNode({
  type: "if_score_above",
  category: "condition",
  label: "Se score > X",
  description: "Verifica se lo score è superiore a una soglia",
  icon: "TrendingUp",
  color: "#eab308",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [
    { id: "true", label: "Vero" },
    { id: "false", label: "Falso" },
  ],
  executor: ifScoreAboveExecutor,
});

registerNode({
  type: "if_has_tag",
  category: "condition",
  label: "Se ha tag",
  description: "Verifica se il contatto ha un determinato tag",
  icon: "Tag",
  color: "#eab308",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [
    { id: "true", label: "Vero" },
    { id: "false", label: "Falso" },
  ],
  executor: ifHasTagExecutor,
});

registerNode({
  type: "if_stage_is",
  category: "condition",
  label: "Se stage è",
  description: "Verifica se lo stage corrente è quello atteso",
  icon: "MapPin",
  color: "#eab308",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [
    { id: "true", label: "Vero" },
    { id: "false", label: "Falso" },
  ],
  executor: ifStageIsExecutor,
});

// ===========================================================================
// Delay nodes
// ===========================================================================

registerNode({
  type: "wait_for",
  category: "delay",
  label: "Attendi per",
  description: "Attendi per un determinato periodo di tempo",
  icon: "Timer",
  color: "#a855f7",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [{ id: "out", label: "Successo" }],
  executor: waitForExecutor,
});

registerNode({
  type: "wait_until",
  category: "delay",
  label: "Attendi fino a",
  description: "Attendi fino a un giorno/ora specifica",
  icon: "CalendarClock",
  color: "#a855f7",
  inputs: [{ id: "in", label: "Ingresso" }],
  outputs: [{ id: "out", label: "Successo" }],
  executor: waitUntilExecutor,
});
