import { NextRequest, NextResponse } from "next/server";
import { addLeadEvent, getLead, updateLead } from "@/lib/db/leads";
import { createNotification } from "@/lib/db/notifications";
import { sendPush } from "@/lib/leads/notify";
import { vendioraEnabled } from "@/lib/roles";
import { getOfferByToken, getSettings, updateOffer } from "@/lib/vendiora/db";
import { buildContract, contractHtml, CONTRACT_CSS, installments, offerContractInput, sha256 } from "@/lib/vendiora/contract";
import { playbookPackage } from "@/lib/vendiora/playbook";
import type { VdOffer, VendioraSettings } from "@/lib/vendiora/types";

// Public VendiOra offer page (no login). The lead reads the offer and the full contract (official model,
// 16 articles + Allegato A of the package sold) and signs it with "accetto e firmo" (name, date, IP and
// SHA-256 of the frozen text). Then the payment link is shown. Only values from the documents and the
// settings: what is missing stays "[DA INSERIRE]".

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ token: string }> };

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const eurFmt = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", useGrouping: "always" });
const eur = (c: number) => eurFmt.format(c / 100);
const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }) : "");
const dateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }) : "");
const html = (body: string, status = 200) => new NextResponse(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

function expired(o: VdOffer) {
  return o.status === "scaduta" || (!!o.validUntil && Date.parse(o.validUntil) < Date.now() && !o.signedAt && o.status !== "accettata" && o.status !== "rifiutata");
}

function page(o: VdOffer, s: VendioraSettings, opts: { note?: string; error?: string } = {}) {
  const company = s.company;
  const brand = s.playbook.brand || "VendiOra";
  const pb = playbookPackage(o.packageCode);
  const vatMode = s.playbook.contract.vat;
  const vat = vatMode === "inclusa" ? 0 : Math.round((o.price * (o.vatRate ?? 22)) / 100);
  const rates = installments(o.price, o.payPlan ?? null);
  const doc = buildContract(offerContractInput(o), s);
  const first = o.name.trim().split(/\s+/)[0];
  const isExpired = expired(o);
  const sheet = pb ? pb.sheet : [];
  const facts = pb
    ? [`<li><b>${pb.calls.length} call</b> individuali (${esc(pb.durationLabel)})</li>`, ...pb.calls.slice(0, 12).map((c) => `<li><b>${esc(c.code)}</b> · ${esc(c.title)} <span class="muted">– ${esc(c.when)}</span></li>`)].join("")
    : "";
  const pay = o.paymentLink
    ? `<a class="paybtn" href="${esc(o.paymentLink)}" target="_blank" rel="noopener">Vai al pagamento ${rates.length > 1 ? `della 1ª rata (${eur(rates[0].amount)})` : `(${eur(o.price + vat)})`}</a>`
    : `<p class="fine">Il link di pagamento ti arriva su WhatsApp dal tuo referente.</p>`;
  let state: string;
  if (o.paidAt) state = `<div class="state ok"><b>Contratto firmato e pagamento ricevuto. Benvenuto in ${esc(brand)}, ${esc(first)}! 🎉</b><br>Tra pochi minuti ti scriviamo su WhatsApp con il kit di benvenuto e il link per prenotare la prima call.</div>`;
  else if (o.signedAt) state = `<div class="state ok"><b>Hai firmato il contratto il ${dateTime(o.signedAt)}.</b> Grazie ${esc(first)}!<br>Ultimo passo: completa il pagamento per attivare il percorso.</div>${pay}`;
  else if (o.status === "rifiutata") state = `<div class="state no">Hai indicato che questa proposta non ti interessa. Se cambi idea, scrivici${company.email ? ` a <a href="mailto:${esc(company.email)}">${esc(company.email)}</a>` : ""}.</div>`;
  else if (isExpired) state = `<div class="state no">Questa proposta è scaduta il ${date(o.validUntil)}. Scrivici se vuoi riceverne una aggiornata.</div>`;
  else state = `<form method="post" class="actions" onsubmit="return confirmAccept(event)">
      <h2>Firma il contratto</h2>
      ${opts.error ? `<div class="note">${esc(opts.error)}</div>` : ""}
      <label class="field">Nome e cognome (o ragione sociale) <input name="signName" required minlength="3" maxlength="160" value="${esc(o.name)}" autocomplete="name"></label>
      <div class="two">
        <label class="field">Codice fiscale / P.IVA <input name="taxId" maxlength="40" value="${esc(o.taxId ?? "")}" required></label>
        <label class="field">Indirizzo <input name="address" maxlength="300" value="${esc(o.address ?? "")}" required autocomplete="street-address"></label>
      </div>
      <label class="check"><input type="checkbox" name="ok" value="1" required> Ho letto l'offerta e il contratto (articoli 1–16 e Allegato A) e li accetto.</label>
      <label class="check"><input type="checkbox" name="ok1341" value="1" required> Approvo specificamente, ai sensi degli artt. 1341 e 1342 c.c., le clausole elencate nella sezione «Approvazione specifica delle clausole».</label>
      <div class="btns"><button name="action" value="accept" class="primary">Accetto e firmo</button><button name="action" value="decline" class="ghost" formnovalidate>Non mi interessa</button></div>
      <p class="fine">Cliccando «Accetto e firmo» il contratto viene registrato con il tuo nome, la data, l'ora e l'indirizzo IP, e ne viene salvata un'impronta digitale (SHA-256) del testo. Subito dopo trovi il link di pagamento.</p>
    </form>`;
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Offerta ${esc(o.number)} · ${esc(brand)}</title>
<style>
  :root{--ink:#111827;--ink2:#374151;--muted:#6b7280;--line:#e5e7eb;--accent:#ea580c;--font:"Helvetica Neue",Helvetica,Arial,sans-serif}
  *{box-sizing:border-box} body{margin:0;background:#f3f4f6;color:var(--ink);font:400 15px/1.55 var(--font)}
  .wrap{max-width:760px;margin:0 auto;padding:24px 16px 48px}
  .card{background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.06);overflow:hidden;margin-bottom:16px}
  .top{padding:22px 24px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:12px}
  .brand{font:800 22px/1 var(--font);letter-spacing:-.02em} .brand b{color:var(--accent)}
  .num{font-size:12.5px;color:var(--muted);text-align:right}
  .body{padding:24px}
  h1{font:800 26px/1.2 var(--font);margin:0 0 6px;letter-spacing:-.01em} .tag{color:var(--ink2);margin:0 0 18px}
  .msg{background:#fff7ed;border-left:3px solid var(--accent);padding:12px 14px;border-radius:8px;margin:0 0 20px;white-space:pre-wrap}
  h2{font:700 13px/1 var(--font);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:22px 0 10px}
  ul{margin:0;padding-left:20px} li{margin:0 0 6px} .muted{color:var(--muted)}
  .price{border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-top:6px}
  .row{display:flex;justify-content:space-between;padding:4px 0;color:var(--ink2);font-variant-numeric:tabular-nums}
  .row.tot{border-top:1px solid var(--line);margin-top:6px;padding-top:10px;color:var(--ink);font-weight:800;font-size:18px}
  .valid{margin-top:14px;font-size:13px;color:var(--muted)}
  details.ct{border:1px solid var(--line);border-radius:12px;margin-top:20px} details.ct summary{cursor:pointer;padding:14px 16px;font-weight:700}
  .contract{padding:4px 18px 18px;max-height:70vh;overflow:auto;border-top:1px solid var(--line)}
  ${CONTRACT_CSS}
  .actions{margin-top:24px;border-top:1px solid var(--line);padding-top:6px}
  .field{display:block;font-size:13px;font-weight:600;color:var(--ink2);margin:0 0 12px} .field input{display:block;width:100%;margin-top:4px;font:400 15px var(--font);padding:11px 12px;border:1px solid var(--line);border-radius:10px}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:0 12px} @media(max-width:560px){.two{grid-template-columns:1fr}}
  .check{display:flex;gap:10px;align-items:flex-start;font-weight:600;margin:0 0 12px;font-size:14px} .check input{width:18px;height:18px;margin-top:2px;flex:none;accent-color:var(--accent)}
  .btns{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}
  button{font:700 15px/1 var(--font);border-radius:10px;padding:14px 18px;cursor:pointer;border:1px solid var(--line);background:#fff;color:var(--ink2)}
  button.primary{background:var(--accent);border-color:var(--accent);color:#fff;flex:1;min-width:220px}
  .paybtn{display:block;text-align:center;margin-top:14px;background:var(--accent);color:#fff;font:700 16px/1 var(--font);border-radius:10px;padding:16px;text-decoration:none}
  .fine{font-size:12.5px;color:var(--muted);margin:12px 0 0}
  .state{margin-top:24px;padding:16px;border-radius:12px} .state.ok{background:#ecfdf5;color:#065f46} .state.no{background:#f3f4f6;color:var(--ink2)}
  .note{background:#fef3c7;color:#92400e;padding:10px 14px;border-radius:10px;margin-bottom:14px;font-weight:600}
  .foot{text-align:center;font-size:12px;color:var(--muted);margin-top:18px}
</style></head><body><div class="wrap">
${opts.note ? `<div class="note">${esc(opts.note)}</div>` : ""}
<div class="card">
  <div class="top"><div class="brand">Vendi<b>Ora</b></div><div class="num">Offerta ${esc(o.number)}<br>del ${date(o.sentAt || o.createdAt)}</div></div>
  <div class="body">
    <p style="margin:0 0 4px;color:var(--muted)">Per ${esc(o.name)}</p>
    <h1>${esc(o.packageName)}</h1>
    ${pb ? `<p class="tag">${esc(pb.forWho)}</p>` : ""}
    ${o.message ? `<div class="msg">${esc(o.message)}</div>` : ""}
    ${sheet.length ? `<h2>Cosa comprende</h2><ul>${sheet.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
    ${facts ? `<h2>Il calendario delle call</h2><ul>${facts}</ul>` : ""}
    <h2>Investimento</h2>
    <div class="price">
      <div class="row"><span>Prezzo</span><span>${eur(o.price)}</span></div>
      ${vatMode === "inclusa" ? `<div class="row"><span>IVA</span><span>inclusa</span></div>` : `<div class="row"><span>IVA ${o.vatRate ?? 22}%</span><span>${eur(vat)}</span></div>`}
      <div class="row tot"><span>Totale</span><span>${eur(o.price + vat)}</span></div>
      ${rates.length > 1 ? rates.map((r, i) => `<div class="row"><span>Rata ${i + 1} ${i === 0 ? "alla firma" : `a ${r.day} giorni`}</span><span>${eur(r.amount)}</span></div>`).join("") : ""}
    </div>
    ${o.validUntil && !isExpired && !o.signedAt && o.status !== "rifiutata" ? `<p class="valid">Offerta valida fino al <b>${date(o.validUntil)}</b>.</p>` : ""}
    <details class="ct"${o.signedAt ? "" : " open"}><summary>Contratto di fornitura servizi e consulenza${o.signedAt ? " (firmato)" : " – leggilo prima di firmare"}</summary>
      <div class="contract">${o.signedAt && o.contractText ? `<pre style="white-space:pre-wrap;font:13px/1.55 var(--font)">${esc(o.contractText)}</pre>` : contractHtml(doc)}</div>
    </details>
    ${state}
  </div>
</div>
<p class="foot">${esc(company.name || brand)}${company.email ? ` · ${esc(company.email)}` : ""}${company.phone ? ` · ${esc(company.phone)}` : ""}</p>
</div>
<script>function confirmAccept(e){var b=e.submitter;if(b&&b.value==='decline')return confirm('Vuoi davvero rifiutare la proposta?');return true;}</script>
</body></html>`;
}

const notFound = () => html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:16px Helvetica,Arial,sans-serif;padding:40px;text-align:center;color:#374151">Offerta non trovata. Controlla il link o scrivici.</body>`, 404);

export async function GET(request: NextRequest, { params }: Ctx) {
  if (!vendioraEnabled()) return notFound();
  const { token } = await params;
  let o = await getOfferByToken(token).catch(() => null);
  if (!o) return notFound();
  const s = await getSettings();
  const preview = request.nextUrl.searchParams.get("anteprima") === "1";
  if (!preview && (o.status === "inviata" || o.status === "bozza") && !expired(o)) {
    o = await updateOffer(o.id, { status: "vista", viewedAt: o.viewedAt ?? new Date().toISOString() }).catch(() => o!);
  }
  return html(page(o, s, { note: preview ? "Anteprima interna: aprendola da qui non risulta «vista» dal lead." : undefined }));
}

async function alertTeam(s: VendioraSettings, o: VdOffer, title: string, body: string, fromName: string) {
  const ids = [...new Set([...(s.playbook.team.commerciale ?? []), ...(s.playbook.team.admin ?? []), ...s.bot.handoffUserIds])];
  const url = o.leadId ? `/leads/${o.leadId}` : "/vendiora/offerte";
  await sendPush({ title, body, url, tag: `offer-${o.id}` }, ids.length ? ids : undefined).catch(() => 0);
  for (const userId of ids) {
    await createNotification({ userId, type: "lead_whatsapp", title, body, relatedId: o.leadId, relatedType: o.leadId ? "lead" : null, fromUserName: fromName }).catch(() => {});
  }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  if (!vendioraEnabled()) return notFound();
  const { token } = await params;
  const o = await getOfferByToken(token).catch(() => null);
  if (!o) return notFound();
  const s = await getSettings();
  const form = await request.formData().catch(() => null);
  const action = form?.get("action");
  if ((action !== "accept" && action !== "decline") || o.signedAt || o.status === "rifiutata" || expired(o)) return html(page(o, s));
  const now = new Date().toISOString();
  const lead = o.leadId ? await getLead(o.leadId).catch(() => null) : null;
  if (action === "decline") {
    const next = await updateOffer(o.id, { status: "rifiutata", answeredAt: now });
    if (o.leadId) await addLeadEvent({ leadId: o.leadId, type: "note", outcome: null, fromStatus: null, toStatus: null, note: `Il lead ha rifiutato online l'offerta ${o.number}`, actorId: null, actorName: "VendiOra" }).catch(() => {});
    await alertTeam(s, o, `${o.name} ha rifiutato l'offerta`, `Offerta ${o.number}`, lead?.name || "VendiOra");
    return html(page(next, s));
  }
  const g = (k: string, max: number) => String(form?.get(k) ?? "").trim().slice(0, max);
  const signName = g("signName", 160);
  const taxId = g("taxId", 40);
  const address = g("address", 300);
  if (signName.length < 3 || form?.get("ok") !== "1" || form?.get("ok1341") !== "1" || !taxId || !address) {
    return html(page({ ...o, taxId: taxId || o.taxId, address: address || o.address }, s, { error: "Per firmare servono nome, C.F./P.IVA, indirizzo e le due spunte di accettazione." }));
  }
  const ip = (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "").split(",")[0].trim().slice(0, 60) || null;
  const doc = buildContract(offerContractInput({ ...o, taxId, address }, signName, now), s);
  const ua = (request.headers.get("user-agent") || "").slice(0, 200);
  const contractText = `${doc.text}\n\n—\nFirmato elettronicamente da ${signName} il ${dateTime(now)} (IP ${ip ?? "n/d"}; ${ua}).`;
  const signHash = await sha256(contractText);
  const next = await updateOffer(o.id, {
    status: "accettata", answeredAt: now, signedAt: now, signName, signIp: ip, signHash, contractText: contractText.slice(0, 60000), taxId, address,
  });
  if (o.leadId) {
    await addLeadEvent({
      leadId: o.leadId, type: "note", outcome: null, fromStatus: null, toStatus: null,
      note: `✍️ ${signName} ha FIRMATO online il contratto dell'offerta ${o.number} («${o.packageName}», ${eur(o.price)}). IP ${ip ?? "n/d"} · impronta ${signHash.slice(0, 16)}…${o.paymentLink ? "" : "\nManca il link di pagamento: invialo dalla scheda offerta."}`,
      actorId: null, actorName: "VendiOra",
    }).catch(() => {});
    await updateLead(o.leadId, { lastContactAt: now }).catch(() => {});
  }
  await alertTeam(s, o, `${o.name} ha firmato il contratto ✍️`, `«${o.packageName}» ${eur(o.price)}: ${o.paymentLink ? "in attesa del pagamento" : "manda il link di pagamento"}`, lead?.name || "VendiOra");
  return html(page(next, s));
}
