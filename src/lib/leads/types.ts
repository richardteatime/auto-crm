// ---------------------------------------------------------------------------
// Lead Pipeline Automation MVP — core types
// ---------------------------------------------------------------------------

export type LeadCategory =
  | "static_website"
  | "webapp"
  | "crm"
  | "automation"
  | "other"
  | "unknown";

export const LEAD_CATEGORIES: LeadCategory[] = [
  "static_website",
  "webapp",
  "crm",
  "automation",
  "other",
  "unknown",
];

export type LeadPipelineStage =
  | "prospect"
  | "opportunity"
  | "contacted"
  | "proposal";

export const LEAD_PIPELINE_STAGES: LeadPipelineStage[] = [
  "prospect",
  "opportunity",
  "contacted",
  "proposal",
];

export type LeadStatus =
  | "new"
  | "to_call"
  | "working"
  | "qualified"
  | "lost"
  | "won";

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "to_call",
  "working",
  "qualified",
  "lost",
  "won",
];

export type LeadScoreBand = "hot" | "medium" | "weak";

export interface Lead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  businessName: string | null;
  website: string | null;
  projectType: string | null;
  category: LeadCategory;
  source: string;
  formName: string | null;
  message: string | null;
  rawSubject: string | null;
  rawBody: string | null;
  customFields: string | null; // JSON string
  status: LeadStatus;
  pipelineStage: LeadPipelineStage;
  assignedTo: string | null;
  leadScore: number;
  contactId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Pipeline movements
// ---------------------------------------------------------------------------

export interface PipelineMovement {
  id: string;
  leadId: string;
  fromStage: string | null;
  toStage: string;
  reason: string | null;
  triggeredBy: string; // "system" | "user" | "automation" | userId
  metadata: string | null; // JSON
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Automation rules + runs
// ---------------------------------------------------------------------------

export type AutomationTrigger =
  | "lead_created"
  | "stage_changed_to_prospect"
  | "stage_changed_to_opportunity"
  | "stage_changed_to_contacted"
  | "stage_changed_to_proposal"
  | "call_task_created"
  | "call_completed"
  | "quote_requested"
  | "quote_generated";

export const AUTOMATION_TRIGGERS: AutomationTrigger[] = [
  "lead_created",
  "stage_changed_to_prospect",
  "stage_changed_to_opportunity",
  "stage_changed_to_contacted",
  "stage_changed_to_proposal",
  "call_task_created",
  "call_completed",
  "quote_requested",
  "quote_generated",
];

export type AutomationRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "partial";

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: AutomationTrigger;
  pipelineStage: string | null;
  leadCategory: string | null;
  conditions: string | null; // JSON
  actions: string | null; // JSON array of action names
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationRun {
  id: string;
  ruleId: string | null;
  leadId: string;
  triggerType: AutomationTrigger;
  status: AutomationRunStatus;
  actionsExecuted: string | null; // JSON array
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Call tasks
// ---------------------------------------------------------------------------

export type CallTaskStatus =
  | "pending"
  | "scheduled"
  | "completed"
  | "failed"
  | "no_answer"
  | "reschedule"
  | "not_interested"
  | "qualified";

export type CallOutcome =
  | "qualified"
  | "not_qualified"
  | "no_answer"
  | "call_later"
  | "wrong_number"
  | "interested"
  | "not_interested"
  | "needs_quote";

export const CALL_OUTCOMES: CallOutcome[] = [
  "qualified",
  "not_qualified",
  "no_answer",
  "call_later",
  "wrong_number",
  "interested",
  "not_interested",
  "needs_quote",
];

export interface CallTask {
  id: string;
  leadId: string;
  assignedTo: string;
  assigneeName: string | null;
  status: CallTaskStatus;
  scheduledAt: Date | null;
  completedAt: Date | null;
  callOutcome: CallOutcome | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Lead quotes (draft)
// ---------------------------------------------------------------------------

export type LeadQuoteStatus = "draft" | "approved" | "sent" | "rejected";

export interface LeadQuoteItem {
  label: string;
  amount: number; // cents
}

export interface LeadQuote {
  id: string;
  leadId: string;
  status: LeadQuoteStatus;
  category: LeadCategory;
  amountSuggested: number; // cents
  items: string; // JSON array of LeadQuoteItem
  summary: string | null;
  generatedText: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Parser output
// ---------------------------------------------------------------------------

export interface ParsedLead {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  businessName?: string | null;
  website?: string | null;
  projectType?: string | null;
  category?: LeadCategory;
  budget?: string | null;
  message?: string | null;
  customFields: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Display labels (Italian)
// ---------------------------------------------------------------------------

export const STAGE_LABELS: Record<LeadPipelineStage, string> = {
  prospect: "Prospect",
  opportunity: "Opportunity",
  contacted: "Contacted",
  proposal: "Proposal",
};

export const STAGE_COLORS: Record<LeadPipelineStage, string> = {
  prospect: "#64748b",
  opportunity: "#2563eb",
  contacted: "#8b5cf6",
  proposal: "#16a34a",
};

export const CATEGORY_LABELS: Record<LeadCategory, string> = {
  static_website: "Sito statico",
  webapp: "Webapp",
  crm: "CRM",
  automation: "Automazione",
  other: "Altro",
  unknown: "Da classificare",
};

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nuovo",
  to_call: "Da chiamare",
  working: "In lavorazione",
  qualified: "Qualificato",
  lost: "Perso",
  won: "Vinto",
};

export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  qualified: "Qualificato",
  not_qualified: "Non qualificato",
  no_answer: "Nessuna risposta",
  call_later: "Richiamare",
  wrong_number: "Numero errato",
  interested: "Interessato",
  not_interested: "Non interessato",
  needs_quote: "Vuole preventivo",
};
