import {
  createContact,
  updateContact,
  findContactByEmailOrPhone,
  createDeal,
  updateDeal,
  createTask,
  createNotification,
  getStages,
  createOpenCallTaskIfMissing,
  getLead,
  updateLead,
} from "@/lib/db";
import { sendEmail, isEmailConfigured } from "@/lib/leads/automation/adapters/email";
import type { LeadStatus, LeadPipelineStage } from "@/lib/leads/types";
import type {
  NodeExecutor,
  ExecutionContext,
  NodeExecutorOutput,
} from "@/lib/workflows/types";
import { createWorkflowScheduled } from "@/lib/db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveVariable(path: string, ctx: ExecutionContext): unknown {
  if (path.startsWith("{{") && path.endsWith("}}")) {
    const inner = path.slice(2, -2).trim();
    const parts = inner.split(".");
    let value: unknown = ctx;
    for (const part of parts) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return value;
  }
  return path;
}

function interpolateString(template: string, ctx: ExecutionContext): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, path) => {
    const value = resolveVariable(`{{${path}}}`, ctx);
    if (value === undefined) {
      console.warn(`[workflow] Variabile mancante: {{${path}}}`);
      return "";
    }
    return String(value);
  });
}

function ok(output?: Record<string, unknown>): NodeExecutorOutput {
  return { status: "ok", output };
}

function skip(reason?: string): NodeExecutorOutput {
  return { status: "skipped", error: reason };
}

function fail(error: string): NodeExecutorOutput {
  return { status: "failed", error };
}

// ---------------------------------------------------------------------------
// Trigger executor (no-op, just passes context through)
// ---------------------------------------------------------------------------

export const triggerExecutor: NodeExecutor = async ({ context }) => {
  return ok({ triggerType: context.trigger.type });
};

// ---------------------------------------------------------------------------
// Action executors
// ---------------------------------------------------------------------------

export const createContactExecutor: NodeExecutor = async ({ config, context, dryRun }) => {
  if (dryRun) return ok({ simulated: true, action: "create_contact" });
  const name = interpolateString(String(config.name ?? ""), context);
  const email = interpolateString(String(config.email ?? ""), context);
  const phone = interpolateString(String(config.phone ?? ""), context);
  const company = interpolateString(String(config.company ?? ""), context);

  if (!name && !email) return fail("Nome o email richiesti");

  try {
    // Check for duplicate by email
    const existing = email ? await findContactByEmailOrPhone({ email }) : null;
    if (existing) {
      context.contactId = existing.id;
      context.variables.contactId = existing.id;
      return ok({ contactId: existing.id, created: false });
    }

    const contact = await createContact({
      name,
      email: email || null,
      phone: phone || null,
      company: company || null,
      source: "workflow",
      temperature: "warm",
      notes: "",
    });
    context.contactId = contact.id;
    context.variables.contactId = contact.id;
    return ok({ contactId: contact.id, created: true });
  } catch (e) {
    return fail(String(e));
  }
};

export const updateContactExecutor: NodeExecutor = async ({ config, context, dryRun }) => {
  if (dryRun) return ok({ simulated: true, action: "update_contact" });
  const contactId = String(config.contactId ?? context.contactId ?? "");
  if (!contactId) return fail("ContactId mancante");

  try {
    const updates: Record<string, unknown> = {};
    if (config.name) updates.name = interpolateString(String(config.name), context);
    if (config.email) updates.email = interpolateString(String(config.email), context);
    if (config.phone) updates.phone = interpolateString(String(config.phone), context);
    if (config.company) updates.company = interpolateString(String(config.company), context);
    if (config.temperature) updates.temperature = config.temperature;
    if (config.notes) updates.notes = interpolateString(String(config.notes), context);

    const updated = await updateContact(contactId, updates);
    return ok({ contactId: updated.id });
  } catch (e) {
    return fail(String(e));
  }
};

export const createDealExecutor: NodeExecutor = async ({ config, context, dryRun }) => {
  if (dryRun) return ok({ simulated: true, action: "create_deal" });
  const title = interpolateString(String(config.title ?? ""), context);
  const value = Number(config.value ?? 0);
  const stageId = String(config.stageId ?? "");
  const contactId = String(config.contactId ?? context.contactId ?? "");

  if (!title) return fail("Titolo deal richiesto");
  if (!contactId) return fail("ContactId richiesto");

  try {
    const deal = await createDeal({
      title,
      value,
      stageId,
      contactId,
      probability: 0,
    });
    context.dealId = deal.id;
    context.variables.dealId = deal.id;
    return ok({ dealId: deal.id });
  } catch (e) {
    return fail(String(e));
  }
};

export const updateDealExecutor: NodeExecutor = async ({ config, context, dryRun }) => {
  if (dryRun) return ok({ simulated: true, action: "update_deal" });
  const dealId = String(config.dealId ?? context.dealId ?? "");
  if (!dealId) return fail("DealId mancante");

  try {
    const updates: Record<string, unknown> = {};
    if (config.title) updates.title = interpolateString(String(config.title), context);
    if (config.value !== undefined) updates.value = Number(config.value);
    if (config.stageId) updates.stageId = config.stageId;
    if (config.probability !== undefined) updates.probability = Number(config.probability);

    const updated = await updateDeal(dealId, updates);
    return ok({ dealId: updated.id });
  } catch (e) {
    return fail(String(e));
  }
};

export const createTaskExecutor: NodeExecutor = async ({ config, context, dryRun }) => {
  if (dryRun) return ok({ simulated: true, action: "create_task" });
  const title = interpolateString(String(config.title ?? ""), context);
  const description = interpolateString(String(config.description ?? ""), context);
  const assignedTo = String(config.assignedTo ?? "");

  if (!title) return fail("Titolo task richiesto");

  try {
    const task = await createTask({
      title,
      description: description || undefined,
      assignedTo: assignedTo || undefined,
      dueAt: null,
    });
    return ok({ taskId: task.id });
  } catch (e) {
    return fail(String(e));
  }
};

export const sendEmailExecutor: NodeExecutor = async ({ config, context, dryRun }) => {
  if (dryRun) return ok({ simulated: true, action: "send_email" });
  const to = interpolateString(String(config.to ?? ""), context);
  const subject = interpolateString(String(config.subject ?? ""), context);
  const body = interpolateString(String(config.body ?? ""), context);

  if (!to) return fail("Destinatario richiesto");
  if (!isEmailConfigured()) return skip("Email non configurata");

  try {
    const result = await sendEmail({ to, subject, html: body });
    if (result.ok) return ok({ emailId: result.id });
    return fail(result.error || "Errore invio email");
  } catch (e) {
    return fail(String(e));
  }
};

export const sendInternalMessageExecutor: NodeExecutor = async ({ config, context, dryRun }) => {
  if (dryRun) return ok({ simulated: true, action: "send_internal_message" });
  const userId = String(config.userId ?? "");
  const message = interpolateString(String(config.message ?? ""), context);

  if (!userId || !message) return fail("UserId e messaggio richiesti");

  try {
    await createNotification({
      userId,
      title: "Workflow",
      body: message,
      type: "workflow",
      relatedId: context.contactId ?? null,
    });
    return ok();
  } catch (e) {
    return fail(String(e));
  }
};

export const movePipelineStageExecutor: NodeExecutor = async ({ config, context, dryRun }) => {
  if (dryRun) return ok({ simulated: true, action: "move_pipeline_stage" });
  const dealId = String(config.dealId ?? context.dealId ?? "");
  const stageId = String(config.stageId ?? "");

  if (!dealId) return fail("DealId richiesto");
  if (!stageId) return fail("StageId richiesto");

  try {
    const stages = await getStages();
    const stage = stages.find((s: { id: string; name?: string; color?: string }) => s.id === stageId);
    await updateDeal(dealId, { stageId });
    return ok({ dealId, stageId, stageName: stage?.name ?? "" });
  } catch (e) {
    return fail(String(e));
  }
};

function isUrlAllowed(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost")) return false;
    if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|^0\./.test(hostname)) return false;
    if (hostname === "169.254.169.254") return false;
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return true;
  } catch {
    return false;
  }
}

export const httpRequestExecutor: NodeExecutor = async ({ config, context, dryRun }) => {
  if (dryRun) return ok({ simulated: true, action: "http_request" });
  const method = String(config.method ?? "GET").toUpperCase();
  const url = interpolateString(String(config.url ?? ""), context);
  const headers = (config.headers as Record<string, string>) ?? {};
  const body = config.body ? interpolateString(String(config.body), context) : undefined;

  if (!url) return fail("URL richiesto");
  if (!isUrlAllowed(url)) return fail("URL non consentito: accesso a IP privati, localhost o protocolli non HTTP/S è bloccato");

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: ["GET", "HEAD"].includes(method) ? undefined : body,
    });
    const responseText = await res.text();
    return ok({ status: res.status, response: responseText });
  } catch (e) {
    return fail(String(e));
  }
};

// ---------------------------------------------------------------------------
// Lead actions (funnel a 2 call) — agiscono sul lead che ha avviato il workflow
// ---------------------------------------------------------------------------

const SETTER = {
  id: process.env.CUGINA_USER_ID || "cugina",
  name: process.env.CUGINA_NAME || "Cugina di Rick",
};
const CLOSER = {
  id: process.env.LEO_USER_ID || "leo",
  name: process.env.LEO_NAME || "Leo",
};

// The lead id always travels in the trigger payload (form_submitted,
// call_outcome_recorded, …). Fall back to context fields for safety.
function resolveLeadId(context: ExecutionContext): string {
  const p = context.trigger?.payload;
  const fromPayload =
    p && typeof p === "object" && !Array.isArray(p)
      ? (p as Record<string, unknown>).leadId
      : undefined;
  return String(context.leadId ?? context.variables.leadId ?? fromPayload ?? "");
}

export const createLeadCallTaskExecutor: NodeExecutor = async ({ config, context, dryRun }) => {
  if (dryRun) return ok({ simulated: true, action: "create_lead_call_task" });
  const leadId = resolveLeadId(context);
  if (!leadId) return fail("LeadId mancante nel contesto");
  const who = String(config.assignee ?? "setter") === "closer" ? CLOSER : SETTER;
  try {
    const lead = await getLead(leadId);
    const notes =
      interpolateString(String(config.notes ?? ""), context) || lead?.message || null;
    const { task, created } = await createOpenCallTaskIfMissing({
      leadId,
      assignedTo: who.id,
      assigneeName: who.name,
      status: "pending",
      notes,
    });
    if (!created) return skip(`Call task già aperta (${task.id})`);
    return ok({ callTaskId: task.id, assignedTo: who.id });
  } catch (e) {
    return fail(String(e));
  }
};

export const setLeadStatusExecutor: NodeExecutor = async ({ config, context, dryRun }) => {
  if (dryRun) return ok({ simulated: true, action: "set_lead_status" });
  const leadId = resolveLeadId(context);
  if (!leadId) return fail("LeadId mancante nel contesto");
  const status = String(config.status ?? "");
  if (!status) return fail("Stato mancante");
  try {
    await updateLead(leadId, { status: status as LeadStatus });
    return ok({ status });
  } catch (e) {
    return fail(String(e));
  }
};

export const moveLeadStageExecutor: NodeExecutor = async ({ config, context, dryRun }) => {
  if (dryRun) return ok({ simulated: true, action: "move_lead_stage" });
  const leadId = resolveLeadId(context);
  if (!leadId) return fail("LeadId mancante nel contesto");
  const stage = String(config.stage ?? "");
  if (!stage) return fail("Fase mancante");
  try {
    // Dynamic import: pipeline → automation → engine → … avoids a static cycle.
    const { moveLeadStage } = await import("@/lib/leads/pipeline");
    const res = await moveLeadStage({
      leadId,
      toStage: stage as LeadPipelineStage,
      reason: "workflow",
      triggeredBy: "workflow",
    });
    if (!res.ok) return fail(`Spostamento fase fallito: ${res.error ?? "?"}`);
    return ok({ stage });
  } catch (e) {
    return fail(String(e));
  }
};

// ---------------------------------------------------------------------------
// Condition executors
// ---------------------------------------------------------------------------

export const ifFieldEqualsExecutor: NodeExecutor = async ({ config, context }) => {
  const field = String(config.field ?? "");
  const compareValue = interpolateString(String(config.compareValue ?? ""), context);

  const payload =
    context.trigger.payload && typeof context.trigger.payload === "object" && !Array.isArray(context.trigger.payload)
      ? (context.trigger.payload as Record<string, unknown>)
      : {};
  const actualValue = field.startsWith("{{")
    ? interpolateString(field, context)
    : (context.variables[field] ?? payload[field]);

  const isTrue = String(actualValue) === compareValue;
  return {
    status: "ok",
    output: { result: isTrue },
  };
};

export const ifFieldExistsExecutor: NodeExecutor = async ({ config, context }) => {
  const field = String(config.field ?? "");

  const payload =
    context.trigger.payload && typeof context.trigger.payload === "object" && !Array.isArray(context.trigger.payload)
      ? (context.trigger.payload as Record<string, unknown>)
      : {};
  const actualValue = field.startsWith("{{")
    ? interpolateString(field, context)
    : (context.variables[field] ?? payload[field]);

  const isTrue = actualValue !== undefined && actualValue !== null && String(actualValue).trim() !== "";
  return {
    status: "ok",
    output: { result: isTrue },
  };
};

export const ifFieldInExecutor: NodeExecutor = async ({ config, context }) => {
  const field = String(config.field ?? "");
  const values = String(config.values ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const payload =
    context.trigger.payload && typeof context.trigger.payload === "object" && !Array.isArray(context.trigger.payload)
      ? (context.trigger.payload as Record<string, unknown>)
      : {};
  const actualValue = field.startsWith("{{")
    ? interpolateString(field, context)
    : (context.variables[field] ?? payload[field]);

  const isTrue = values.includes(String(actualValue));
  return {
    status: "ok",
    output: { result: isTrue },
  };
};

export const ifScoreAboveExecutor: NodeExecutor = async ({ config, context }) => {
  const score = Number(context.variables.score ?? 0);
  const threshold = Number(config.threshold ?? 0);
  const isTrue = score > threshold;
  return {
    status: "ok",
    output: { result: isTrue },
  };
};

export const ifHasTagExecutor: NodeExecutor = async ({ config, context }) => {
  const tags = (context.variables.tags as string[]) ?? [];
  const tag = String(config.tag ?? "");
  const isTrue = tags.includes(tag);
  return {
    status: "ok",
    output: { result: isTrue },
  };
};

export const ifStageIsExecutor: NodeExecutor = async ({ config, context }) => {
  const stage = String(context.variables.stage ?? "");
  const expectedStage = String(config.stage ?? "");
  const isTrue = stage === expectedStage;
  return {
    status: "ok",
    output: { result: isTrue },
  };
};

// ---------------------------------------------------------------------------
// Delay executors
// ---------------------------------------------------------------------------

export const waitForExecutor: NodeExecutor = async ({ nodeId, config, context, dryRun }) => {
  if (dryRun) return ok({ simulated: true, action: "wait_for" });
  const amount = Number(config.amount ?? 1);
  const unit = String(config.unit ?? "minutes"); // minutes, hours, days
  const workflowId = String(config.workflowId ?? context.variables.workflowId ?? "");
  const runId = String(config.runId ?? context.variables.runId ?? "");

  const msPerUnit = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 };
  const ms = amount * (msPerUnit[unit as keyof typeof msPerUnit] ?? 60_000);
  const executeAt = new Date(Date.now() + ms);

  try {
    await createWorkflowScheduled({
      workflowId,
      runId,
      nodeId,
      executeAt,
      payload: JSON.stringify(context),
    });
    return { status: "ok", output: { scheduledAt: executeAt.toISOString() } };
  } catch (e) {
    return fail(String(e));
  }
};

export const waitUntilExecutor: NodeExecutor = async ({ nodeId, config, context, dryRun }) => {
  if (dryRun) return ok({ simulated: true, action: "wait_until" });
  const dayOfWeek = Number(config.dayOfWeek ?? -1); // 0=Sun, 1=Mon, ... 6=Sat, -1=today
  const hour = Number(config.hour ?? 9);
  const minute = Number(config.minute ?? 0);
  const workflowId = String(config.workflowId ?? context.variables.workflowId ?? "");
  const runId = String(config.runId ?? context.variables.runId ?? "");

  const now = new Date();
  const executeAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);

  if (dayOfWeek >= 0) {
    const currentDay = now.getDay();
    const daysUntil = (dayOfWeek - currentDay + 7) % 7;
    executeAt.setDate(executeAt.getDate() + daysUntil);
    if (executeAt <= now) executeAt.setDate(executeAt.getDate() + 7);
  } else if (executeAt <= now) {
    executeAt.setDate(executeAt.getDate() + 1);
  }

  try {
    await createWorkflowScheduled({
      workflowId,
      runId,
      nodeId,
      executeAt,
      payload: JSON.stringify(context),
    });
    return { status: "ok", output: { scheduledAt: executeAt.toISOString() } };
  } catch (e) {
    return fail(String(e));
  }
};
