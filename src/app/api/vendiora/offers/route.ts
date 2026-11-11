import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getLead, leadInScope, addLeadEvent } from "@/lib/db/leads";
import { changeStatus } from "@/lib/leads/service";
import { createOffer, getPackage, getSettings, listOffers } from "@/lib/vendiora/db";
import { offerText, offerUrl } from "@/lib/vendiora/automations";
import { readBody, str, int, fail } from "@/lib/vendiora/http";
import { eur } from "@/lib/vendiora/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const leadId = request.nextUrl.searchParams.get("leadId") || undefined;
  const [offers, settings] = await Promise.all([listOffers({ leadId }), getSettings()]);
  return NextResponse.json({ offers: offers.map((o) => ({ ...o, url: offerUrl(o), text: offerText(settings, o) })) });
}

/** New offer for a lead: package snapshot + price, valid N days. Sending is a separate step. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const b = await readBody(request);
  if (b instanceof NextResponse) return b;
  const pkg = typeof b.packageId === "string" ? await getPackage(b.packageId) : null;
  if (!pkg) return NextResponse.json({ error: "Scegli il pacchetto da proporre" }, { status: 400 });
  const lead = typeof b.leadId === "string" && b.leadId ? await getLead(b.leadId) : null;
  if (!lead || !leadInScope(lead)) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  const price = b.price === undefined || b.price === null || b.price === "" ? pkg.price : int(b.price, 0, 1e9);
  if (price == null) return NextResponse.json({ error: "Il pacchetto non ha un prezzo: inseriscilo" }, { status: 400 });
  const settings = await getSettings();
  const days = int(b.validDays, 1, 90) ?? settings.automations.offerValidDays;
  try {
    const offer = await createOffer({
      leadId: lead.id,
      name: str(b.name, 255) || lead.name,
      email: lead.email,
      phoneE164: lead.phoneE164,
      packageId: pkg.id,
      packageSnapshot: JSON.stringify(pkg),
      packageName: pkg.name,
      price,
      vatRate: pkg.vatRate,
      message: str(b.message, 4000),
      validUntil: new Date(Date.now() + days * 86_400_000).toISOString(),
    });
    const actor = { id: auth.user.id, name: auth.user.name || auth.user.email };
    await addLeadEvent({
      leadId: lead.id, type: "note", outcome: null, fromStatus: null, toStatus: null,
      note: `Offerta ${offer.number} preparata: «${pkg.name}» a ${eur(price)} + IVA`, actorId: actor.id, actorName: actor.name,
    });
    if (lead.status === "nuovo" || lead.status === "da_richiamare" || lead.status === "appuntamento") {
      await changeStatus(lead, "proposta", actor, { value: price }).catch(() => null);
    }
    return NextResponse.json({ offer: { ...offer, url: offerUrl(offer), text: offerText(settings, offer) } });
  } catch (e) {
    return fail(e);
  }
}
