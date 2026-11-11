import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getLead, leadInScope, addLeadEvent } from "@/lib/db/leads";
import { changeStatus, convertLead } from "@/lib/leads/service";
import { normalizePhone } from "@/lib/leads/intake";
import {
  listClients, createClient, getPackage, nextContractNumber, findClientByLead, createCall, listCalls, getOffer, updateOffer, listOffers,
} from "@/lib/vendiora/db";
import { sendClientAuto } from "@/lib/vendiora/automations";
import { readBody, str, int, fail } from "@/lib/vendiora/http";
import { eur } from "@/lib/vendiora/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const leadId = request.nextUrl.searchParams.get("leadId");
  if (leadId) return NextResponse.json({ client: await findClientByLead(leadId) });
  const [clients, calls] = await Promise.all([listClients(), listCalls()]);
  const stats = new Map<string, { done: number; total: number; next: string | null }>();
  const now = new Date().toISOString();
  for (const c of calls) {
    const s = stats.get(c.clientId) ?? { done: 0, total: 0, next: null };
    s.total++;
    if (c.status === "fatta") s.done++;
    if (c.status === "prenotata" && c.scheduledAt && c.scheduledAt >= now && (!s.next || c.scheduledAt < s.next)) s.next = c.scheduledAt;
    stats.set(c.clientId, s);
  }
  return NextResponse.json({ clients: clients.map((c) => ({ ...c, calls: stats.get(c.id) ?? { done: 0, total: 0, next: null } })) });
}

/** Sell a package: client record + contract number + the included calls (+ deal in Finance) */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const body = await readBody(request);
  if (body instanceof NextResponse) return body;

  const pkg = typeof body.packageId === "string" ? await getPackage(body.packageId) : null;
  if (!pkg) return NextResponse.json({ error: "Scegli il pacchetto venduto" }, { status: 400 });
  const lead = typeof body.leadId === "string" && body.leadId ? await getLead(body.leadId) : null;
  if (body.leadId && (!lead || !leadInScope(lead))) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  if (lead) {
    const already = await findClientByLead(lead.id);
    if (already) return NextResponse.json({ error: "Questo lead ha già un pacchetto", client: already }, { status: 409 });
  }
  const name = str(body.name, 255) || lead?.name;
  if (!name) return NextResponse.json({ error: "Nome del cliente obbligatorio" }, { status: 400 });
  const price = body.price === undefined || body.price === null || body.price === "" ? pkg.price : int(body.price, 0, 1e9);
  if (price == null) return NextResponse.json({ error: "Il pacchetto non ha un prezzo: inseriscilo" }, { status: 400 });
  const phone = str(body.phone, 64) || lead?.phone || null;

  try {
    const contractNumber = await nextContractNumber();
    const today = new Date().toISOString();
    const client = await createClient({
      leadId: lead?.id ?? null,
      name,
      email: str(body.email, 255) || lead?.email || null,
      phone,
      phoneE164: normalizePhone(phone) || lead?.phoneE164 || null,
      taxId: str(body.taxId, 64),
      address: str(body.address, 500),
      packageId: pkg.id,
      packageSnapshot: JSON.stringify(pkg),
      packageName: pkg.name,
      price,
      vatRate: pkg.vatRate,
      paymentTerms: str(body.paymentTerms, 2000) || pkg.paymentTerms,
      status: "onboarding",
      contractNumber,
      contractDate: today,
      isPaid: false,
      coach: str(body.coach, 120),
      notes: str(body.notes, 8000),
    });

    for (let i = 1; i <= pkg.includedCalls; i++) {
      await createCall({
        clientId: client.id, clientName: client.name, number: i,
        title: i === 1 ? "Call di avvio" : `Call di affiancamento ${i - 1}`,
        status: "da_prenotare", scheduledAt: null, doneAt: null, notes: null,
      });
    }

    if (lead) {
      const actor = { id: auth.user.id, name: auth.user.name || auth.user.email };
      let updated = await changeStatus(lead, "vinto", actor, { value: price });
      await addLeadEvent({
        leadId: lead.id, type: "note", outcome: null, fromStatus: null, toStatus: null,
        note: `Venduto «${pkg.name}» a ${eur(price)} + IVA · contratto ${contractNumber}`, actorId: actor.id, actorName: actor.name,
      });
      // Vendiora sales stay in Vendiora: the SarconX pipeline only on explicit request
      if (body.finance === true && !updated.dealId) {
        const r = await convertLead(updated, actor, { value: price, title: `${name} · ${pkg.name}` });
        updated = r.lead;
      }
    }

    // The accepted (or latest open) offer becomes this contract
    const offer = typeof body.offerId === "string" && body.offerId ? await getOffer(body.offerId)
      : lead ? (await listOffers({ leadId: lead.id })).find((o) => !o.clientId && (o.status === "accettata" || o.status === "vista" || o.status === "inviata")) ?? null : null;
    if (offer && !offer.clientId) {
      await updateOffer(offer.id, { clientId: client.id, status: "accettata", answeredAt: offer.answeredAt ?? today }).catch(() => {});
    }

    const welcome = body.welcome === false ? { sent: false, reason: "non richiesto" } : await sendClientAuto("welcome", client);
    return NextResponse.json({ client, welcome });
  } catch (e) {
    return fail(e);
  }
}
