import { NextRequest, NextResponse } from "next/server";
import {
  createDeal,
  createFunnelEvent,
  getFunnelBySlug,
  getForm,
  getLandingPage,
  getOrCreateFunnelSession,
  getStages,
  incrementFunnelCounter,
  updateFunnelSession,
} from "@/lib/db";
import { clientIp, track } from "@/lib/capture/analytics";
import { ingestLead } from "@/lib/capture/ingest";
import {
  isValidSessionId,
  parseFunnelSteps,
  resolveNextStep,
} from "@/lib/capture/funnels";
import { rateLimit } from "@/lib/capture/rate-limit";
import type { FormField } from "@/lib/capture/types";

function str(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === false || (typeof value === "string" && !value.trim());
}

async function normalizeSubmission(body: Record<string, unknown>): Promise<{
  values: Record<string, unknown>;
  rawData: Record<string, unknown>;
}> {
  const rawData =
    body.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : body;
  const submittedValues =
    body.values && typeof body.values === "object" && !Array.isArray(body.values)
      ? (body.values as Record<string, unknown>)
      : null;
  const formId = str(body, "formId");
  if (!submittedValues || !formId) return { values: body, rawData };

  const form = await getForm(formId);
  if (!form || form.status !== "active") throw new Error("Form non trovato");
  const parsed = JSON.parse(form.fields);
  const fields = Array.isArray(parsed) ? (parsed as FormField[]) : [];
  const mapped: Record<string, unknown> = {};
  const readable: Record<string, unknown> = {};
  for (const field of fields) {
    const value = submittedValues[field.id];
    if (field.validation?.required && isEmpty(value)) {
      throw new Error(`Campo obbligatorio: ${field.label}`);
    }
    if (isEmpty(value)) continue;
    readable[field.label || field.id] = value;
    if (field.crmField && field.crmField !== "none") mapped[field.crmField] = value;
  }
  return { values: { ...body, ...mapped }, rawData: readable };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; stepId: string }> },
) {
  const { slug, stepId } = await params;
  const ip = clientIp(request.headers) ?? "unknown";
  if (!rateLimit(`funnel:${ip}`)) {
    return NextResponse.json(
      { success: false, error: "Troppe richieste. Riprova piÃ¹ tardi." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "JSON invalido" }, { status: 400 });
  }

  const funnel = await getFunnelBySlug(slug);
  if (!funnel || funnel.status !== "active") {
    return NextResponse.json({ success: false, error: "Funnel non trovato" }, { status: 404 });
  }
  const steps = parseFunnelSteps(funnel.steps);
  const step = steps.find((item) => item.id === stepId);
  if (!step) {
    return NextResponse.json({ success: false, error: "Step non trovato" }, { status: 404 });
  }

  const sessionId = str(body, "sessionId");
  if (!isValidSessionId(sessionId)) {
    return NextResponse.json({ success: false, error: "Sessione funnel non valida" }, { status: 400 });
  }

  let normalized;
  try {
    normalized = await normalizeSubmission(body);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Form non valido" },
      { status: 400 },
    );
  }
  const { values, rawData } = normalized;
  const name = str(values, "name");
  const email = str(values, "email");
  const phone = str(values, "phone");
  if (!name && !email && !phone) {
    return NextResponse.json(
      { success: false, error: "Inserisci almeno nome, email o telefono." },
      { status: 400 },
    );
  }

  try {
    const { lead, duplicate } = await ingestLead(
      {
        name,
        email,
        phone,
        company: str(values, "company"),
        website: str(values, "website"),
        message: str(values, "message"),
        budget: str(values, "budget"),
        source: "funnel",
        funnelId: funnel.id,
        landingPageId: step.landingPageId,
        rawData,
      },
      {
        ip,
        userAgent: request.headers.get("user-agent"),
        referrer: request.headers.get("referer"),
        sessionId,
      },
    );

    const session = await getOrCreateFunnelSession(funnel.id, sessionId);
    await createFunnelEvent({
      funnelId: funnel.id,
      sessionId,
      stepId,
      eventType: "step_submit",
      data: rawData,
    }).catch(() => undefined);
    await track("step_submit", "funnel", funnel.id, {
      ip,
      userAgent: request.headers.get("user-agent"),
      referrer: request.headers.get("referer"),
      sessionId,
    });

    const nextStepId = resolveNextStep(step, values);
    if (nextStepId && steps.some((item) => item.id === nextStepId)) {
      await updateFunnelSession(session.id, {
        contactId: lead.contactId,
        currentStep: nextStepId,
      });
      return NextResponse.json({
        success: true,
        duplicate,
        redirectUrl: `/f/${encodeURIComponent(slug)}/step/${encodeURIComponent(nextStepId)}?sid=${encodeURIComponent(sessionId)}`,
      });
    }

    await updateFunnelSession(session.id, {
      contactId: lead.contactId,
      currentStep: stepId,
      completed: true,
      completedAt: new Date().toISOString(),
    });
    await createFunnelEvent({
      funnelId: funnel.id,
      sessionId,
      stepId,
      eventType: "funnel_complete",
      data: rawData,
    }).catch(() => undefined);
    await incrementFunnelCounter(funnel.id, "conversions").catch(() => undefined);
    await track("funnel_complete", "funnel", funnel.id, {
      ip,
      userAgent: request.headers.get("user-agent"),
      referrer: request.headers.get("referer"),
      sessionId,
    });

    let dealId: string | null = null;
    if (lead.contactId) {
      const stages = await getStages();
      const entryStage = stages.find((stage) => !stage.isLost) ?? stages[0];
      if (entryStage) {
        const deal = await createDeal({
          title: `Funnel ${funnel.name} â€” ${lead.fullName}`,
          contactId: lead.contactId,
          stageId: entryStage.id,
          notes: `Conversione funnel ${funnel.name} (${funnel.id})`,
        });
        dealId = deal.id;
      }
    }

    let redirectUrl = `/f/${encodeURIComponent(slug)}/complete?sid=${encodeURIComponent(sessionId)}`;
    if (funnel.thankYouPageId) {
      const thankYou = await getLandingPage(funnel.thankYouPageId);
      if (thankYou?.status === "published") redirectUrl = `/l/${encodeURIComponent(thankYou.slug)}`;
    }

    return NextResponse.json({ success: true, duplicate, dealId, redirectUrl });
  } catch {
    return NextResponse.json(
      { success: false, error: "Errore durante l'invio. Riprova." },
      { status: 500 },
    );
  }
}
