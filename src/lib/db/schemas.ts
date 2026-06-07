import { z } from "zod";
import { docSchema } from "./parse-doc";

// ---------------------------------------------------------------------------
// Core CRM entities — validated at runtime instead of blind `as T` casts.
// Appwrite always returns defined attributes (even if null), so we use
// `.nullable()` without `.optional()` for known fields. `.optional()` is
// reserved for fields that may genuinely be missing (e.g. schema additions).
// ---------------------------------------------------------------------------

export const ContactSchema = docSchema({
  name: z.string().min(1),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  company: z.string().nullable(),
  vatNumber: z.string().nullable(),
  address: z.string().nullable(),
  source: z.string(),
  temperature: z.enum(["cold", "warm", "hot"]),
  notes: z.string().nullable(),
});

export const PipelineStageSchema = docSchema({
  name: z.string(),
  order: z.number(),
  color: z.string(),
  isWon: z.boolean(),
  isLost: z.boolean(),
});

export const DealSchema = docSchema({
  title: z.string(),
  value: z.number(),
  stageId: z.string(),
  contactId: z.string(),
  expectedClose: z.string().nullable().optional(),
  probability: z.number(),
  notes: z.string().nullable(),
  attachments: z.string().nullable().optional(),
  billingType: z.enum(["una_tantum", "mensile", "annuale"]).optional(),
  recurringMonths: z.number().nullable().optional(),
  recurringStartDate: z.string().nullable().optional(),
  wonAt: z.string().nullable().optional(),
  isPaid: z.boolean().optional(),
  contactName: z.string().nullable().optional(),
  contactTemperature: z.string().nullable().optional(),
  stageName: z.string().nullable().optional(),
  stageColor: z.string().nullable().optional(),
});

export const ActivitySchema = docSchema({
  type: z.enum(["call", "email", "meeting", "note", "follow_up"]),
  description: z.string(),
  contactId: z.string(),
  dealId: z.string().nullable(),
  startAt: z.string().nullable().optional(),
  endAt: z.string().nullable().optional(),
  notes: z.string().nullable(),
  attachments: z.string().nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  isCompleted: z.boolean().optional(),
  contactName: z.string().nullable().optional(),
});

export const QuoteSchema = docSchema({
  dealId: z.string(),
  number: z.string(),
  title: z.string(),
  items: z.string(),
  notes: z.string().nullable(),
  generatedText: z.string().nullable(),
  status: z.enum(["bozza", "inviato", "accettato", "rifiutato"]),
  vatRate: z.number(),
  validUntil: z.string().nullable().optional(),
});

export const LeadSchema = docSchema({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  fullName: z.string(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  company: z.string().nullable(),
  businessName: z.string().nullable(),
  website: z.string().nullable(),
  projectType: z.string().nullable(),
  category: z.enum(["static_website", "webapp", "crm", "automation", "other", "unknown"]),
  source: z.string(),
  formName: z.string().nullable(),
  message: z.string().nullable(),
  rawSubject: z.string().nullable(),
  rawBody: z.string().nullable(),
  customFields: z.string().nullable(),
  status: z.enum(["new", "to_call", "working", "qualified", "lost", "won"]),
  pipelineStage: z.enum(["prospect", "opportunity", "contacted", "proposal"]),
  assignedTo: z.string().nullable(),
  leadScore: z.number(),
  contactId: z.string().nullable(),
  landingPageId: z.string().nullable().optional(),
  formId: z.string().nullable().optional(),
  funnelId: z.string().nullable().optional(),
  bookingLinkId: z.string().nullable().optional(),
});

export const CallTaskSchema = docSchema({
  leadId: z.string(),
  assignedTo: z.string(),
  assigneeName: z.string().nullable(),
  status: z.enum(["pending", "scheduled", "completed", "failed", "no_answer", "reschedule", "not_interested", "qualified"]),
  scheduledAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  callOutcome: z.enum(["qualified", "not_qualified", "no_answer", "call_later", "wrong_number", "interested", "not_interested", "needs_quote"]).nullable(),
  notes: z.string().nullable(),
});

export const WorkflowSchema = docSchema({
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(["draft", "active", "paused", "archived"]),
  triggerType: z.string(),
  triggerConfig: z.string(),
  nodes: z.string(),
  edges: z.string(),
  createdBy: z.string().nullable(),
});
