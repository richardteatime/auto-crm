// ---------------------------------------------------------------------------
// SarconX Visual Workflow Builder (FASE 3) — core types
//
// Covers: Workflow Editor, Node Registry, Executor Engine, Scheduler.
// Every workflow is stored as a ReactFlow-compatible JSON graph.
// ---------------------------------------------------------------------------

export type WorkflowStatus = "draft" | "active" | "paused" | "archived";
export type RunStatus = "running" | "scheduled" | "completed" | "failed" | "cancelled";
export type LogStatus = "ok" | "skipped" | "failed" | "pending";
export type ScheduledStatus = "pending" | "processing" | "completed" | "cancelled";

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  draft: "Bozza",
  active: "Attivo",
  paused: "In pausa",
  archived: "Archiviato",
};

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  running: "In esecuzione",
  scheduled: "Schedulato",
  completed: "Completato",
  failed: "Fallito",
  cancelled: "Annullato",
};

// ===========================================================================
// ReactFlow-compatible serializable shapes (saved in Appwrite)
// ===========================================================================

export interface FlowNodeData {
  nodeType: string; // registry type id (e.g. "send_email")
  label: string;
  config: Record<string, unknown>;
}

export interface FlowNode {
  id: string;
  type: "trigger" | "action" | "condition" | "delay" | "integration";
  position: { x: number; y: number };
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string; // e.g. "true" / "false" for conditions
  type?: "smoothstep" | "default";
  sourceHandle?: string; // ReactFlow handle id (e.g. "true"/"false")
  targetHandle?: string;
}


// ===========================================================================
// Appwrite entities
// ===========================================================================

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  triggerType: string;
  triggerConfig: string; // JSON
  nodes: string; // JSON of FlowNode[]
  edges: string; // JSON of FlowEdge[]
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  triggerType: string;
  triggerPayload: string; // JSON
  status: RunStatus;
  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
  createdAt: Date;
}

export interface WorkflowRunLog {
  id: string;
  runId: string;
  nodeId: string;
  nodeType: string;
  status: LogStatus;
  input: string | null; // JSON
  output: string | null; // JSON
  error: string | null;
  executedAt: Date;
}

export interface WorkflowScheduled {
  id: string;
  workflowId: string;
  runId: string;
  nodeId: string;
  executeAt: Date;
  payload: string; // JSON (execution context)
  status: ScheduledStatus;
  createdAt: Date;
}

// ===========================================================================
// Node Registry
// ===========================================================================

export type NodeCategory = "trigger" | "action" | "condition" | "delay" | "integration";

export interface NodePort {
  id: string;
  label: string;
}

export interface WorkflowNodeDefinition {
  type: string;
  category: NodeCategory;
  label: string;
  description: string;
  icon: string; // lucide icon name
  color: string; // tailwind color class or hex
  inputs: NodePort[];
  outputs: NodePort[];
  configSchema?: Record<string, unknown>; // simplified; real validation done in UI forms
  executor: NodeExecutor;
}

export interface ExecutionContext {
  trigger: { type: string; payload: unknown };
  variables: Record<string, unknown>;
  contactId?: string;
  dealId?: string;
  leadId?: string;
}

export interface NodeExecutorInput {
  nodeId: string;
  nodeType: string;
  config: Record<string, unknown>;
  context: ExecutionContext;
}

export interface NodeExecutorOutput {
  status: "ok" | "skipped" | "failed";
  output?: Record<string, unknown>;
  error?: string;
  nextNodeId?: string; // for condition branching
}

export type NodeExecutor = (input: NodeExecutorInput) => Promise<NodeExecutorOutput>;

// ===========================================================================
// Trigger types
// ===========================================================================

export type TriggerNodeType =
  | "contact_created"
  | "deal_moved"
  | "form_submitted"
  | "booking_created"
  | "call_outcome_recorded"
  | "schedule"
  | "webhook";

export const TRIGGER_NODE_TYPES: TriggerNodeType[] = [
  "contact_created",
  "deal_moved",
  "form_submitted",
  "booking_created",
  "call_outcome_recorded",
  "schedule",
  "webhook",
];

export const TRIGGER_LABELS: Record<TriggerNodeType, string> = {
  contact_created: "Contatto Creato",
  deal_moved: "Deal Spostato",
  form_submitted: "Form Inviato",
  booking_created: "Prenotazione Creata",
  call_outcome_recorded: "Esito Chiamata Registrato",
  schedule: "Schedule (Timer)",
  webhook: "Webhook Inbound",
};

// ===========================================================================
// Action types
// ===========================================================================

export type ActionNodeType =
  | "create_contact"
  | "update_contact"
  | "create_deal"
  | "update_deal"
  | "create_task"
  | "send_email"
  | "send_internal_message"
  | "move_pipeline_stage"
  | "create_lead_call_task"
  | "set_lead_status"
  | "move_lead_stage"
  | "http_request";

export const ACTION_NODE_TYPES: ActionNodeType[] = [
  "create_contact",
  "update_contact",
  "create_deal",
  "update_deal",
  "create_task",
  "send_email",
  "send_internal_message",
  "move_pipeline_stage",
  "create_lead_call_task",
  "set_lead_status",
  "move_lead_stage",
  "http_request",
];

export const ACTION_LABELS: Record<ActionNodeType, string> = {
  create_contact: "Crea Contatto",
  update_contact: "Aggiorna Contatto",
  create_deal: "Crea Deal",
  update_deal: "Aggiorna Deal",
  create_task: "Crea Task",
  send_email: "Invia Email",
  send_internal_message: "Invia Messaggio Interno",
  move_pipeline_stage: "Sposta in Pipeline",
  create_lead_call_task: "Crea Call Task (lead)",
  set_lead_status: "Cambia Stato Lead",
  move_lead_stage: "Sposta Fase Lead",
  http_request: "HTTP Request",
};

// ===========================================================================
// Condition types
// ===========================================================================

export type ConditionNodeType =
  | "if_field_equals"
  | "if_field_exists"
  | "if_field_in"
  | "if_score_above"
  | "if_has_tag"
  | "if_stage_is";

export const CONDITION_NODE_TYPES: ConditionNodeType[] = [
  "if_field_equals",
  "if_field_exists",
  "if_field_in",
  "if_score_above",
  "if_has_tag",
  "if_stage_is",
];

export const CONDITION_LABELS: Record<ConditionNodeType, string> = {
  if_field_equals: "Se campo = valore",
  if_field_exists: "Se campo compilato",
  if_field_in: "Se campo è uno tra",
  if_score_above: "Se score > X",
  if_has_tag: "Se ha tag",
  if_stage_is: "Se stage è",
};

// ===========================================================================
// Delay types
// ===========================================================================

export type DelayNodeType = "wait_for" | "wait_until";

export const DELAY_NODE_TYPES: DelayNodeType[] = ["wait_for", "wait_until"];

export const DELAY_LABELS: Record<DelayNodeType, string> = {
  wait_for: "Attendi per",
  wait_until: "Attendi fino a",
};

export function getNodeCategory(nodeType: string): NodeCategory | undefined {
  if (TRIGGER_NODE_TYPES.includes(nodeType as TriggerNodeType)) return "trigger";
  if (ACTION_NODE_TYPES.includes(nodeType as ActionNodeType)) return "action";
  if (CONDITION_NODE_TYPES.includes(nodeType as ConditionNodeType)) return "condition";
  if (DELAY_NODE_TYPES.includes(nodeType as DelayNodeType)) return "delay";
  return undefined;
}

export const NODE_TYPE_LABELS: Record<string, string> = {
  ...TRIGGER_LABELS,
  ...ACTION_LABELS,
  ...CONDITION_LABELS,
  ...DELAY_LABELS,
};

// ===========================================================================
// Display helpers
// ===========================================================================

export const NODE_CATEGORY_COLORS: Record<NodeCategory, string> = {
  trigger: "#22c55e",
  action: "#3b82f6",
  condition: "#eab308",
  delay: "#a855f7",
  integration: "#f97316",
};

export const NODE_CATEGORY_LABELS: Record<NodeCategory, string> = {
  trigger: "Trigger",
  action: "Azione",
  condition: "Condizione",
  delay: "Attesa",
  integration: "Integrazione",
};
