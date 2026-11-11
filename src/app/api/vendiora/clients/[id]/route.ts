import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getClient, updateClient, deleteClient, listCalls, getSettings, type ClientPatch } from "@/lib/vendiora/db";
import { activateClient, ensureCallPlan } from "@/lib/vendiora/engine";
import { PACKAGE_CODES, playbookPackage, type PackageCode } from "@/lib/vendiora/playbook";
import { sendClientAuto } from "@/lib/vendiora/automations";
import { readBody, str, int, iso, fail } from "@/lib/vendiora/http";
import { isClientStatus, type ClientOps, type Installment } from "@/lib/vendiora/types";

const opsStr = (v: unknown, max = 2000) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const opsNum = (v: unknown, min: number, max: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null;
};
const opsIso = (v: unknown) => (typeof v === "string" && v && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null);

/** Whitelisted edits of the playbook fields (the rest is written only by the engine) */
function opsPatch(cur: ClientOps, b: Record<string, unknown>): ClientOps {
  const o: ClientOps = { ...cur };
  const now = new Date().toISOString();
  for (const k of ["objective", "kpiName", "csm", "pm", "closer", "setter"] as const) if (k in b) o[k] = opsStr(b[k], 500);
  for (const k of ["kpiStart", "kpiTarget"] as const) if (k in b) o[k] = opsNum(b[k], -1e12, 1e12);
  for (const k of ["intakeAt", "quickWinAt", "planAt", "groupAt", "briefAt", "accessesAt", "storeReadyAt", "adsLaunchedAt", "testimonialAt", "activatedAt"] as const) {
    if (k in b) o[k] = b[k] === true ? now : opsIso(b[k]);
  }
  if ("handover" in b && b.handover && typeof b.handover === "object") {
    const h = b.handover as Record<string, unknown>;
    o.handover = { goal: opsStr(h.goal) ?? undefined, motivation: opsStr(h.motivation) ?? undefined, fears: opsStr(h.fears) ?? undefined, promises: opsStr(h.promises) ?? undefined };
    if (!o.objective && o.handover.goal) o.objective = o.handover.goal;
  }
  if ("coachVote" in b) { o.coachVote = opsNum(b.coachVote, 1, 5); o.coachVoteAt = now; }
  if ("kpiValue" in b) { const v = opsNum(b.kpiValue, -1e12, 1e12); if (v != null) o.kpi = [...(o.kpi ?? []), { at: now, value: v }]; }
  if ("access" in b && b.access && typeof b.access === "object") {
    o.access = { ...(o.access ?? {}) };
    for (const [k, v] of Object.entries(b.access as Record<string, unknown>)) if (typeof v === "boolean") o.access[k.slice(0, 120)] = v;
    if (Object.keys(o.access).length && Object.values(o.access).every(Boolean) && !o.accessesAt) o.accessesAt = now;
  }
  if ("upsell" in b) {
    const u = b.upsell as Record<string, unknown> | null;
    if (!u) o.upsell = null;
    else {
      const stage = typeof u.stage === "string" && /^U[1-6]$/.test(u.stage) ? u.stage : o.upsell?.stage ?? "U1";
      const readiness = u.readiness === "si" || u.readiness === "no" || u.readiness === "forse" ? u.readiness : o.upsell?.readiness ?? null;
      o.upsell = { ...(o.upsell ?? {}), stage, readiness, suggested: "suggested" in u ? opsStr(u.suggested, 200) : o.upsell?.suggested ?? null, note: "note" in u ? opsStr(u.note) : o.upsell?.note ?? null, at: stage !== o.upsell?.stage ? now : o.upsell?.at ?? now };
    }
  }
  if ("installments" in b && Array.isArray(b.installments)) {
    o.installments = (b.installments as Record<string, unknown>[]).slice(0, 12).map((r, i): Installment => ({
      n: i + 1, amount: Math.round(opsNum(r.amount, 0, 1e9) ?? 0), dueAt: opsIso(r.dueAt) ?? now,
      status: r.status === "pagata" || r.status === "fallita" ? r.status : "da_pagare",
      paidAt: r.status === "pagata" ? opsIso(r.paidAt) ?? now : null,
      failedAt: r.status === "fallita" ? opsIso(r.failedAt) ?? (cur.installments?.[i]?.failedAt ?? now) : null,
    }));
    const failing = o.installments.some((r) => r.status === "fallita");
    o.paymentStatus = o.installments.every((r) => r.status === "pagata") ? "saldato" : failing ? (o.paymentStatus === "a_rischio" ? "a_rischio" : "a_rate") : "a_rate";
  }
  if ("referralClick" in b) o.referralClicks = (o.referralClicks ?? 0) + 1;
  return o;
}
import { normalizePhone } from "@/lib/leads/intake";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  return NextResponse.json({ client, calls: await listCalls({ clientId: id }) });
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const cur = await getClient(id);
  if (!cur) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  const b = await readBody(request);
  if (b instanceof NextResponse) return b;
  const p: ClientPatch = {};
  for (const k of ["name", "email", "phone", "taxId", "address", "storeUrl", "coach", "paymentTerms"] as const) if (k in b) p[k] = str(b[k], 500) as never;
  if ("name" in p && !p.name) return NextResponse.json({ error: "Il nome è obbligatorio" }, { status: 400 });
  if ("notes" in b) p.notes = str(b.notes, 20000);
  if ("phone" in p) p.phoneE164 = normalizePhone(p.phone ?? null);
  if ("price" in b) { const v = int(b.price, 0, 1e9); if (v == null) return NextResponse.json({ error: "Prezzo non valido" }, { status: 400 }); p.price = v; }
  if ("status" in b) { if (!isClientStatus(b.status)) return NextResponse.json({ error: "Stato non valido" }, { status: 400 }); p.status = b.status; }
  for (const k of ["kickoffAt", "storeLiveAt", "contractSignedAt", "paidAt"] as const) if (k in b) p[k] = iso(b[k]);
  if ("stage" in b) {
    const ok = typeof b.stage === "string" && /^(O[1-7]|D[1-8])$/.test(b.stage);
    if (!ok) return NextResponse.json({ error: "Fase non valida" }, { status: 400 });
    p.stage = b.stage as string;
    p.ops = { ...(p.ops ?? cur.ops), stageManualAt: new Date().toISOString() } as ClientOps;
  }
  if ("packageCode" in b) {
    if (b.packageCode !== null && !(PACKAGE_CODES as string[]).includes(String(b.packageCode))) return NextResponse.json({ error: "Codice pacchetto non valido" }, { status: 400 });
    p.packageCode = (b.packageCode as PackageCode | null) ?? null;
  }
  if (b.ops && typeof b.ops === "object") p.ops = opsPatch(cur.ops, b.ops as Record<string, unknown>);
  if ("isPaid" in b) { p.isPaid = b.isPaid === true; if (p.isPaid && !("paidAt" in b) && !cur.paidAt) p.paidAt = new Date().toISOString(); if (!p.isPaid) p.paidAt = null; }
  // Natural flow: kick-off → building; store online → coaching
  if (p.kickoffAt && !cur.kickoffAt && cur.status === "onboarding" && !("status" in b)) p.status = "costruzione";
  if (p.storeLiveAt && !cur.storeLiveAt && ["onboarding", "costruzione"].includes(cur.status) && !("status" in b)) p.status = "affiancamento";
  try {
    let client = await updateClient(id, p);
    const s = await getSettings();
    if (s.playbook.enabled && playbookPackage(client.packageCode)) {
      if (p.packageCode && p.packageCode !== cur.packageCode) await ensureCallPlan(client);
      // Payment registered → activation (M5, calls calendar). Idempotent.
      const act = client.isPaid ? await activateClient(id, { s }) : null;
      client = (await getClient(id)) ?? client;
      return NextResponse.json({ client, calls: await listCalls({ clientId: id }), activation: act });
    }
    // Store just went online → automatic "store online" WhatsApp (once)
    const auto = p.storeLiveAt && !cur.storeLiveAt ? await sendClientAuto("storeLive", client) : undefined;
    return NextResponse.json({ client: auto?.sent ? (await getClient(id)) ?? client : client, auto });
  } catch (e) { return fail(e); }
}

/** { send: "welcome" | "storeLive" | "coachingEnd", force?: true } → (re)send a journey message now */
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const cur = await getClient(id);
  if (!cur) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  const b = await readBody(request);
  if (b instanceof NextResponse) return b;
  const key = b.send;
  if (key !== "welcome" && key !== "storeLive" && key !== "coachingEnd") return NextResponse.json({ error: "Messaggio non valido" }, { status: 400 });
  const autoLog = { ...cur.autoLog };
  if (b.force === true) delete autoLog[key];
  const target = { ...cur, autoLog };
  const r = await sendClientAuto(key, target);
  if (!r.sent) return NextResponse.json({ error: r.reason || "Invio non riuscito" }, { status: 409 });
  return NextResponse.json({ ok: true, client: await getClient(id) });
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  try { await deleteClient(id); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
}
