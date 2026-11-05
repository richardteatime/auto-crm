import { NextRequest } from "next/server";
import { getQuote } from "@/lib/db/quotes";
import { requireAuth } from "@/lib/auth";
import { getDeal } from "@/lib/db/deals";
import { getContact } from "@/lib/db/contacts";
import { buildPaymentSchedule, describePaymentTerms, parsePaymentTerms } from "@/lib/quote-payment";
import { parseDbItems, type DbQuoteItem } from "@/lib/quote-items";
import { buildClauseSections, parseQuoteClauses } from "@/lib/quote-clauses";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Quote document: classic A4 business layout, print-ready HTML
// ("Scarica PDF" prints it). Amounts are stored in cents.
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

const eurFmt = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  useGrouping: "always",
});

function eur(cents: number): string {
  return eurFmt.format(cents / 100);
}

function toDate(d: Date | number | string | null | undefined): Date | null {
  if (!d) return null;
  if (d instanceof Date) return d;
  return new Date(typeof d === "number" ? (d < 1e12 ? d * 1000 : d) : d);
}

function dateIt(d: Date | number | string | null | undefined): string {
  const date = toDate(d);
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function num(v: unknown): number {
  return typeof v === "number" ? v : parseFloat(String(v ?? "")) || 0;
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

const BILLING_LABEL: Record<string, string> = {
  una_tantum: "",
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
  const anyDiscount = ordered.some((i) => num(i.discount) > 0);

  const oneOffSub = ordered.filter((i) => billingOf(i) === "una_tantum").reduce((s, i) => s + lineTotal(i), 0);
  const monthlySub = ordered.filter((i) => billingOf(i) === "mensile").reduce((s, i) => s + lineTotal(i), 0);
  const annualSub = ordered.filter((i) => billingOf(i) === "annuale").reduce((s, i) => s + lineTotal(i), 0);
  const vatRate = num(quote.vatRate);
  const vatOf = (c: number) => Math.round((c * vatRate) / 100);
  const oneOffTotal = oneOffSub + vatOf(oneOffSub);

  // --- Payment --------------------------------------------------------------
  const terms = parsePaymentTerms(quote.paymentTerms);
  const schedule = terms ? buildPaymentSchedule(terms, oneOffTotal) : [];
  const paymentText = terms
    ? describePaymentTerms(terms)
    : company.paymentTerms || "Bonifico bancario a 30 giorni data fattura.";
  const extraPaymentText =
    terms && terms.method !== "personalizzato" && terms.customText ? terms.customText : "";

  // --- People ---------------------------------------------------------------
  const clientName = contact?.company || contact?.name || "Cliente";
  const attention = contact?.company && contact?.name ? contact.name : "";
  const issued = dateIt(quote.createdAt);
  const validUntil = dateIt(quote.validUntil);

  // --- Items table ----------------------------------------------------------
  const rows = ordered
    .map((item, idx) => {
      const billing = billingOf(item);
      // Periodicity on its own small line, so amounts stay aligned on the right.
      const suffix = BILLING_SUFFIX[billing] ?? "";
      const per = suffix ? `<span class="per">${suffix === "/mese" ? "al mese" : "all'anno"}</span>` : "";
      const qty = num(item.quantity);
      const discount = num(item.discount);
      const tag = BILLING_LABEL[billing];
      return `
      <tr class="item">
        <td class="c-n">${idx + 1}</td>
        <td class="c-desc">
          <div class="name">${esc(item.description) || "Voce"}${tag ? ` <span class="tag">${tag}</span>` : ""}</div>
          ${renderDetails(item.details)}
        </td>
        <td class="c-num c-qty">${qty}</td>
        <td class="c-num">${eur(num(item.unitPrice))}${per}</td>
        ${anyDiscount ? `<td class="c-num">${discount > 0 ? `${discount}%` : "—"}</td>` : ""}
        <td class="c-num c-tot">${eur(lineTotal(item))}${per}</td>
      </tr>`;
    })
    .join("");

  // --- Totals ---------------------------------------------------------------
  // One table, one row per billing type, same columns: the one-off total and
  // the recurring fees line up and are never summed together.
  const totalRows = [
    oneOffSub > 0 && { label: "Una tantum", net: oneOffSub },
    monthlySub > 0 && { label: "Canone mensile", net: monthlySub },
    annualSub > 0 && { label: "Canone annuale", net: annualSub },
  ].filter(Boolean) as { label: string; net: number }[];
  const totalsTable = totalRows.length
    ? `<table class="totals">
        <thead><tr><th></th><th>Imponibile</th><th>IVA ${vatRate}%</th><th>Totale</th></tr></thead>
        <tbody>${totalRows
          .map(
            (r) =>
              `<tr><td class="t-lab">${r.label}</td><td>${eur(r.net)}</td><td>${eur(vatOf(r.net))}</td><td class="t-tot">${eur(r.net + vatOf(r.net))}</td></tr>`,
          )
          .join("")}</tbody>
      </table>`
    : "";

  // --- Conditions -----------------------------------------------------------
  const conditionRows = [
    `<tr><th>Pagamento</th><td>${esc(paymentText)}${extraPaymentText ? `<br>${esc(extraPaymentText)}` : ""}</td></tr>`,
    schedule.length > 1 || (schedule.length === 1 && terms?.method !== "consegna")
      ? `<tr><th>Scadenze</th><td><table class="sched">${schedule
          .map((r) => `<tr><td>${esc(r.label)}</td><td>${eur(r.amount)}</td></tr>`)
          .join("")}</table><span class="note">Importi IVA inclusa${monthlySub > 0 || annualSub > 0 ? "; i canoni sono fatturati alla rispettiva scadenza" : ""}.</span></td></tr>`
      : "",
    `<tr><th>Modalità</th><td>Bonifico bancario${company.iban ? `<br>IBAN <strong>${esc(company.iban)}</strong>` : ""}${
      company.bankHolder ? `<br>Intestato a ${esc(company.bankHolder)}` : ""
    }</td></tr>`,
    `<tr><th>Validità offerta</th><td>${validUntil ? `Fino al ${esc(validUntil)}` : "30 giorni dalla data del preventivo"}</td></tr>`,
    `<tr><th>Prezzi</th><td>Importi in euro, IVA esclusa salvo dove indicato.</td></tr>`,
    quote.notes ? `<tr><th>Note</th><td class="pre">${esc(quote.notes)}</td></tr>` : "",
  ]
    .filter(Boolean)
    .join("");

  // --- Specific + general clauses -------------------------------------------
  const selection = parseQuoteClauses(quote.clauses);
  const sections = buildClauseSections(ordered, quote.title, selection);
  const extraLines = selection.extra
    .split("\n")
    .map((l) => l.trim().replace(/^[-*•·]\s+/, ""))
    .filter(Boolean);
  let clauseNo = 0;
  const clauseHtml = [
    ...sections.map(
      (sct) => `
      <div class="cl-group">
        <h3>${esc(sct.title)}</h3>
        ${sct.clauses
          .map(
            (c) =>
              `<p class="cl"><span class="cl-n">${++clauseNo}.</span><span><strong>${esc(c.title)}.</strong> ${esc(
                c.parts.map((pt) => pt.text).join(""),
              )}</span></p>`,
          )
          .join("")}
      </div>`,
    ),
    extraLines.length
      ? `<div class="cl-group"><h3>Condizioni particolari</h3>${extraLines
          .map((l) => `<p class="cl"><span class="cl-n">${++clauseNo}.</span><span>${esc(l)}</span></p>`)
          .join("")}</div>`
      : "",
  ].join("");

  const companyLine = [companyName, company.address, company.vatNumber ? `P.IVA ${company.vatNumber}` : ""]
    .filter(Boolean)
    .join(" – ");
  const cssString = (s: string) => s.replace(/\\/g, "").replace(/"/g, "'");
  const docTitle = `Preventivo ${quote.number} - ${clientName}`;

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(docTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #111827; --ink-2: #374151; --muted: #6b7280; --line: #d1d5db; --line-soft: #e5e7eb; --head: #f3f4f6;
    --accent: #0038ff;
    --font: "Source Sans 3", "Helvetica Neue", Helvetica, Arial, sans-serif;
  }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; background: #e5e7eb; color: var(--ink); font: 400 10pt/1.45 var(--font); }
  .sheet { width: 210mm; min-height: 297mm; margin: 72px auto 48px; background: #fff; padding: 14mm 15mm 16mm; box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 10px 30px rgba(0,0,0,.08); }
  body.editing .sheet { outline: 2px dashed var(--accent); outline-offset: 6px; }
  table { border-collapse: collapse; width: 100%; }

  /* Header */
  .head { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 5mm; border-bottom: 2px solid var(--ink); }
  .brand { display: flex; align-items: center; gap: 8px; font: 700 17pt/1 var(--font); letter-spacing: -.01em; }
  .brand .mark { width: 30px; height: 30px; }
  .brand b { color: var(--accent); }
  .issuer { text-align: right; font-size: 8.5pt; color: var(--ink-2); line-height: 1.5; }
  .issuer strong { color: var(--ink); font-size: 9.5pt; }

  /* Title + parties */
  .title-row { margin: 7mm 0 5mm; }
  .doc-title { font: 700 20pt/1 var(--font); letter-spacing: .02em; text-transform: uppercase; }
  .doc-no { font-size: 10pt; color: var(--ink-2); }
  .parties { display: grid; grid-template-columns: 1fr 72mm; gap: 6mm; margin-bottom: 6mm; }
  .box { border: 1px solid var(--line); padding: 3.5mm 4mm; }
  .box .lab { font: 600 7.5pt/1 var(--font); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 2mm; }
  .box p { margin: 0; font-size: 9.5pt; line-height: 1.5; }
  .box p.name { font-weight: 700; font-size: 10.5pt; }
  table.meta td { font-size: 9.5pt; padding: .8mm 0; vertical-align: top; }
  table.meta td:first-child { color: var(--muted); width: 26mm; }
  table.meta td:last-child { font-weight: 600; }

  .subject { margin: 0 0 2mm; font-size: 10.5pt; }
  .subject strong { font-weight: 700; }
  .intro { margin: 0 0 5mm; font-size: 9.5pt; color: var(--ink-2); }

  /* Items */
  table.items thead th { background: var(--head); border-top: 1px solid var(--ink); border-bottom: 1px solid var(--ink); font: 700 8pt/1.2 var(--font); letter-spacing: .05em; text-transform: uppercase; text-align: left; padding: 2.2mm 2mm; }
  table.items thead th.c-num { text-align: right; }
  table.items td { padding: 3mm 2mm; border-bottom: 1px solid var(--line-soft); vertical-align: top; font-size: 9.5pt; }
  table.items tr.item { break-inside: avoid; }
  .c-n { width: 7mm; color: var(--muted); }
  .c-num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; width: 24mm; }
  .c-tot { font-weight: 600; width: 27mm; }
  .c-qty { width: 11mm; }
  .name { font-weight: 700; font-size: 10pt; }
  .tag { display: inline-block; margin-left: 4px; padding: 0 5px; border: 1px solid var(--line); border-radius: 3px; font: 600 7pt/14px var(--font); letter-spacing: .04em; text-transform: uppercase; color: var(--muted); vertical-align: 1px; }
  .details { margin-top: 1.5mm; color: var(--ink-2); font-size: 9pt; line-height: 1.45; }
  .details p { margin: 0 0 1mm; }
  .details ul { margin: 0; padding-left: 4.5mm; }
  .details li { margin: 0 0 .5mm; }

  /* Totals */
  .totals-wrap { display: flex; justify-content: flex-end; margin: 5mm 0 7mm; break-inside: avoid; }
  table.totals { width: 128mm; font-variant-numeric: tabular-nums; }
  table.totals th { font: 700 8pt/1.2 var(--font); letter-spacing: .05em; text-transform: uppercase; color: var(--ink-2); text-align: right; padding: 0 2mm 2mm; border-bottom: 1px solid var(--ink); }
  table.totals td { padding: 2.2mm 2mm; font-size: 9.5pt; text-align: right; white-space: nowrap; border-bottom: 1px solid var(--line-soft); }
  table.totals td.t-lab { text-align: left; font-weight: 600; color: var(--ink); }
  table.totals th:first-child { width: 32mm; }
  table.totals th:not(:first-child), table.totals td:not(.t-lab) { width: 32mm; }
  table.totals td.t-tot { font-weight: 700; color: var(--ink); background: var(--head); }
  td .per { display: block; font-size: 7.5pt; font-weight: 400; color: var(--muted); }

  /* Conditions */
  h2 { font: 700 9pt/1 var(--font); letter-spacing: .06em; text-transform: uppercase; margin: 0 0 2.5mm; padding-bottom: 1.5mm; border-bottom: 1px solid var(--ink); break-after: avoid; }
  table.cond { margin-bottom: 7mm; }
  table.cond tr { break-inside: avoid; }
  table.cond th { width: 34mm; text-align: left; vertical-align: top; font-weight: 600; color: var(--ink-2); padding: 2mm 2mm 2mm 0; font-size: 9pt; border-bottom: 1px solid var(--line-soft); }
  table.cond td { padding: 2mm 0; font-size: 9.5pt; border-bottom: 1px solid var(--line-soft); vertical-align: top; }
  table.cond td.pre { white-space: pre-line; }
  table.sched { width: auto; min-width: 95mm; margin: .5mm 0 1mm; }
  table.sched td { border: 0; padding: .6mm 8mm .6mm 0; font-size: 9.5pt; }
  table.sched td:last-child { text-align: right; padding-right: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
  .note { font-size: 8pt; color: var(--muted); }

  /* Clauses */
  .clauses { margin-bottom: 7mm; }
  .cl-group { margin-bottom: 3.5mm; }
  .cl-group h3 { font: 700 9pt/1.3 var(--font); margin: 0 0 1.5mm; color: var(--ink); break-after: avoid; }
  p.cl { display: grid; grid-template-columns: 6mm 1fr; margin: 0 0 1.4mm; font-size: 8.8pt; line-height: 1.45; color: var(--ink-2); break-inside: avoid; }
  p.cl strong { color: var(--ink); font-weight: 600; }
  .cl-n { color: var(--muted); font-variant-numeric: tabular-nums; }

  /* Acceptance */
  .accept { break-inside: avoid; }
  .accept p { font-size: 9pt; color: var(--ink-2); margin: 0 0 8mm; }
  .signs { display: grid; grid-template-columns: 1fr 1fr; gap: 16mm; }
  .signs .who { font-size: 8.5pt; color: var(--muted); }
  .signs .line { border-bottom: 1px solid var(--ink); height: 13mm; }
  .signs .cap { font-size: 8pt; color: var(--muted); margin-top: 1.2mm; }

  .colophon { margin-top: 10mm; padding-top: 2mm; border-top: 1px solid var(--line-soft); font-size: 7.5pt; color: var(--muted); display: flex; justify-content: space-between; }

  /* Toolbar (screen only) */
  .toolbar { position: fixed; inset: 0 0 auto 0; height: 52px; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; background: #111827; color: #fff; font: 600 13px/1 var(--font); z-index: 10; }
  .toolbar .t { color: #d1d5db; font-weight: 400; }
  .toolbar .t strong { color: #fff; font-weight: 600; }
  .toolbar .actions { display: flex; gap: 8px; }
  .toolbar button { font: 600 13px/1 var(--font); color: #fff; background: transparent; border: 1px solid #4b5563; border-radius: 6px; padding: 9px 14px; cursor: pointer; }
  .toolbar button:hover { border-color: #9ca3af; }
  .toolbar button.primary { background: var(--accent); border-color: var(--accent); }
  .hint { position: fixed; top: 60px; left: 50%; transform: translateX(-50%); background: var(--accent); color: #fff; font: 600 12px var(--font); padding: 7px 12px; border-radius: 6px; display: none; z-index: 10; }
  body.editing .hint { display: block; }

  @page {
    size: A4;
    margin: 13mm 15mm 15mm;
    @bottom-left { content: "${cssString(companyLine)}"; font: 7pt Arial, sans-serif; color: #6b7280; }
    @bottom-right { content: "Preventivo ${cssString(quote.number)} – pag. " counter(page) " di " counter(pages); font: 7pt Arial, sans-serif; color: #6b7280; }
  }
  @media print {
    body { background: #fff; }
    .toolbar, .hint { display: none !important; }
    .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; outline: none !important; }
    .colophon { display: none; }
    table.items thead { display: table-header-group; }
  }
</style>
</head>
<body>
<div class="toolbar">
  <div class="t"><strong>Preventivo ${esc(quote.number)}</strong> &nbsp;·&nbsp; ${esc(clientName)}</div>
  <div class="actions">
    <button type="button" id="edit-btn" onclick="toggleEdit()">Modifica testo</button>
    <button type="button" class="primary" onclick="window.print()">Scarica PDF</button>
  </div>
</div>
<div class="hint">Modalità modifica: clicca su qualsiasi testo per correggerlo, poi «Scarica PDF». Le modifiche non vengono salvate nel CRM.</div>

<main class="sheet">
  <header class="head">
    <div class="brand">${MARK_SVG}<span>Sarcon<b>X</b></span></div>
    <div class="issuer">
      <strong>${esc(companyName)}</strong><br>
      ${company.address ? `${esc(company.address)}<br>` : ""}
      ${company.vatNumber ? `P.IVA ${esc(company.vatNumber)}<br>` : ""}
      ${[company.phone, company.email].filter(Boolean).map((v) => esc(v)).join(" · ")}
    </div>
  </header>

  <div class="title-row">
    <div class="doc-title">Preventivo</div>
  </div>

  <section class="parties">
    <div class="box">
      <div class="lab">Spett.le</div>
      <p class="name">${esc(clientName)}</p>
      ${attention ? `<p>Alla c.a. di ${esc(attention)}</p>` : ""}
      ${contact?.address ? `<p>${esc(contact.address)}</p>` : ""}
      ${contact?.vatNumber ? `<p>P.IVA ${esc(contact.vatNumber)}</p>` : ""}
      ${[contact?.email, contact?.phone].filter(Boolean).map((v) => `<p>${esc(v)}</p>`).join("")}
    </div>
    <div class="box">
      <div class="lab">Dati documento</div>
      <table class="meta">
        <tr><td>Numero</td><td>${esc(quote.number)}</td></tr>
        ${issued ? `<tr><td>Data</td><td>${esc(issued)}</td></tr>` : ""}
        <tr><td>Valido fino al</td><td>${validUntil ? esc(validUntil) : "30 gg dalla data"}</td></tr>
      </table>
    </div>
  </section>

  <p class="subject">Oggetto: <strong>${esc(quote.title)}</strong></p>
  <p class="intro">Con la presente sottoponiamo alla Vostra attenzione la nostra offerta per quanto in oggetto, alle condizioni di seguito riportate.</p>

  <table class="items">
    <thead><tr>
      <th class="c-n">#</th><th>Descrizione</th><th class="c-num c-qty">Q.tà</th><th class="c-num">Prezzo unit.</th>${anyDiscount ? `<th class="c-num">Sconto</th>` : ""}<th class="c-num">Importo</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="6" class="note">Nessuna voce inserita.</td></tr>`}</tbody>
  </table>

  <div class="totals-wrap">
    ${totalsTable}
  </div>

  <h2>Condizioni economiche</h2>
  <table class="cond">${conditionRows}</table>

  ${clauseHtml ? `<section class="clauses"><h2>Condizioni di fornitura</h2>${clauseHtml}</section>` : ""}

  <section class="accept">
    <h2>Accettazione</h2>
    <p>Per accettazione della presente offerta e delle condizioni sopra riportate, restituire copia firmata anche via email.</p>
    <div class="signs">
      <div><div class="who">${esc(companyName)}</div><div class="line"></div><div class="cap">Firma</div></div>
      <div><div class="who">Il Cliente – ${esc(clientName)}</div><div class="line"></div><div class="cap">Timbro, firma e data</div></div>
    </div>
  </section>

  <footer class="colophon"><span>${esc(companyLine)}</span><span>Preventivo ${esc(quote.number)}</span></footer>
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
