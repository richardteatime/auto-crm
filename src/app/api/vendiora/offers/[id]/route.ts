import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { addLeadEvent } from "@/lib/db/leads";
import { deleteOffer, getOffer, getSettings, updateOffer, type OfferPatch } from "@/lib/vendiora/db";
import { offerText, offerUrl, sendOffer } from "@/lib/vendiora/automations";
import { readBody, fail } from "@/lib/vendiora/http";
import { OFFER_STATUSES, type OfferStatus } from "@/lib/vendiora/types";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

/**
 * { action: "send" }   → WhatsApp from the connected number (falls back: the UI opens wa.me with the same text)
 * { action: "mark_sent" } → sent by hand (wa.me / email)
 * { status }           → accepted / declined / back to draft by hand
 */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const o = await getOffer(id);
  if (!o) return NextResponse.json({ error: "Offerta non trovata" }, { status: 404 });
  const b = await readBody(request);
  if (b instanceof NextResponse) return b;
  const actor = { id: auth.user.id, name: auth.user.name || auth.user.email };
  const now = new Date().toISOString();
  try {
    if (b.action === "send" || b.action === "mark_sent") {
      let sent = { sent: true } as { sent: boolean; reason?: string };
      if (b.action === "send") {
        sent = await sendOffer(o);
        if (!sent.sent) return NextResponse.json({ error: sent.reason || "Invio non riuscito", fallback: true }, { status: 409 });
      } else if (o.leadId) {
        await addLeadEvent({
          leadId: o.leadId, type: "note", outcome: null, fromStatus: null, toStatus: null,
          note: `Offerta ${o.number} inviata a mano`, actorId: actor.id, actorName: actor.name,
        });
      }
      const p: OfferPatch = { sentAt: o.sentAt ?? now };
      if (o.status === "bozza" || o.status === "scaduta") p.status = "inviata";
      const offer = await updateOffer(id, p);
      const s = await getSettings();
      return NextResponse.json({ offer: { ...offer, url: offerUrl(offer), text: offerText(s, offer) }, whatsapp: b.action === "send" });
    }
    // Payment link / installments / objection / client data editable until paid
    if (b.action === "update") {
      const p: OfferPatch = {};
      if ("paymentLink" in b) {
        const v = typeof b.paymentLink === "string" ? b.paymentLink.trim() : "";
        if (v && !/^https?:\/\//i.test(v)) return NextResponse.json({ error: "Link di pagamento non valido" }, { status: 400 });
        p.paymentLink = v ? v.slice(0, 1000) : null;
      }
      if ("installments" in b) { const n = Math.max(1, Math.min(12, Number(b.installments) || 1)); p.payPlan = n > 1 ? { n } : null; }
      if ("objection" in b) p.objection = ["prezzo", "tempo", "socio", "fiducia"].includes(String(b.objection)) ? String(b.objection) : null;
      if ("mode" in b) p.mode = b.mode === "proposta" ? "proposta" : "firma";
      for (const k of ["taxId", "address"] as const) if (k in b && !o.signedAt) p[k] = typeof b[k] === "string" ? (b[k] as string).trim().slice(0, 300) || null : null;
      const offer = await updateOffer(id, p);
      const s = await getSettings();
      return NextResponse.json({ offer: { ...offer, url: offerUrl(offer), text: offerText(s, offer) } });
    }
    // Payment received → client (contract) + activation of the package (M5, calls calendar)
    if (b.action === "paid") {
      if (!o.signedAt && b.force !== true) return NextResponse.json({ error: "Il contratto non è ancora firmato. Se è stato firmato fuori dal CRM conferma di nuovo.", needForce: true }, { status: 409 });
      const offer = await updateOffer(id, { paidAt: o.paidAt ?? now, status: "accettata", answeredAt: o.answeredAt ?? now, signedAt: o.signedAt ?? (b.force === true ? now : null) });
      const { clientFromOffer, activateClient } = await import("@/lib/vendiora/engine");
      const cl = await clientFromOffer(offer);
      const { updateClient } = await import("@/lib/vendiora/db");
      await updateClient(cl.id, { isPaid: true, paidAt: offer.paidAt, contractSignedAt: offer.signedAt ?? now, taxId: cl.taxId ?? offer.taxId ?? null, address: cl.address ?? offer.address ?? null });
      const act = await activateClient(cl.id);
      if (o.leadId) await addLeadEvent({ leadId: o.leadId, type: "note", outcome: null, fromStatus: null, toStatus: null, note: `💶 Pagamento dell'offerta ${o.number} registrato: percorso attivato`, actorId: actor.id, actorName: actor.name }).catch(() => {});
      const s = await getSettings();
      return NextResponse.json({ offer: { ...(await getOffer(id))!, url: offerUrl(offer), text: offerText(s, offer) }, clientId: cl.id, activation: act });
    }
    if (typeof b.status === "string" && (OFFER_STATUSES as readonly string[]).includes(b.status)) {
      const status = b.status as OfferStatus;
      const p: OfferPatch = { status };
      if (status === "accettata" || status === "rifiutata") p.answeredAt = now;
      const offer = await updateOffer(id, p);
      if (o.leadId && status !== o.status) {
        await addLeadEvent({
          leadId: o.leadId, type: "note", outcome: null, fromStatus: null, toStatus: null,
          note: `Offerta ${o.number}: segnata «${status}»`, actorId: actor.id, actorName: actor.name,
        });
      }
      const s = await getSettings();
      return NextResponse.json({ offer: { ...offer, url: offerUrl(offer), text: offerText(s, offer) } });
    }
    return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const o = await getOffer(id);
  if (!o) return NextResponse.json({ error: "Offerta non trovata" }, { status: 404 });
  if (o.clientId) return NextResponse.json({ error: "L'offerta è già diventata un contratto" }, { status: 409 });
  try { await deleteOffer(id); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
}
