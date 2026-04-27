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
  const d =
    date instanceof Date
      ? date
      : new Date(typeof date === "number" ? (date < 1e12 ? date * 1000 : date) : date);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

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

  const oneTimeSub = items
    .filter((i) => i.billingType !== "recurring")
    .reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const recurringSub = items
    .filter((i) => i.billingType === "recurring")
    .reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const subtotal = oneTimeSub + recurringSub;
  const vatAmount = Math.round((subtotal * quote.vatRate) / 100);
  const total = subtotal + vatAmount;
  const hasRecurring = recurringSub > 0;
  const hasOneTime = oneTimeSub > 0;

  const itemRows = items
    .map(
      (item, idx) => {
        const isRecurring = item.billingType === "recurring";
        const tipo = isRecurring ? "Ricorrente/mese" : "Una tantum";
        const importo = isRecurring
          ? `${formatEur(item.unitPrice)}/mese`
          : formatEur(item.unitPrice * item.quantity);
        return `
          <tr>
            <td>${idx + 1}</td>
            <td>${esc(item.description) || "—"}</td>
            <td>${tipo}</td>
            <td>${item.quantity}</td>
            <td>${importo}</td>
          </tr>`;
      }
    )
    .join("");

  const vociDettaglio = items
    .map(
      (item, idx) => `
        <div class="voce">
          <strong>${idx + 1}. ${esc(item.description)}</strong>
        </div>`
    )
    .join("");

  const totaliRows = `
    ${hasOneTime ? `<tr><td>Subtotale (Una tantum)</td><td class="importo">${formatEur(oneTimeSub)}</td></tr>` : ""}
    ${hasRecurring ? `<tr><td>Canone mensile ricorrente</td><td class="importo">${formatEur(recurringSub)}/mese</td></tr>` : ""}
    ${!hasOneTime && !hasRecurring ? `<tr><td>Subtotale</td><td class="importo">${formatEur(subtotal)}</td></tr>` : ""}
    <tr><td>IVA (${quote.vatRate}% / Regime applicabile)</td><td class="importo">${formatEur(vatAmount)}</td></tr>
    <tr>
      <td><strong>TOTALE DA CORRISPONDERE</strong></td>
      <td class="importo"><strong>${
        hasOneTime && hasRecurring
          ? `${formatEur(oneTimeSub)} + ${formatEur(recurringSub)}/mese`
          : formatEur(total)
      }</strong></td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preventivo - ${esc(contact?.company || contact?.name || "Cliente")}</title>
    <style>
        /* === STILI BASE === */
        :root {
            --colore-primario: #2c3e50;
            --colore-sfondo: #f8f9fa;
            --bordo: #e0e0e0;
            --testo: #333333;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: var(--testo);
            margin: 0;
            padding: 20px;
            background-color: #f4f4f4;
            font-size: 14px;
            line-height: 1.5;
        }
        .preventivo-container {
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
            padding: 40px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-radius: 4px;
        }

        /* === INTESTAZIONE === */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid var(--colore-primario);
        }
        .fornitore h1 { margin: 0; font-size: 22px; color: var(--colore-primario); }
        .fornitore p { margin: 2px 0; font-size: 13px; color: #555; }
        .dati-preventivo { text-align: right; }
        .dati-preventivo h2 { margin: 0 0 8px; font-size: 18px; color: var(--colore-primario); }
        .dati-preventivo p { margin: 2px 0; font-size: 13px; }

        /* === CLIENTE === */
        .cliente {
            background: var(--colore-sfondo);
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 25px;
        }
        .cliente h3 { margin: 0 0 8px; font-size: 15px; border-bottom: 1px solid var(--bordo); padding-bottom: 5px; }
        .cliente p { margin: 3px 0; font-size: 13px; }

        /* === TABELLA === */
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 10px 12px; border: 1px solid var(--bordo); text-align: left; }
        th { background-color: var(--colore-sfondo); font-weight: 600; text-align: center; font-size: 13px; }
        td:nth-child(2) { width: 45%; }
        td:nth-child(3), td:nth-child(4) { text-align: center; width: 12%; }
        td:nth-child(5) { text-align: right; width: 18%; font-weight: 500; }

        /* === TOTALI === */
        .totali { margin-left: auto; width: 45%; margin-bottom: 25px; }
        .totali table { border: none; margin: 0; }
        .totali td { border: none; padding: 6px 10px; }
        .totali tr:last-child { font-size: 1.15em; font-weight: bold; border-top: 2px solid var(--colore-primario); }
        .totali .importo { text-align: right; }

        /* === DESCRIZIONI FORMALI === */
        .descrizioni { margin-bottom: 25px; }
        .descrizioni h3 { margin: 0 0 12px; font-size: 15px; color: var(--colore-primario); }
        .voce { margin-bottom: 12px; }
        .voce strong { display: block; margin-bottom: 2px; }
        .voce p { margin: 0; font-size: 13px; color: #444; }

        /* === PAGAMENTO E NOTE === */
        .pagamento, .note { margin-bottom: 20px; font-size: 13px; }
        .pagamento p, .note p { margin: 4px 0; }

        /* === FOOTER === */
        .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid var(--bordo); padding-top: 15px; }

        /* === STAMPA === */
        .btn-stampa {
            display: block; width: fit-content; margin: 20px auto; padding: 10px 20px;
            background: var(--colore-primario); color: #fff; border: none; border-radius: 4px;
            cursor: pointer; font-size: 14px;
        }
        .btn-stampa:hover { opacity: 0.9; }

        /* === MODALITÀ MODIFICA === */
        [contenteditable="true"]:hover { outline: 1px dashed #aaa; border-radius: 2px; cursor: text; }
        [contenteditable="true"]:focus { outline: 2px solid var(--colore-primario); border-radius: 2px; }
        @media print {
            body { background: #fff; padding: 0; margin: 0; }
            .preventivo-container { box-shadow: none; padding: 0; max-width: 100%; }
            @page { size: A4 portrait; margin: 2cm; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
            .btn-stampa, .no-print { display: none !important; }
            .preventivo-container { border: none; }
        }
    </style>
</head>
<body>

<div class="preventivo-container" contenteditable="true">
    <!-- INTESTAZIONE -->
    <header class="header">
        <div class="fornitore">
            <h1>SarconX</h1>
            <p>Via Vigentina 15, 27100 Pavia</p>
            <p>P.IVA: 02838240188</p>
            <p>Tel: +39 334 134 0272</p>
        </div>
        <div class="dati-preventivo">
            <h2>PREVENTIVO</h2>
            <p><strong>N° Doc:</strong> ${esc(quote.number)}</p>
            <p><strong>Data:</strong> ${formatDateIt(quote.createdAt)}</p>
            <p><strong>Valido fino al:</strong> ${formatDateIt(quote.validUntil)}</p>
            <p><strong>Oggetto:</strong> ${esc(quote.title)}</p>
        </div>
    </header>

    <!-- DATI CLIENTE -->
    <section class="cliente">
        <h3>DESTINATARIO</h3>
        <p><strong>${esc(contact?.company || contact?.name || "—")}</strong></p>
        ${contact?.address ? `<p>${esc(contact.address)}</p>` : ""}
        ${contact?.vatNumber ? `<p><strong>P.IVA:</strong> ${esc(contact.vatNumber)}</p>` : ""}
        ${contact?.phone ? `<p><strong>Tel:</strong> ${esc(contact.phone)}</p>` : ""}
        ${contact?.email ? `<p>${esc(contact.email)}</p>` : ""}
    </section>

    <!-- TABELLA SERVIZI -->
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>DESCRIZIONE</th>
                <th>TIPO</th>
                <th>QTA</th>
                <th>IMPORTO</th>
            </tr>
        </thead>
        <tbody>
            ${itemRows || `<tr><td colspan="5" style="text-align:center;color:#999;padding:20px">Nessuna voce inserita</td></tr>`}
        </tbody>
    </table>

    <!-- TOTALI -->
    <div class="totali">
        <table>
            ${totaliRows}
        </table>
    </div>

    <!-- DESCRIZIONI FORMALI -->
    ${vociDettaglio ? `
    <section class="descrizioni">
        <h3>Dettaglio delle Voci di Offerta</h3>
        ${vociDettaglio}
    </section>` : ""}

    <!-- NOTE -->
    ${quote.notes ? `
    <section class="note">
        <p>${esc(quote.notes).replace(/\n/g, "<br>")}</p>
    </section>` : ""}

    <!-- MODALITÀ DI PAGAMENTO -->
    <section class="pagamento">
        <strong>Modalità di Pagamento:</strong> Bonifico Bancario
        <p>Intestatario C/C: Ricardo Consuegra &amp; Leonardo Sartori</p>
        <p>IBAN: LT783250090360011881</p>
        <p>Scadenza: 30 giorni data fattura (o come da accordi commerciali)</p>
    </section>

    <!-- FOOTER -->
    <footer class="footer">
        <p>SarconX | Via Vigentina 15, 27100 Pavia | P.IVA 02838240188</p>
        <p>Documento generato il ${formatDateIt(new Date())} | Rif. ${esc(quote.number)}</p>
        <p style="font-size:11px; color:#999; margin-top:5px;">Per accettazione: Firma ________________________ Data _______________</p>
    </footer>
</div>

<div class="no-print" style="text-align:center; margin: 10px auto; font-size:12px; color:#888;">
    ✏️ Clicca su qualsiasi testo per modificarlo direttamente
</div>
<button class="btn-stampa no-print" onclick="window.print()">🖨️ Stampa / Salva come PDF</button>

</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
