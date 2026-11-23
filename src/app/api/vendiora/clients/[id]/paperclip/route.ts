import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getClient } from "@/lib/vendiora/db";
import { readBody, fail } from "@/lib/vendiora/http";
import { deliveryUrl, paperclipConfigured, startDelivery, syncDelivery } from "@/lib/vendiora/paperclip";

type Ctx = { params: Promise<{ id: string }> };

/** Stato della consegna su Paperclip (legge e aggiorna la scheda) */
export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    const cur = await getClient(id);
    if (!cur) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
    const d = cur.ops.paperclip ? await syncDelivery(id) : null;
    return NextResponse.json({ configured: paperclipConfigured(), delivery: d, url: d ? deliveryUrl(d) : null });
  } catch (e) { return fail(e); }
}

/** { test?: true } → apre il compito principale per gli agenti (una sola volta) */
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await readBody(request);
  if (b instanceof NextResponse) return b;
  try {
    const d = await startDelivery(id, { test: b.test === true, by: auth.user.name || auth.user.email });
    return NextResponse.json({ configured: true, delivery: d, url: deliveryUrl(d) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "errore";
    if (/non configurato|Solo i pacchetti|Pagamento non/.test(msg)) return NextResponse.json({ error: msg }, { status: 400 });
    return fail(e);
  }
}
