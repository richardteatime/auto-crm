import { NextRequest, NextResponse } from "next/server";
import { addLeadEvent, getLead, updateLead } from "@/lib/db/leads";
import { createNotification } from "@/lib/db/notifications";
import { sendPush } from "@/lib/leads/notify";
import { vendioraEnabled } from "@/lib/roles";
import { getOfferByToken, getSettings, updateOffer } from "@/lib/vendiora/db";
import type { VdOffer, VdPackage } from "@/lib/vendiora/types";

// Public Vendiora offer page (no login): the lead opens the link from WhatsApp, reads the
// proposal and accepts or declines it. Only values from the package snapshot, no invented terms.

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ token: string }> };

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const eurFmt = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", useGrouping: "always" });
const eur = (c: number) => eurFmt.format(c / 100);
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }) : "");
const html = (body: string, status = 200) => new NextResponse(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

function expired(o: VdOffer) {
  return o.status === "scaduta" || (!!o.validUntil && Date.parse(o.validUntil) < Date.now() && o.status !== "accettata" && o.status !== "rifiutata");
}

function page(o: VdOffer, company: { name: string; email: string; phone: string }, note?: string) {
  let pkg: Partial<VdPackage> = {};
  try { pkg = o.packageSnapshot ? JSON.parse(o.packageSnapshot) : {}; } catch { pkg = {}; }
  const vat = Math.round((o.price * (o.vatRate ?? 22)) / 100);
  const items = (pkg.deliverables || "").split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  const facts = [
    pkg.includedCalls ? `<li><b>${pkg.includedCalls} call</b> individuali</li>` : "",
    pkg.buildDays ? `<li>Store online in <b>${pkg.buildDays} giorni</b> dalla call di avvio</li>` : "",
    pkg.coachingDays ? `<li>Affiancamento per <b>${pkg.coachingDays} giorni</b></li>` : "",
  ].join("");
  const first = o.name.trim().split(/\s+/)[0];
  const isExpired = expired(o);
  const state =
    o.status === "accettata" ? `<div class="state ok"><b>Hai accettato questa proposta.</b> Grazie ${esc(first)}! Ti contattiamo a breve con il contratto da firmare e i prossimi passi.</div>`
    : o.status === "rifiutata" ? `<div class="state no">Hai indicato che questa proposta non ti interessa. Se cambi idea, scrivici${company.email ? ` a <a href="mailto:${esc(company.email)}">${esc(company.email)}</a>` : ""}.</div>`
    : isExpired ? `<div class="state no">Questa proposta è scaduta il ${date(o.validUntil)}. Scrivici se vuoi riceverne una aggiornata.</div>`
    : `<form method="post" class="actions" onsubmit="return confirmAccept(event)">
        <label class="check"><input type="checkbox" id="ok" required> Ho letto la proposta e voglio procedere</label>
        <div class="btns"><button name="action" value="accept" class="primary">Accetto la proposta</button><button name="action" value="decline" class="ghost" formnovalidate>Non mi interessa</button></div>
        <p class="fine">Accettando confermi che vuoi partire: ti inviamo il contratto con tutte le condizioni da firmare. Nessun pagamento viene richiesto su questa pagina.</p>
      </form>`;
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Proposta ${esc(o.number)} · VendiOra</title>
<style>
  :root{--ink:#111827;--ink2:#374151;--muted:#6b7280;--line:#e5e7eb;--accent:#ea580c;--font:"Helvetica Neue",Helvetica,Arial,sans-serif}
  *{box-sizing:border-box} body{margin:0;background:#f3f4f6;color:var(--ink);font:400 15px/1.55 var(--font)}
  .wrap{max-width:720px;margin:0 auto;padding:24px 16px 48px}
  .card{background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.06);overflow:hidden}
  .top{padding:22px 24px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:12px}
  .brand{font:800 22px/1 var(--font);letter-spacing:-.02em} .brand b{color:var(--accent)}
  .num{font-size:12.5px;color:var(--muted);text-align:right}
  .body{padding:24px}
  h1{font:800 26px/1.2 var(--font);margin:0 0 6px;letter-spacing:-.01em} .tag{color:var(--ink2);margin:0 0 18px}
  .msg{background:#fff7ed;border-left:3px solid var(--accent);padding:12px 14px;border-radius:8px;margin:0 0 20px;white-space:pre-wrap}
  h2{font:700 13px/1 var(--font);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:22px 0 10px}
  ul{margin:0;padding-left:20px} li{margin:0 0 6px}
  .price{border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-top:6px}
  .row{display:flex;justify-content:space-between;padding:4px 0;color:var(--ink2);font-variant-numeric:tabular-nums}
  .row.tot{border-top:1px solid var(--line);margin-top:6px;padding-top:10px;color:var(--ink);font-weight:800;font-size:18px}
  .g{background:#ecfdf5;border-radius:10px;padding:12px 14px;color:#065f46;white-space:pre-wrap}
  .valid{margin-top:14px;font-size:13px;color:var(--muted)}
  .actions{margin-top:24px;border-top:1px solid var(--line);padding-top:20px}
  .check{display:flex;gap:8px;align-items:center;font-weight:600;margin-bottom:14px} .check input{width:18px;height:18px;accent-color:var(--accent)}
  .btns{display:flex;flex-wrap:wrap;gap:10px}
  button{font:700 15px/1 var(--font);border-radius:10px;padding:14px 18px;cursor:pointer;border:1px solid var(--line);background:#fff;color:var(--ink2)}
  button.primary{background:var(--accent);border-color:var(--accent);color:#fff;flex:1;min-width:220px}
  .fine{font-size:12.5px;color:var(--muted);margin:12px 0 0}
  .state{margin-top:24px;padding:16px;border-radius:12px} .state.ok{background:#ecfdf5;color:#065f46} .state.no{background:#f3f4f6;color:var(--ink2)}
  .note{background:#fef3c7;color:#92400e;padding:10px 14px;border-radius:10px;margin-bottom:14px;font-weight:600}
  .foot{text-align:center;font-size:12px;color:var(--muted);margin-top:18px}
</style></head><body><div class="wrap">
${note ? `<div class="note">${esc(note)}</div>` : ""}
<div class="card">
  <div class="top"><div class="brand">Vendi<b>Ora</b></div><div class="num">Proposta ${esc(o.number)}<br>del ${date(o.sentAt || o.createdAt)}</div></div>
  <div class="body">
    <p style="margin:0 0 4px;color:var(--muted)">Per ${esc(o.name)}</p>
    <h1>${esc(o.packageName)}</h1>
    ${pkg.tagline ? `<p class="tag">${esc(pkg.tagline)}</p>` : ""}
    ${o.message ? `<div class="msg">${esc(o.message)}</div>` : ""}
    ${items.length ? `<h2>Cosa comprende</h2><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
    ${facts ? `<h2>Tempi e affiancamento</h2><ul>${facts}</ul>` : ""}
    ${pkg.guarantee ? `<h2>Garanzia</h2><div class="g">${esc(pkg.guarantee)}</div>` : ""}
    <h2>Investimento</h2>
    <div class="price">
      <div class="row"><span>Prezzo</span><span>${eur(o.price)}</span></div>
      <div class="row"><span>IVA ${o.vatRate ?? 22}%</span><span>${eur(vat)}</span></div>
      <div class="row tot"><span>Totale</span><span>${eur(o.price + vat)}</span></div>
    </div>
    ${pkg.paymentTerms ? `<p style="margin:10px 0 0;color:var(--ink2);white-space:pre-wrap"><b>Pagamento:</b> ${esc(pkg.paymentTerms)}</p>` : ""}
    ${o.validUntil && !isExpired && o.status !== "accettata" && o.status !== "rifiutata" ? `<p class="valid">Proposta valida fino al <b>${date(o.validUntil)}</b>.</p>` : ""}
    ${state}
  </div>
</div>
<p class="foot">${esc(company.name || "VendiOra")}${company.email ? ` · ${esc(company.email)}` : ""}${company.phone ? ` · ${esc(company.phone)}` : ""}</p>
</div>
<script>function confirmAccept(e){var b=e.submitter;if(b&&b.value==='decline')return confirm('Vuoi davvero rifiutare la proposta?');return true;}</script>
</body></html>`;
}

const notFound = () => html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:16px Helvetica,Arial,sans-serif;padding:40px;text-align:center;color:#374151">Proposta non trovata. Controlla il link o scrivici.</body>`, 404);

export async function GET(request: NextRequest, { params }: Ctx) {
  if (!vendioraEnabled()) return notFound();
  const { token } = await params;
  let o = await getOfferByToken(token).catch(() => null);
  if (!o) return notFound();
  const { company } = await getSettings();
  const preview = request.nextUrl.searchParams.get("anteprima") === "1";
  if (!preview && (o.status === "inviata" || o.status === "bozza") && !expired(o)) {
    o = await updateOffer(o.id, { status: "vista", viewedAt: o.viewedAt ?? new Date().toISOString() }).catch(() => o!);
  }
  return html(page(o, company, preview ? "Anteprima interna: aprendola da qui non risulta «vista» dal lead." : undefined));
}

export async function POST(request: NextRequest, { params }: Ctx) {
  if (!vendioraEnabled()) return notFound();
  const { token } = await params;
  const o = await getOfferByToken(token).catch(() => null);
  if (!o) return notFound();
  const { company, bot } = await getSettings();
  const form = await request.formData().catch(() => null);
  const action = form?.get("action");
  if ((action !== "accept" && action !== "decline") || o.status === "accettata" || o.status === "rifiutata" || expired(o)) {
    return html(page(o, company));
  }
  const accept = action === "accept";
  const now = new Date().toISOString();
  const next = await updateOffer(o.id, { status: accept ? "accettata" : "rifiutata", answeredAt: now });
  if (o.leadId) {
    const lead = await getLead(o.leadId).catch(() => null);
    await addLeadEvent({
      leadId: o.leadId, type: "note", outcome: null, fromStatus: null, toStatus: null,
      note: accept ? `✅ Il lead ha ACCETTATO online l'offerta ${o.number} («${o.packageName}»)` : `Il lead ha rifiutato online l'offerta ${o.number}`,
      actorId: null, actorName: "Vendiora",
    }).catch(() => {});
    await updateLead(o.leadId, { lastContactAt: now }).catch(() => {});
    const title = accept ? `${o.name} ha accettato l'offerta 🎉` : `${o.name} ha rifiutato l'offerta`;
    const body = accept ? `«${o.packageName}»: prepara il contratto («Ha comprato»)` : `Offerta ${o.number}`;
    const ids = bot.handoffUserIds;
    await sendPush({ title, body, url: `/leads/${o.leadId}`, tag: `offer-${o.id}` }, ids.length ? ids : undefined).catch(() => 0);
    for (const userId of ids) {
      await createNotification({ userId, type: "lead_whatsapp", title, body, relatedId: o.leadId, relatedType: "lead", fromUserName: lead?.name || "Vendiora" }).catch(() => {});
    }
  }
  return html(page(next, company));
}
