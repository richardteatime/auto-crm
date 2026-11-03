import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { getLead, listLeadEvents, updateLead, deleteLead, addLeadEvent } from "@/lib/db/leads";
import { changeStatus } from "@/lib/leads/service";
import { normalizePhone } from "@/lib/leads/intake";
import { isLeadStatus, type Lead } from "@/lib/leads/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  const events = await listLeadEvents(id);
  return NextResponse.json({ lead, events });
}

const EDITABLE = ["name", "phone", "email", "company", "service", "notes", "nextActionNote", "lostReason"] as const;

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const patch: Partial<Lead> = {};
  for (const k of EDITABLE) {
    if (k in body) {
      const v = body[k];
      if (v !== null && typeof v !== "string") return NextResponse.json({ error: `Campo ${k} non valido` }, { status: 400 });
      (patch as Record<string, unknown>)[k] = typeof v === "string" ? v.trim() || null : null;
    }
  }
  if (patch.name === null) return NextResponse.json({ error: "Il nome è obbligatorio" }, { status: 400 });
  if ("phone" in patch) patch.phoneE164 = normalizePhone(patch.phone);
  if ("nextActionAt" in body) {
    const v = body.nextActionAt;
    if (v !== null && (typeof v !== "string" || Number.isNaN(Date.parse(v)))) {
      return NextResponse.json({ error: "Data non valida" }, { status: 400 });
    }
    patch.nextActionAt = v ? new Date(v as string).toISOString() : null;
    patch.remindedAt = null;
  }
  if ("value" in body) {
    const v = body.value;
    if (v !== null && (typeof v !== "number" || v < 0)) return NextResponse.json({ error: "Valore non valido" }, { status: 400 });
    patch.value = v === null ? null : Math.round(v as number);
  }

  const actor = { id: auth.user.id, name: auth.user.name };
  try {
    let updated: Lead;
    if ("status" in body) {
      if (!isLeadStatus(body.status)) return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
      updated = await changeStatus(lead, body.status, actor, patch);
    } else {
      updated = Object.keys(patch).length ? await updateLead(id, patch) : lead;
      if ("nextActionAt" in patch && patch.nextActionAt !== lead.nextActionAt) {
        await addLeadEvent({
          leadId: id,
          type: "edit",
          outcome: null,
          fromStatus: null,
          toStatus: null,
          note: patch.nextActionAt
            ? `Prossimo contatto: ${new Date(patch.nextActionAt).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" })}`
            : "Prossimo contatto rimosso",
          actorId: actor.id,
          actorName: actor.name,
        });
      }
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Errore nel salvataggio" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    await deleteLead(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Errore durante l'eliminazione" }, { status: 500 });
  }
}
