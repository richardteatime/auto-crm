import { NextRequest } from "next/server";
import { getQuote } from "@/lib/db/quotes";
import { getDeal } from "@/lib/db/deals";
import { getContact } from "@/lib/db/contacts";

export const dynamic = "force-dynamic";

interface DbQuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number; // cents
  billingType?: "one_time" | "recurring";
}

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
    cents / 100
  );
}

function formatDateIt(date: Date | number | string | null | undefined): string {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(typeof date === "number" ? (date < 1e12 ? date * 1000 : date) : date);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

const STATUS_LABELS: Record<string, string> = {
  bozza: "Bozza",
  inviato: "Inviato",
  accettato: "Accettato",
  rifiutato: "Rifiutato",
};

const STATUS_STYLES: Record<string, string> = {
  bozza: "background:#f1f5f9;color:#64748b",
  inviato: "background:#dbeafe;color:#2563eb",
  accettato: "background:#dcfce7;color:#16a34a",
  rifiutato: "background:#fee2e2;color:#dc2626",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const quote = await getQuote(id);
  if (!quote) {
    return new Response("Preventivo non trovato", { status: 404 });
  }

  const deal = quote.dealId ? await getDeal(quote.dealId) : null;
  const contact = deal?.contactId ? await getContact(deal.contactId) : null;

  let items: DbQuoteItem[] = [];
  try {
    items = JSON.parse(quote.items) as DbQuoteItem[];
  } catch {
    items = [];
  }

  const oneTimeSub = items.filter((i) => i.billingType !== "recurring").reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const recurringSub = items.filter((i) => i.billingType === "recurring").reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const subtotal = oneTimeSub + recurringSub;
  const vatAmount = Math.round((subtotal * quote.vatRate) / 100);
  const total = subtotal + vatAmount;
  const hasRecurring = recurringSub > 0;
  const hasOneTime = oneTimeSub > 0;

  const statusStyle = STATUS_STYLES[quote.status] ?? STATUS_STYLES.bozza;
  const statusLabel = STATUS_LABELS[quote.status] ?? quote.status;

  const itemRows = items
    .map(
      (item, idx) => {
        const isRecurring = item.billingType === "recurring";
        const typeBadge = isRecurring
          ? `<span style="display:inline-block;padding:2px 7px;border-radius:12px;font-size:10px;font-weight:700;background:#dbeafe;color:#2563eb">↻ /mese</span>`
          : `<span style="display:inline-block;padding:2px 7px;border-radius:12px;font-size:10px;font-weight:600;background:#f1f5f9;color:#64748b">Una tantum</span>`;
        return `
    <tr>
      <td style="width:28px;color:#94a3b8;font-size:11px;padding:10px 8px;">${idx + 1}</td>
      <td style="padding:10px 12px;">${esc(item.description) || "—"}</td>
      <td style="padding:10px 12px;width:100px;">${typeBadge}</td>
      <td style="text-align:right;padding:10px 12px;width:56px;">${item.quantity}</td>
      <td style="text-align:right;padding:10px 12px;width:110px;">${formatEur(item.unitPrice)}${isRecurring ? "<span style='font-size:10px;color:#2563eb'>/mese</span>" : ""}</td>
      <td style="text-align:right;padding:10px 12px;width:110px;font-weight:600;">${formatEur(item.quantity * item.unitPrice)}${isRecurring ? "<span style='font-size:10px;color:#2563eb'>/mese</span>" : ""}</td>
    </tr>`;
      }
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Preventivo ${esc(quote.number)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;font-size:13px;line-height:1.6;background:#f1f5f9}
  .page{background:#fff;max-width:800px;margin:24px auto;padding:52px 60px;border-radius:4px;box-shadow:0 2px 20px rgba(0,0,0,.08)}
  @page{margin:12mm 16mm;size:A4}
  @media print{
    body{background:#fff}
    .page{margin:0;padding:0;box-shadow:none;border-radius:0}
    .no-print{display:none!important}
    *{print-color-adjust:exact;-webkit-print-color-adjust:exact}
  }
  .no-print{position:fixed;top:16px;right:16px;z-index:999;display:flex;gap:8px}
  .btn{border:none;padding:9px 18px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600}
  .btn-dark{background:#0f172a;color:#fff}
  .btn-dark:hover{background:#1e293b}
  .btn-ghost{background:#e2e8f0;color:#334155}
  .btn-ghost:hover{background:#cbd5e1}

  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:3px solid #0f172a}
  .brand-name{font-size:30px;font-weight:900;color:#0f172a;letter-spacing:-1px}
  .brand-sub{font-size:10px;color:#94a3b8;margin-top:3px;letter-spacing:1.5px;text-transform:uppercase}
  .doc-label{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:600;text-align:right}
  .doc-number{font-size:20px;font-weight:800;color:#0f172a;margin-top:4px;text-align:right}
  .doc-date{font-size:12px;color:#64748b;margin-top:3px;text-align:right}

  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px}
  .info-label{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:600;margin-bottom:8px}
  .info-name{font-size:15px;font-weight:700;color:#0f172a}
  .info-detail{font-size:12px;color:#64748b;margin-top:2px}
  .status-pill{display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:8px}

  .quote-title{font-size:18px;font-weight:700;color:#0f172a;margin-bottom:20px}

  table{width:100%;border-collapse:collapse;margin-bottom:4px}
  thead tr{background:#0f172a}
  thead th{color:#fff;padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
  thead th:nth-child(4),thead th:nth-child(5),thead th:nth-child(6){text-align:right}
  tbody tr:nth-child(even){background:#f8fafc}
  tbody td{border-bottom:1px solid #e2e8f0;font-size:13px;vertical-align:middle}

  .totals{display:flex;justify-content:flex-end;margin:12px 0 28px}
  .totals-box{width:260px}
  .t-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;border-top:1px solid #f1f5f9}
  .t-label{color:#64748b}
  .t-val{font-weight:600}
  .t-total{background:#0f172a;color:#fff;border-radius:8px;padding:11px 14px;margin-top:10px;display:flex;justify-content:space-between;font-weight:800;font-size:15px}

  .notes-box{background:#f8fafc;border-left:4px solid #0f172a;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:28px}
  .notes-label{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:600;margin-bottom:6px}
  .notes-text{font-size:13px;color:#1a1a1a;white-space:pre-line}

  .footer{padding-top:18px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}
  .footer-brand{font-weight:800;font-size:13px;color:#0f172a}
  .footer-info{font-size:11px;color:#94a3b8}
</style>
</head>
<body>
<div class="no-print">
  <button class="btn btn-ghost" onclick="window.close()">✕ Chiudi</button>
  <button class="btn btn-dark" onclick="window.print()">⬇ Scarica / Stampa PDF</button>
</div>

<div class="page">
  <div class="header">
    <div>
      <div class="brand-name">SarconX</div>
      <div class="brand-sub" style="font-size:11px;color:#64748b;margin-top:4px;line-height:1.6">
        Via Vigentina 15, 27100 Pavia<br>
        P.IVA: 02838240188<br>
        Tel: +39 334 134 0272
      </div>
    </div>
    <div>
      <div class="doc-label">Preventivo</div>
      <div class="doc-number">${esc(quote.number)}</div>
      <div class="doc-date">Data: ${formatDateIt(quote.createdAt)}</div>
      <div class="doc-date">Valido fino al: ${formatDateIt(quote.validUntil)}</div>
      <div style="margin-top:6px"><span class="status-pill" style="${statusStyle}">${statusLabel}</span></div>
    </div>
  </div>

  <div class="grid2">
    <div>
      <div class="info-label">Destinatario</div>
      <div class="info-name">${esc(contact?.company || contact?.name)}</div>
      ${contact?.company && contact.company !== contact?.name ? `<div class="info-detail">${esc(contact.name)}</div>` : ""}
      ${(contact as (typeof contact & { address?: string | null }))?.address ? `<div class="info-detail">${esc((contact as (typeof contact & { address?: string | null }))!.address)}</div>` : ""}
      ${(contact as (typeof contact & { vatNumber?: string | null }))?.vatNumber ? `<div class="info-detail"><strong>P.IVA:</strong> ${esc((contact as (typeof contact & { vatNumber?: string | null }))!.vatNumber)}</div>` : ""}
      ${contact?.phone ? `<div class="info-detail">Tel: ${esc(contact.phone)}</div>` : ""}
      ${contact?.email ? `<div class="info-detail">${esc(contact.email)}</div>` : ""}
    </div>
    <div>
      <div class="info-label">Dettagli documento</div>
      ${deal ? `<div class="info-detail"><strong>Oggetto:</strong> ${esc(deal.title)}</div>` : ""}
    </div>
  </div>

  <div class="quote-title">${esc(quote.title)}</div>

  <table>
    <thead>
      <tr>
        <th style="width:28px">#</th>
        <th>Descrizione</th>
        <th style="width:100px">Tipo</th>
        <th style="text-align:right;width:56px">Qtà</th>
        <th style="text-align:right;width:110px">Prezzo unit.</th>
        <th style="text-align:right;width:110px">Totale</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px">Nessuna voce inserita</td></tr>`}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      ${hasOneTime ? `<div class="t-row"><span class="t-label">Una tantum</span><span class="t-val">${formatEur(oneTimeSub)}</span></div>` : ""}
      ${hasRecurring ? `<div class="t-row"><span class="t-label" style="color:#2563eb">↻ Ricorrente/mese</span><span class="t-val" style="color:#2563eb">${formatEur(recurringSub)}/mese</span></div>` : ""}
      ${hasOneTime && hasRecurring ? `<div class="t-row"><span class="t-label">Subtotale</span><span class="t-val">${formatEur(subtotal)}</span></div>` : ""}
      ${!hasOneTime && !hasRecurring ? `<div class="t-row"><span class="t-label">Subtotale</span><span class="t-val">${formatEur(subtotal)}</span></div>` : ""}
      <div class="t-row"><span class="t-label">IVA ${quote.vatRate}%</span><span class="t-val">${formatEur(vatAmount)}</span></div>
      <div class="t-total"><span>Totale</span><span>${formatEur(total)}</span></div>
    </div>
  </div>

  ${
    quote.notes
      ? `<div class="notes-box">
    <div class="notes-label">Note</div>
    <div class="notes-text">${esc(quote.notes)}</div>
  </div>`
      : ""
  }

  <div style="margin-bottom:28px;font-size:13px">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:600;margin-bottom:8px">Modalità di Pagamento</div>
    <div style="color:#1a1a1a">Bonifico Bancario</div>
    <div style="color:#64748b;margin-top:3px">Intestatario C/C: Ricardo Consuegra &amp; Leonardo Sartori</div>
    <div style="color:#64748b">IBAN: LT783250090360011881</div>
    <div style="color:#64748b">Scadenza: 30 giorni data fattura (o come da accordi commerciali)</div>
  </div>

  <div style="margin-bottom:28px;display:flex;justify-content:flex-end">
    <div style="font-size:12px;color:#64748b;text-align:right">
      Per accettazione: Firma ________________________ &nbsp;&nbsp; Data _______________
    </div>
  </div>

  <div class="footer">
    <div class="footer-brand">SarconX</div>
    <div class="footer-info">Documento generato il ${formatDateIt(new Date())} · ${esc(quote.number)}</div>
  </div>
</div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
