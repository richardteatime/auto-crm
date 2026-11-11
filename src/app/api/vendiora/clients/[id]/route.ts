import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getClient, updateClient, deleteClient, listCalls, type ClientPatch } from "@/lib/vendiora/db";
import { sendClientAuto } from "@/lib/vendiora/automations";
import { readBody, str, int, iso, fail } from "@/lib/vendiora/http";
import { isClientStatus } from "@/lib/vendiora/types";
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
  if ("isPaid" in b) { p.isPaid = b.isPaid === true; if (p.isPaid && !("paidAt" in b) && !cur.paidAt) p.paidAt = new Date().toISOString(); if (!p.isPaid) p.paidAt = null; }
  // Natural flow: kick-off → building; store online → coaching
  if (p.kickoffAt && !cur.kickoffAt && cur.status === "onboarding" && !("status" in b)) p.status = "costruzione";
  if (p.storeLiveAt && !cur.storeLiveAt && ["onboarding", "costruzione"].includes(cur.status) && !("status" in b)) p.status = "affiancamento";
  try {
    const client = await updateClient(id, p);
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
