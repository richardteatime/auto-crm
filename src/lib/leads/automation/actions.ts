import { CATEGORY_LABELS, STAGE_LABELS, type Lead } from "../types";
import { scoreBandLabel } from "../scoring";
import { buildQuoteDraft, type QuoteDraft } from "../quotes";
import {
  createOpenCallTaskIfMissing,
  getCallTask,
  updateLead,
  createLeadQuote,
  listLeadQuotes,
} from "@/lib/db";
import {
  sendToInternalTeam,
  sendToLeo,
  sendToSetter,
  sendToFounder,
  sendEmail,
} from "./adapters/email";
import {
  type ActionHandler,
  type AutomationContext,
  ok,
  skip,
  fail,
} from "./types";

const ACK_EMAIL_ENABLED = process.env.ENABLE_LEAD_ACK_EMAIL === "true";

// Leo's identity for call-task assignment (env-overridable).
export const leoIdentity = {
  id: process.env.LEO_USER_ID || "leo",
  name: process.env.LEO_NAME || "Leo",
};

// "Cugina di Rick" — the setter who runs the cold discovery call (call 1),
// before escalating qualified leads to Leo (the closer). Env-overridable.
export const setterIdentity = {
  id: process.env.CUGINA_USER_ID || "cugina",
  name: process.env.CUGINA_NAME || "Cugina di Rick",
};

// Idempotent: create one open call task for Leo, set the lead "to_call",
// and notify Leo by email. Reused by both lead_created and
// stage_changed_to_prospect, so it must never create a duplicate task.
async function createLeoCallTask(
  ctx: AutomationContext,
  actionName: string,
) {
  const { task, created } = await createOpenCallTaskIfMissing({
    leadId: ctx.lead.id,
    assignedTo: leoIdentity.id,
    assigneeName: leoIdentity.name,
    status: "pending",
    notes: ctx.lead.message ?? null,
  });
  if (!created) return skip(actionName, "open call task already exists");

  // Mark the lead as "to call" (PLAN: set status 'da chiamare').
  try {
    await updateLead(ctx.lead.id, { status: "to_call" });
  } catch {
    // non-blocking
  }

  // Notify Leo (graceful — skips if email not configured).
  await sendToLeo(
    `Nuova chiamata: ${ctx.lead.fullName}`,
    `<p>Hai un nuovo lead da contattare.</p>${leadSummaryHtml(ctx.lead)}`,
  );

  return ok(actionName, `taskId=${task.id}`);
}

// Idempotent: create one open call task for the SETTER (Cugina), set the lead
// "to_call", and notify her by email. This is the FIRST (cold) call of the
// two-call funnel; qualified leads are later escalated to Leo.
// Canali coperti dal workflow visibile "Form → call a freddo (Cugina)".
// Per questi NON creiamo la call task qui (la crea il workflow form_submitted):
// così il primo tratto del funnel è tutto nel builder. Per gli altri canali
// (es. email inbound, che nel builder non hanno un trigger) restiamo come rete
// di sicurezza in codice.
const WORKFLOW_LEAD_CHANNELS = new Set(["form", "landing", "funnel"]);

async function createSetterCallTask(
  ctx: AutomationContext,
  actionName: string,
) {
  if (WORKFLOW_LEAD_CHANNELS.has(ctx.lead.source)) {
    return skip(actionName, `lead da '${ctx.lead.source}': call task gestita dal workflow`);
  }
  const { task, created } = await createOpenCallTaskIfMissing({
    leadId: ctx.lead.id,
    assignedTo: setterIdentity.id,
    assigneeName: setterIdentity.name,
    status: "pending",
    notes: ctx.lead.message ?? null,
  });
  if (!created) return skip(actionName, "open call task already exists");

  try {
    await updateLead(ctx.lead.id, { status: "to_call" });
  } catch {
    // non-blocking
  }

  await sendToSetter(
    `Nuova chiamata a freddo: ${ctx.lead.fullName}`,
    `<p>Hai un nuovo lead da contattare per la call conoscitiva (scrematura a freddo).</p>${leadSummaryHtml(ctx.lead)}`,
  );

  return ok(actionName, `taskId=${task.id}`);
}

// Day 6 — post-call routing. Outcome groups per PLAN's rules table.
const PROPOSAL_OUTCOMES = new Set(["qualified", "interested", "needs_quote"]);
const FOLLOWUP_OUTCOMES = new Set(["no_answer", "call_later"]);
const LOST_OUTCOMES = new Set(["not_qualified", "not_interested", "wrong_number"]);

// Route a lead to the next stage/status based on the recorded call outcome.
// moveLeadStage is imported dynamically to avoid a static import cycle
// (pipeline → automation → engine → actions → pipeline).
async function routeLeadByOutcome(ctx: AutomationContext) {
  const outcome =
    typeof ctx.payload.outcome === "string" ? ctx.payload.outcome : null;
  if (!outcome) return skip("route_lead_by_outcome", "no outcome in payload");

  const { moveLeadStage } = await import("../pipeline");

  // Who ran the call? The setter (Cugina, call 1) escalates qualified leads to
  // Leo; the closer (Leo, call 2) advances them to proposal. We read the
  // assignee from the completed call task passed by the call-outcome endpoint.
  const callTaskId =
    typeof ctx.payload.callTaskId === "string" ? ctx.payload.callTaskId : null;
  const task = callTaskId ? await getCallTask(callTaskId) : null;
  const bySetter = task?.assignedTo === setterIdentity.id;

  // -------------------------------------------------------------------------
  // CALL 1 — routing dopo la chiamata della setter (Cugina)
  // -------------------------------------------------------------------------
  if (bySetter) {
    if (PROPOSAL_OUTCOMES.has(outcome)) {
      // Qualificato → passa a Leo per la call di chiusura.
      await updateLead(ctx.lead.id, { status: "qualified" });
      await moveLeadStage({
        leadId: ctx.lead.id,
        toStage: "opportunity",
        reason: `setter call: ${outcome}`,
        triggeredBy: "automation",
      });
      await createOpenCallTaskIfMissing({
        leadId: ctx.lead.id,
        assignedTo: leoIdentity.id,
        assigneeName: leoIdentity.name,
        status: "pending",
        notes: `Call di chiusura — lead scremato da ${setterIdentity.name}`,
      });
      await sendToLeo(
        `Lead caldo da chiudere: ${ctx.lead.fullName}`,
        `<p>${setterIdentity.name} ha qualificato un lead: pronto per la call di chiusura.</p>${leadSummaryHtml(ctx.lead)}`,
      );
      return ok("route_lead_by_outcome", `setter → Leo (${outcome})`);
    }

    if (FOLLOWUP_OUTCOMES.has(outcome)) {
      await updateLead(ctx.lead.id, { status: "working" });
      await createOpenCallTaskIfMissing({
        leadId: ctx.lead.id,
        assignedTo: setterIdentity.id,
        assigneeName: setterIdentity.name,
        status: "scheduled",
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        notes: `Follow-up (setter) dopo esito "${outcome}"`,
      });
      return ok("route_lead_by_outcome", `setter follow-up (${outcome})`);
    }

    if (LOST_OUTCOMES.has(outcome)) {
      await updateLead(ctx.lead.id, { status: "lost" });
      await moveLeadStage({
        leadId: ctx.lead.id,
        toStage: "contacted",
        reason: `setter call: ${outcome}`,
        triggeredBy: "automation",
      });
      return ok("route_lead_by_outcome", `setter lost (${outcome})`);
    }

    return skip("route_lead_by_outcome", `setter outcome non gestito: ${outcome}`);
  }

  // -------------------------------------------------------------------------
  // CALL 2 — routing dopo la chiamata del closer (Leo) — comportamento storico
  // -------------------------------------------------------------------------
  if (PROPOSAL_OUTCOMES.has(outcome)) {
    await updateLead(ctx.lead.id, { status: "qualified" });
    await moveLeadStage({
      leadId: ctx.lead.id,
      toStage: "proposal",
      reason: `call outcome: ${outcome}`,
      triggeredBy: "automation",
    });
    return ok("route_lead_by_outcome", `→ proposal (${outcome})`);
  }

  if (FOLLOWUP_OUTCOMES.has(outcome)) {
    await moveLeadStage({
      leadId: ctx.lead.id,
      toStage: "contacted",
      reason: `call outcome: ${outcome}`,
      triggeredBy: "automation",
    });
    await updateLead(ctx.lead.id, { status: "working" });
    await createOpenCallTaskIfMissing({
      leadId: ctx.lead.id,
      assignedTo: leoIdentity.id,
      assigneeName: leoIdentity.name,
      status: "scheduled",
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      notes: `Follow-up dopo esito "${outcome}"`,
    });
    return ok("route_lead_by_outcome", `follow-up programmato (${outcome})`);
  }

  if (LOST_OUTCOMES.has(outcome)) {
    await updateLead(ctx.lead.id, { status: "lost" });
    await moveLeadStage({
      leadId: ctx.lead.id,
      toStage: "contacted",
      reason: `call outcome: ${outcome}`,
      triggeredBy: "automation",
    });
    return ok("route_lead_by_outcome", `lost (${outcome})`);
  }

  return skip("route_lead_by_outcome", `outcome non gestito: ${outcome}`);
}

// Compact HTML block describing a lead — reused across internal emails.
export function leadSummaryHtml(lead: Lead): string {
  const rows: Array<[string, string | null]> = [
    ["Nome", lead.fullName],
    ["Email", lead.email],
    ["Telefono", lead.phone],
    ["Azienda", lead.company ?? lead.businessName],
    ["Categoria", CATEGORY_LABELS[lead.category] ?? lead.category],
    ["Fase", STAGE_LABELS[lead.pipelineStage] ?? lead.pipelineStage],
    ["Score", `${lead.leadScore}/100 — ${scoreBandLabel(lead.leadScore)}`],
    ["Richiesta", lead.message],
  ];
  const body = rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">${k}</td><td style="padding:4px 0;color:#1e293b;">${v}</td></tr>`,
    )
    .join("");
  return `<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;">${body}</table>`;
}

// ---------------------------------------------------------------------------
// Action registry. Each rule lists action names (JSON array); the engine
// dispatches each name here. Unknown names are skipped (never throw).
// Later days extend this registry:
//   Day 5 → create_leo_call_task / create_call_task_for_leo
//   Day 7 → generate_quote_draft / create_quote_record
// ---------------------------------------------------------------------------

const ACTION_HANDLERS: Record<string, ActionHandler> = {
  // These three are effectively applied at intake (parse + dedup + create).
  // As actions they confirm/observe state — they never mutate destructively.
  classify_lead_category: async (ctx: AutomationContext) => {
    const c = ctx.lead.category;
    return c && c !== "unknown"
      ? ok("classify_lead_category", `category=${c}`)
      : skip("classify_lead_category", "category unknown — left as-is");
  },
  create_or_update_contact: async () =>
    ok("create_or_update_contact", "lead persisted at intake (dedup applied)"),
  set_pipeline_stage_prospect: async (ctx: AutomationContext) =>
    ctx.lead.pipelineStage === "prospect"
      ? ok("set_pipeline_stage_prospect", "already in prospect")
      : skip(
          "set_pipeline_stage_prospect",
          `lead in ${ctx.lead.pipelineStage}`,
        ),

  // Day 5 — Leo call tasks. Both names map to the same idempotent handler.
  create_leo_call_task: (ctx: AutomationContext) =>
    createLeoCallTask(ctx, "create_leo_call_task"),
  create_call_task_for_leo: (ctx: AutomationContext) =>
    createLeoCallTask(ctx, "create_call_task_for_leo"),

  // Two-call funnel — the FIRST (cold) call goes to the setter "Cugina di Rick".
  // Both names map to the same idempotent handler.
  create_setter_call_task: (ctx: AutomationContext) =>
    createSetterCallTask(ctx, "create_setter_call_task"),
  create_call_task_for_setter: (ctx: AutomationContext) =>
    createSetterCallTask(ctx, "create_call_task_for_setter"),

  // Day 6 — post-call. The outcome is already persisted on the call task by
  // the call-outcome endpoint; save_call_outcome confirms it, and
  // route_lead_by_outcome advances the lead per PLAN's rules table.
  save_call_outcome: async (ctx: AutomationContext) => {
    const outcome =
      typeof ctx.payload.outcome === "string" ? ctx.payload.outcome : null;
    return outcome
      ? ok("save_call_outcome", `outcome=${outcome}`)
      : skip("save_call_outcome", "no outcome in payload");
  },
  route_lead_by_outcome: (ctx: AutomationContext) => routeLeadByOutcome(ctx),

  notify_internal_team: async (ctx: AutomationContext) => {
    const r = await sendToInternalTeam(
      `Nuovo lead: ${ctx.lead.fullName}`,
      `<p>È arrivato un nuovo lead.</p>${leadSummaryHtml(ctx.lead)}`,
    );
    if (r.skipped) return skip("notify_internal_team", "email not configured");
    return r.ok
      ? ok("notify_internal_team", `emailId=${r.id ?? ""}`)
      : fail("notify_internal_team", r.error);
  },

  notify_sales: async (ctx: AutomationContext) => {
    const r = await sendToInternalTeam(
      `Lead da seguire: ${ctx.lead.fullName}`,
      leadSummaryHtml(ctx.lead),
    );
    if (r.skipped) return skip("notify_sales", "email not configured");
    return r.ok ? ok("notify_sales") : fail("notify_sales", r.error);
  },

  send_internal_email_to_leo: async (ctx: AutomationContext) => {
    const r = await sendToLeo(
      `Da chiamare: ${ctx.lead.fullName}`,
      `<p>Nuovo lead da contattare.</p>${leadSummaryHtml(ctx.lead)}`,
    );
    if (r.skipped) return skip("send_internal_email_to_leo", "email not configured");
    return r.ok
      ? ok("send_internal_email_to_leo", `emailId=${r.id ?? ""}`)
      : fail("send_internal_email_to_leo", r.error);
  },

  // Day 7 — quote draft. generate_quote_draft builds a DRAFT (deterministic,
  // never sent) and stashes it on the shared ctx.payload; create_quote_record
  // persists it. Idempotent: skip if a draft quote already exists for the lead.
  generate_quote_draft: async (ctx: AutomationContext) => {
    const existing = await listLeadQuotes(ctx.lead.id);
    if (existing.some((q) => q.status === "draft")) {
      return skip("generate_quote_draft", "draft quote already exists");
    }
    const draft = buildQuoteDraft(ctx.lead);
    ctx.payload.quoteDraft = draft;
    return ok(
      "generate_quote_draft",
      `${draft.category} — ${draft.amountSuggested} cents`,
    );
  },

  create_quote_record: async (ctx: AutomationContext) => {
    const draft = ctx.payload.quoteDraft as QuoteDraft | undefined;
    if (!draft) {
      return skip(
        "create_quote_record",
        "no draft in context (generate skipped)",
      );
    }
    const quote = await createLeadQuote({
      leadId: ctx.lead.id,
      category: draft.category,
      amountSuggested: draft.amountSuggested,
      items: draft.items,
      summary: draft.summary,
      generatedText: draft.generatedText,
      status: "draft",
    });
    ctx.payload.quoteId = quote.id;
    return ok("create_quote_record", `quoteId=${quote.id}`);
  },

  // Draft email body for the proposal — NEVER sent (manual approval, PLAN rule).
  prepare_proposal_email_draft: async (ctx: AutomationContext) => {
    const draft = ctx.payload.quoteDraft as QuoteDraft | undefined;
    const name = ctx.lead.firstName ?? ctx.lead.fullName;
    const body = [
      `Ciao ${name},`,
      "",
      "grazie per la tua richiesta. Di seguito la nostra proposta:",
      "",
      draft?.generatedText ?? "(bozza preventivo non disponibile)",
      "",
      "Restiamo a disposizione per qualsiasi chiarimento.",
    ].join("\n");
    ctx.payload.proposalEmailDraft = body;
    return ok("prepare_proposal_email_draft", "draft prepared (not sent)");
  },

  notify_founder_admin: async (ctx: AutomationContext) => {
    const r = await sendToFounder(
      `Lead in proposal: ${ctx.lead.fullName}`,
      `<p>Un lead è arrivato in fase proposal.</p>${leadSummaryHtml(ctx.lead)}`,
    );
    if (r.skipped) return skip("notify_founder_admin", "email not configured");
    return r.ok ? ok("notify_founder_admin") : fail("notify_founder_admin", r.error);
  },

  // Acknowledgement to the lead. DISABLED by default — sending to the client
  // is gated behind an explicit env flag (safe option per PLAN).
  send_ack_email_optional: async (ctx: AutomationContext) => {
    if (!ACK_EMAIL_ENABLED) {
      return skip("send_ack_email_optional", "disabled (ENABLE_LEAD_ACK_EMAIL!=true)");
    }
    if (!ctx.lead.email) return skip("send_ack_email_optional", "no lead email");
    const r = await sendEmail({
      to: ctx.lead.email,
      subject: "Abbiamo ricevuto la tua richiesta",
      html: `<p>Ciao ${ctx.lead.firstName ?? ""}, abbiamo ricevuto la tua richiesta e ti contatteremo a breve.</p>`,
    });
    return r.ok ? ok("send_ack_email_optional") : skip("send_ack_email_optional", r.error);
  },
};

export function registerAction(name: string, handler: ActionHandler): void {
  ACTION_HANDLERS[name] = handler;
}

export function hasAction(name: string): boolean {
  return name in ACTION_HANDLERS;
}

export async function executeAction(
  name: string,
  ctx: AutomationContext,
) {
  const handler = ACTION_HANDLERS[name];
  if (!handler) return skip(name, "no handler registered");
  try {
    return await handler(ctx);
  } catch (e) {
    return fail(name, e instanceof Error ? e.message : "unknown error");
  }
}
