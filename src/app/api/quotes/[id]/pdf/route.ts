import { NextRequest } from "next/server";
import { getQuote } from "@/lib/db/quotes";
import { requireAuth } from "@/lib/auth";
import { getDeal } from "@/lib/db/deals";
import { getContact } from "@/lib/db/contacts";
import {
  buildPaymentSchedule,
  describePaymentTerms,
  parsePaymentTerms,
  type PaymentTerms,
} from "@/lib/quote-payment";
import { parseDbItems, type DbQuoteItem } from "@/lib/quote-items";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Commercial proposal document (A4, print-ready HTML; "Scarica PDF" prints it).
// Amounts are stored in cents.
// ---------------------------------------------------------------------------

interface CompanyConfig {
  name?: string;
  address?: string;
  vatNumber?: string;
  phone?: string;
  email?: string;
  iban?: string;
  bankHolder?: string;
  paymentTerms?: string;
}

function loadCompanyConfig(): CompanyConfig {
  const candidates = [
    path.join(/*turbopackIgnore: true*/ process.cwd(), "crm-config.json"),
    path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "crm-config.json"),
  ];
  for (const configPath of candidates) {
    try {
      const json = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (json.company) return json.company;
    } catch {
      // try next
    }
  }
  return {};
}

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const eurFmt = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", useGrouping: "always" });
const eurShortFmt = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  useGrouping: "always",
});

function eur(cents: number): string {
  return eurFmt.format(cents / 100);
}

/** No decimals when the amount is a whole number of euros. */
function eurShort(cents: number): string {
  return cents % 100 === 0 ? eurShortFmt.format(cents / 100) : eurFmt.format(cents / 100);
}

function toDate(d: Date | number | string | null | undefined): Date | null {
  if (!d) return null;
  if (d instanceof Date) return d;
  return new Date(typeof d === "number" ? (d < 1e12 ? d * 1000 : d) : d);
}

function dateIt(d: Date | number | string | null | undefined): string {
  const date = toDate(d);
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

function num(v: unknown): number {
  return typeof v === "number" ? v : parseFloat(String(v ?? "")) || 0;
}

function lineGross(item: DbQuoteItem): number {
  return Math.round(num(item.quantity) * num(item.unitPrice));
}

function lineTotal(item: DbQuoteItem): number {
  return Math.round(num(item.quantity) * num(item.unitPrice) * (1 - num(item.discount) / 100));
}

/** Long description: plain lines become paragraphs, "- " lines a bullet list. */
function renderDetails(text: string | undefined): string {
  if (!text?.trim()) return "";
  const out: string[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) out.push(`<ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`);
    bullets = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const m = line.match(/^[-*•·]\s+(.*)$/);
    if (m) {
      bullets.push(m[1]);
      continue;
    }
    flush();
    out.push(`<p>${esc(line)}</p>`);
  }
  flush();
  return `<div class="details">${out.join("")}</div>`;
}

function shortPaymentLabel(terms: PaymentTerms | null): string {
  if (!terms) return "Bonifico bancario";
  switch (terms.method) {
    case "consegna":
      return "Alla consegna";
    case "anticipato":
      return "All'accettazione";
    case "30gg":
      return "30 giorni d.f.";
    case "60gg":
      return "60 giorni d.f.";
    case "rate":
      return `${terms.installments ?? 3} rate mensili`;
    case "acconto_saldo":
      return `Acconto ${terms.depositPercent ?? 50}% + saldo`;
    case "personalizzato":
      return "Come concordato";
  }
}

const BILLING_LABEL: Record<string, string> = {
  una_tantum: "Una tantum",
  mensile: "Canone mensile",
  annuale: "Canone annuale",
};
const BILLING_SUFFIX: Record<string, string> = { una_tantum: "", mensile: "/mese", annuale: "/anno" };

const MARK_SVG = `<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="15" fill="#0a0a0a"/><path d="M43 17 22 47M22 17l21 30" fill="none" stroke="#3d6bff" stroke-width="6.2" stroke-linecap="round"/><path d="M20 21.5h15.7c5 0 8.2 2.55 8.2 6.55 0 4.15-3.25 6.55-8.55 6.55H28.5c-5.15 0-8.45 2.35-8.45 6.45 0 4.2 3.45 6.95 8.8 6.95H44" fill="none" stroke="#ffffff" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="21.5" r="3.15" fill="#3d6bff"/><circle cx="44" cy="48" r="3.15" fill="#3d6bff"/></svg>`;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(_req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) return new Response("Preventivo non trovato", { status: 404 });

  const deal = quote.dealId ? await getDeal(quote.dealId) : null;
  const contact = deal?.contactId ? await getContact(deal.contactId) : null;
  const company = loadCompanyConfig();
  const companyName = company.name || "SarconX";

  // --- Items & totals -------------------------------------------------------
  const items = parseDbItems(quote.items);
  const ordered = [...items.filter((i) => i.isSetup), ...items.filter((i) => !i.isSetup)];
  const billingOf = (i: DbQuoteItem) => (i.isSetup ? "una_tantum" : i.billingType ?? "una_tantum");

  const oneOffSub = ordered.filter((i) => billingOf(i) === "una_tantum").reduce((s, i) => s + lineTotal(i), 0);
  const monthlySub = ordered.filter((i) => billingOf(i) === "mensile").reduce((s, i) => s + lineTotal(i), 0);
  const annualSub = ordered.filter((i) => billingOf(i) === "annuale").reduce((s, i) => s + lineTotal(i), 0);
  const vatRate = num(quote.vatRate);
  const vatOf = (c: number) => Math.round((c * vatRate) / 100);
  const oneOffTotal = oneOffSub + vatOf(oneOffSub);
  const firstYearSub = oneOffSub + monthlySub * 12 + annualSub;
  const firstYearTotal = firstYearSub + vatOf(firstYearSub);
  const hasRecurring = monthlySub > 0 || annualSub > 0;

  // --- Payment --------------------------------------------------------------
  const terms = parsePaymentTerms(quote.paymentTerms);
  const schedule = terms ? buildPaymentSchedule(terms, oneOffTotal) : [];
  const paymentText = terms
    ? describePaymentTerms(terms)
    : company.paymentTerms || "Bonifico bancario a 30 giorni data fattura.";

  // --- People ---------------------------------------------------------------
  const clientName = contact?.company || contact?.name || "Cliente";
  const attention = contact?.company && contact?.name ? contact.name : "";
  const firstName = (contact?.name || "").trim().split(/\s+/)[0];
  const issued = dateIt(quote.createdAt);
  const validUntil = dateIt(quote.validUntil);

  // --- Sections -------------------------------------------------------------
  const itemRows = ordered
    .map((item, idx) => {
      const billing = billingOf(item);
      const suffix = BILLING_SUFFIX[billing] ?? "";
      const qty = num(item.quantity);
      const discount = num(item.discount);
      const meta = [
        BILLING_LABEL[billing],
        qty > 1 ? `${qty} × ${eur(num(item.unitPrice) * (1 - discount / 100))}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `
      <article class="item">
        <div class="item-n">${String(idx + 1).padStart(2, "0")}</div>
        <div class="item-body">
          <h3>${esc(item.description) || "Voce senza titolo"}</h3>
          <div class="item-meta">${esc(meta)}</div>
          ${renderDetails(item.details)}
        </div>
        <div class="item-price">
          ${discount > 0 ? `<div class="was"><s>${eurShort(lineGross(item))}</s> <span>−${discount}%</span></div>` : ""}
          <div class="now">${eurShort(lineTotal(item))}<small>${suffix}</small></div>
        </div>
      </article>`;
    })
    .join("");

  const summaryCells = [
    oneOffSub > 0 && { k: "Investimento iniziale", v: eurShort(oneOffSub), n: "IVA esclusa" },
    monthlySub > 0 && { k: "Canone mensile", v: eurShort(monthlySub), n: "al mese, IVA esclusa" },
    annualSub > 0 && { k: "Canone annuale", v: eurShort(annualSub), n: "all'anno, IVA esclusa" },
    { k: "Pagamento", v: esc(shortPaymentLabel(terms)), n: terms ? "bonifico bancario" : "condizioni nel dettaglio", text: true },
  ].filter(Boolean) as { k: string; v: string; n: string; text?: boolean }[];

  const summary = `
    <section class="summary" style="grid-template-columns: repeat(${summaryCells.length}, 1fr)">
      ${summaryCells
        .map(
          (c) =>
            `<div class="cell"><div class="k">${c.k}</div><div class="v${c.text ? " v-text" : ""}">${c.v}</div><div class="n">${c.n}</div></div>`,
        )
        .join("")}
    </section>`;

  const investmentRows = [
    oneOffSub > 0 &&
      `<tr><td>Imponibile una tantum</td><td>${eur(oneOffSub)}</td></tr>
       <tr><td>IVA ${vatRate}%</td><td>${eur(vatOf(oneOffSub))}</td></tr>
       <tr class="strong"><td>Totale una tantum</td><td>${eur(oneOffTotal)}</td></tr>`,
    monthlySub > 0 &&
      `<tr class="${oneOffSub > 0 ? "gap" : ""}"><td>Canone mensile</td><td>${eur(monthlySub)} <small>+ IVA</small></td></tr>
       <tr class="muted"><td>IVA inclusa</td><td>${eur(monthlySub + vatOf(monthlySub))}/mese</td></tr>`,
    annualSub > 0 &&
      `<tr class="${oneOffSub > 0 || monthlySub > 0 ? "gap" : ""}"><td>Canone annuale</td><td>${eur(annualSub)} <small>+ IVA</small></td></tr>
       <tr class="muted"><td>IVA inclusa</td><td>${eur(annualSub + vatOf(annualSub))}/anno</td></tr>`,
  ]
    .filter(Boolean)
    .join("");

  const firstYearNote = hasRecurring
    ? `<p class="footnote">Spesa complessiva del primo anno, canoni compresi: <strong>${eur(firstYearTotal)}</strong> IVA inclusa. Dal secondo anno: ${eur(
        monthlySub * 12 + annualSub,
      )} + IVA all'anno.</p>`
    : "";

  const scheduleRows = schedule.length
    ? `<ol class="schedule">${schedule
        .map(
          (r, i) =>
            `<li><span class="dot">${i + 1}</span><span class="lbl">${esc(r.label)}</span><span class="amt">${eur(r.amount)}</span></li>`,
        )
        .join("")}</ol>
       <p class="footnote">Importi IVA inclusa, calcolati sulla parte una tantum${hasRecurring ? "; i canoni ricorrenti si pagano alla rispettiva scadenza" : ""}.</p>`
    : "";

  const bank = [
    company.iban ? `<div><span>IBAN</span>${esc(company.iban)}</div>` : "",
    company.bankHolder ? `<div><span>Intestatario</span>${esc(company.bankHolder)}</div>` : "",
  ].join("");

  const bankBox = `<div class="bank"><div><span>Metodo</span>Bonifico bancario</div>${bank}</div>`;
  const extraText =
    terms && terms.method !== "personalizzato" && terms.customText ? `<p>${esc(terms.customText)}</p>` : "";

  const sec = (title: string) => `<h2 class="sec">${title}</h2>`;

  const companyLine = [companyName, company.address, company.vatNumber ? `P.IVA ${company.vatNumber}` : ""]
    .filter(Boolean)
    .join(" · ");
  const cssString = (s: string) => s.replace(/\\/g, "").replace(/"/g, "'");
  const docTitle = `Proposta ${quote.number} - ${clientName}`;

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(docTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #0a0a0a; --ink-2: #3a3d44; --muted: #6b7280; --line: #e5e7eb; --soft: #f5f6f8;
    --accent: #0038ff; --accent-soft: #eef2ff;
    --serif: "Fraunces", "Times New Roman", serif; --sans: "Inter", "Helvetica Neue", Arial, sans-serif;
  }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; background: #e9ebef; color: var(--ink); font: 400 10pt/1.55 var(--sans); }
  .sheet { width: 210mm; min-height: 297mm; margin: 72px auto 48px; background: #fff; padding: 16mm 17mm 18mm; box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 12px 40px rgba(0,0,0,.08); }
  body.editing .sheet { outline: 2px dashed var(--accent); outline-offset: 6px; }

  /* Masthead */
  .top { display: flex; justify-content: space-between; align-items: center; padding-bottom: 7mm; border-bottom: 1px solid var(--ink); }
  .brand { display: flex; align-items: center; gap: 9px; font: 700 15pt/1 var(--sans); letter-spacing: -.02em; }
  .brand .mark { width: 26px; height: 26px; }
  .brand b { color: var(--accent); font-weight: 800; }
  .doc-id { text-align: right; font-size: 8pt; color: var(--muted); letter-spacing: .08em; text-transform: uppercase; line-height: 1.6; }
  .doc-id strong { color: var(--ink); letter-spacing: .04em; }

  /* Title */
  .hero { padding: 9mm 0 6mm; }
  .kicker { font: 600 8pt/1 var(--sans); letter-spacing: .14em; text-transform: uppercase; color: var(--accent); margin-bottom: 4mm; }
  h1 { font: 500 30pt/1.08 var(--serif); letter-spacing: -.01em; margin: 0 0 5mm; max-width: 150mm; text-wrap: balance; font-variation-settings: "opsz" 144; }
  .lede { font: 400 11pt/1.6 var(--serif); color: var(--ink-2); max-width: 140mm; margin: 0; }

  /* Parties */
  .parties { display: grid; grid-template-columns: 1.25fr 1.25fr 1fr; gap: 8mm; padding: 5mm 0 6mm; border-top: 1px solid var(--line); }
  .parties .lab, .summary .k { font: 600 7.5pt/1 var(--sans); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
  .parties .lab { margin-bottom: 2.5mm; }
  .parties p { margin: 0; font-size: 9pt; color: var(--ink-2); line-height: 1.55; }
  .parties p.name { font-weight: 600; color: var(--ink); font-size: 10pt; }

  /* Summary */
  .summary { display: grid; background: var(--soft); border-radius: 2px; margin-bottom: 8mm; break-inside: avoid; }
  .summary .cell { padding: 5mm 5mm 4.5mm; border-left: 1px solid #e3e6ea; }
  .summary .cell:first-child { border-left: 0; }
  .summary .v { font: 500 19pt/1.1 var(--serif); letter-spacing: -.01em; margin: 2.5mm 0 1.5mm; font-variant-numeric: tabular-nums; }
  .summary .v-text { font-size: 13pt; padding-top: 1.5mm; }
  .summary .n { font-size: 8pt; color: var(--muted); }

  /* Sections */
  .sec { font: 500 15pt/1.2 var(--serif); letter-spacing: -.005em; margin: 0 0 4mm; padding-top: 2mm; break-after: avoid; }
  section.block { margin-bottom: 7mm; }

  /* Items */
  .item { display: grid; grid-template-columns: 11mm 1fr 34mm; gap: 0 4mm; padding: 4mm 0; border-top: 1px solid var(--line); break-inside: avoid; }
  .item:last-child { border-bottom: 1px solid var(--line); }
  .item-n { font: 500 11pt/1.3 var(--serif); color: var(--accent); font-variant-numeric: tabular-nums; }
  .item h3 { margin: 0; font: 600 11pt/1.35 var(--sans); letter-spacing: -.005em; }
  .item-meta { font-size: 8pt; color: var(--muted); margin-top: 1mm; letter-spacing: .02em; }
  .details { margin-top: 2.5mm; color: var(--ink-2); font-size: 9pt; line-height: 1.55; }
  .details p { margin: 0 0 1.5mm; }
  .details ul { list-style: none; padding: 0; margin: 0; columns: 2; column-gap: 6mm; }
  .details li { position: relative; padding-left: 4mm; margin: 0 0 1.2mm; break-inside: avoid; }
  .details li::before { content: ""; position: absolute; left: 0; top: .72em; width: 2mm; height: 1.5px; background: var(--accent); }
  .item-price { text-align: right; }
  .item-price .now { font: 500 13pt/1.3 var(--serif); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .item-price small { font: 400 8pt var(--sans); color: var(--muted); margin-left: 1px; }
  .item-price .was { font-size: 8pt; color: var(--muted); white-space: nowrap; }
  .item-price .was span { color: var(--accent); font-weight: 600; }

  /* Investment */
  .inv { display: grid; grid-template-columns: 1fr 88mm; gap: 8mm; align-items: start; break-inside: avoid; }
  .inv-copy { font-size: 9pt; color: var(--ink-2); margin: 0; }
  table.money { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  table.money td { padding: 1.8mm 0; border-bottom: 1px solid var(--line); font-size: 9.5pt; }
  table.money td:last-child { text-align: right; white-space: nowrap; }
  table.money tr.strong td { font: 600 11pt var(--sans); border-bottom: 1.5px solid var(--ink); padding: 2.6mm 0; }
  table.money tr.gap td { padding-top: 5mm; }
  table.money tr.muted td { color: var(--muted); font-size: 8.5pt; }
  table.money small { color: var(--muted); }
  .footnote { font-size: 8pt; color: var(--muted); margin: 3mm 0 0; }

  /* Payment */
  .pay { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; break-inside: avoid; }
  .pay p { margin: 0 0 3mm; font-size: 9.5pt; color: var(--ink-2); }
  ol.schedule { list-style: none; margin: 0; padding: 0; }
  ol.schedule li { display: grid; grid-template-columns: 7mm 1fr auto; align-items: center; gap: 2mm; padding: 2mm 0; border-bottom: 1px solid var(--line); font-size: 9.5pt; }
  ol.schedule .dot { width: 5.5mm; height: 5.5mm; border-radius: 50%; background: var(--accent-soft); color: var(--accent); font: 600 7.5pt/5.5mm var(--sans); text-align: center; }
  ol.schedule .amt { font-weight: 600; font-variant-numeric: tabular-nums; }
  .bank { margin-top: 0; padding: 3.5mm 4mm; background: var(--soft); border-radius: 2px; font-size: 8.5pt; }
  .bank div { display: flex; gap: 3mm; padding: .6mm 0; }
  .bank span { width: 22mm; flex: none; color: var(--muted); font-size: 7.5pt; letter-spacing: .08em; text-transform: uppercase; padding-top: .3mm; }

  /* Notes & signature */
  .notes p { margin: 0 0 2mm; font-size: 9.5pt; color: var(--ink-2); white-space: pre-line; }
  .sign { break-inside: avoid; border-top: 1px solid var(--ink); padding-top: 5mm; margin-top: 2mm; }
  .sign > p { font-size: 9pt; color: var(--ink-2); margin: 0 0 4mm; max-width: 140mm; }
  .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14mm; }
  .sign-grid .who { font-size: 8pt; color: var(--muted); letter-spacing: .08em; text-transform: uppercase; }
  .sign-grid .line { border-bottom: 1px solid var(--ink); height: 12mm; }
  .sign-grid .cap { display: flex; justify-content: space-between; font-size: 8pt; color: var(--muted); margin-top: 1.5mm; }

  .colophon { margin-top: 10mm; font-size: 7.5pt; color: var(--muted); display: flex; justify-content: space-between; }

  /* Toolbar (screen only) */
  .toolbar { position: fixed; inset: 0 0 auto 0; height: 52px; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; background: rgba(10,10,10,.94); color: #fff; font: 500 13px/1 var(--sans); z-index: 10; }
  .toolbar .t { color: #c9ccd3; }
  .toolbar .t strong { color: #fff; font-weight: 600; }
  .toolbar .actions { display: flex; gap: 8px; }
  .toolbar button { font: 500 13px/1 var(--sans); color: #fff; background: transparent; border: 1px solid #3a3d44; border-radius: 6px; padding: 9px 14px; cursor: pointer; }
  .toolbar button:hover { border-color: #6b7280; }
  .toolbar button.primary { background: var(--accent); border-color: var(--accent); }
  .toolbar button.primary:hover { background: #0029cc; }
  .hint { position: fixed; top: 60px; left: 50%; transform: translateX(-50%); background: var(--accent); color: #fff; font: 500 12px var(--sans); padding: 7px 12px; border-radius: 6px; display: none; z-index: 10; }
  body.editing .hint { display: block; }

  @page {
    size: A4;
    margin: 15mm 17mm 16mm;
    @bottom-left { content: "${cssString(companyLine)}"; font: 7pt Inter, Arial, sans-serif; color: #6b7280; }
    @bottom-right { content: "${cssString(quote.number)} · pag. " counter(page) " di " counter(pages); font: 7pt Inter, Arial, sans-serif; color: #6b7280; }
  }
  @media print {
    body { background: #fff; }
    .toolbar, .hint { display: none !important; }
    .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; outline: none !important; }
    .colophon { display: none; }
  }
</style>
</head>
<body>
<div class="toolbar">
  <div class="t"><strong>${esc(quote.number)}</strong> &nbsp;·&nbsp; ${esc(clientName)}</div>
  <div class="actions">
    <button type="button" id="edit-btn" onclick="toggleEdit()">Modifica testo</button>
    <button type="button" class="primary" onclick="window.print()">Scarica PDF</button>
  </div>
</div>
<div class="hint">Modalità modifica: clicca su qualsiasi testo per correggerlo, poi «Scarica PDF». Le modifiche non vengono salvate nel CRM.</div>

<main class="sheet">
  <header class="top">
    <div class="brand">${MARK_SVG}<span>Sarcon<b>X</b></span></div>
    <div class="doc-id">Proposta commerciale<br><strong>${esc(quote.number)}</strong>${issued ? ` · ${esc(issued)}` : ""}</div>
  </header>

  <section class="hero">
    <div class="kicker">Proposta per ${esc(clientName)}</div>
    <h1>${esc(quote.title)}</h1>
    <p class="lede">${firstName ? `Gentile ${esc(firstName)}, d` : "D"}i seguito trova la nostra proposta: cosa realizziamo, cosa comprende ogni voce e come si articolano investimento e pagamenti.</p>
  </section>

  <section class="parties">
    <div>
      <div class="lab">Destinatario</div>
      <p class="name">${esc(clientName)}</p>
      ${attention ? `<p>Alla c.a. di ${esc(attention)}</p>` : ""}
      ${contact?.address ? `<p>${esc(contact.address)}</p>` : ""}
      ${contact?.vatNumber ? `<p>P.IVA ${esc(contact.vatNumber)}</p>` : ""}
      ${contact?.email ? `<p>${esc(contact.email)}</p>` : ""}
      ${contact?.phone ? `<p>${esc(contact.phone)}</p>` : ""}
    </div>
    <div>
      <div class="lab">Proposta di</div>
      <p class="name">${esc(companyName)}</p>
      ${company.address ? `<p>${esc(company.address)}</p>` : ""}
      ${company.vatNumber ? `<p>P.IVA ${esc(company.vatNumber)}</p>` : ""}
      ${company.email ? `<p>${esc(company.email)}</p>` : ""}
      ${company.phone ? `<p>${esc(company.phone)}</p>` : ""}
    </div>
    <div>
      <div class="lab">Validità</div>
      ${issued ? `<p>Emessa il ${esc(issued)}</p>` : ""}
      <p>${validUntil ? `Valida fino al <strong>${esc(validUntil)}</strong>` : "Valida 30 giorni dall'emissione"}</p>
    </div>
  </section>

  ${ordered.length ? summary : ""}

  <section class="block">
    ${sec("Cosa comprende la proposta")}
    ${itemRows || `<p class="footnote">Nessuna voce inserita.</p>`}
  </section>

  <section class="block">
    ${sec("Investimento")}
    <div class="inv">
      <p class="inv-copy">Prezzi in euro, IVA ${vatRate}% esclusa salvo dove indicato.${hasRecurring ? " Le voci una tantum si pagano secondo le modalità indicate sotto; i canoni ricorrenti si fatturano alla loro scadenza." : ""}</p>
      <div>
        <table class="money">${investmentRows || `<tr><td>Totale</td><td>${eur(0)}</td></tr>`}</table>
        ${firstYearNote}
      </div>
    </div>
  </section>

  <section class="block">
    ${sec("Modalità di pagamento")}
    <div class="pay">
      <div>
        <p>${esc(paymentText)}</p>
        ${extraText}
        ${scheduleRows ? bankBox : ""}
      </div>
      <div>${scheduleRows || bankBox}</div>
    </div>
  </section>

  ${quote.notes ? `<section class="block notes">${sec("Note")}<p>${esc(quote.notes)}</p></section>` : ""}

  <section class="sign">
    <p>Per accettare la proposta è sufficiente restituire questo documento firmato, anche via email.</p>
    <div class="sign-grid">
      <div><div class="who">Per ${esc(companyName)}</div><div class="line"></div><div class="cap"><span>Firma</span><span>Data</span></div></div>
      <div><div class="who">Per accettazione · ${esc(clientName)}</div><div class="line"></div><div class="cap"><span>Timbro e firma</span><span>Data</span></div></div>
    </div>
  </section>

  <footer class="colophon"><span>${esc(companyLine)}</span><span>${esc(quote.number)}</span></footer>
</main>

<script>
  function toggleEdit() {
    var on = document.body.classList.toggle('editing');
    document.querySelector('.sheet').contentEditable = on ? 'true' : 'false';
    document.getElementById('edit-btn').textContent = on ? 'Fine modifica' : 'Modifica testo';
  }
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
