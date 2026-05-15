import { NextRequest } from "next/server";
import { getQuote } from "@/lib/db/quotes";
import { requireAuth } from "@/lib/auth";
import { getDeal } from "@/lib/db/deals";
import { getContact } from "@/lib/db/contacts";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface DbQuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number; // cents
  billingType?: "one_time" | "recurring";
}

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
    path.join(process.cwd(), "crm-config.json"),
    path.join(process.cwd(), "public", "crm-config.json"),
  ];
  for (const configPath of candidates) {
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      const json = JSON.parse(raw);
      if (json.company) return json.company;
    } catch {
      // try next
    }
  }
  return {};
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
  const auth = await requireAuth(_req);
  if (auth.error) return auth.error;

  const { id } = await params;

  const quote = await getQuote(id);
  if (!quote) {
    return new Response("Preventivo non trovato", { status: 404 });
  }

  const deal = quote.dealId ? await getDeal(quote.dealId) : null;
  const contact = deal?.contactId ? await getContact(deal.contactId) : null;
  const company = loadCompanyConfig();

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

  const totaliRows = `
    ${hasOneTime ? `<tr><td>Subtotale (Una tantum)</td><td class="importo">${formatEur(oneTimeSub)}</td></tr>` : ""}
    ${hasRecurring ? `<tr><td>Canone 1° mese</td><td class="importo">${formatEur(recurringSub)}</td></tr>` : ""}
    ${!hasOneTime && !hasRecurring ? `<tr><td>Subtotale</td><td class="importo">${formatEur(subtotal)}</td></tr>` : ""}
    <tr><td>IVA (${quote.vatRate}% / Regime applicabile)</td><td class="importo">${formatEur(vatAmount)}</td></tr>
    <tr class="totale-finale">
      <td><strong>TOTALE DA CORRISPONDERE</strong></td>
      <td class="importo"><strong>${formatEur(total)}</strong></td>
    </tr>
    ${hasRecurring ? `<tr class="ricorrente-row">
      <td><em>Canone dal secondo mese</em></td>
      <td class="importo"><em>${formatEur(recurringSub)}/mese</em></td>
    </tr>` : ""}`;

  const companyLines = [
    company.name ? `<h1>${esc(company.name)}</h1>` : "",
    company.address ? `<p>${esc(company.address)}</p>` : "",
    company.vatNumber ? `<p>P.IVA: ${esc(company.vatNumber)}</p>` : "",
    company.phone ? `<p>Tel: ${esc(company.phone)}</p>` : "",
    company.email ? `<p>${esc(company.email)}</p>` : "",
  ].filter(Boolean).join("");

  const footerCompany = [
    company.name,
    company.address,
    company.vatNumber ? `P.IVA ${company.vatNumber}` : "",
  ].filter(Boolean).join(" | ");

  const paymentBlock = [
    company.paymentTerms ? `<strong>Modalità di Pagamento:</strong> ${esc(company.paymentTerms)}` : `<strong>Modalità di Pagamento:</strong> Bonifico Bancario`,
    company.bankHolder ? `<p>Intestatario C/C: ${esc(company.bankHolder)}</p>` : "",
    company.iban ? `<p>IBAN: ${esc(company.iban)}</p>` : "",
  ].filter(Boolean).join("");

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
            padding: 24px 12px 120px;
            background-color: #e5e5e5;
            font-size: 14px;
            line-height: 1.5;
        }

        /* === TOOLBAR === */
        .toolbar {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 8px;
            background: var(--colore-primario);
            padding: 10px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            z-index: 1000;
            align-items: center;
        }
        .toolbar button {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            color: #fff;
            padding: 7px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            white-space: nowrap;
            font-family: inherit;
        }
        .toolbar button:hover { background: rgba(255,255,255,0.2); }
        .toolbar button.primary { background: #16a34a; border-color: #16a34a; }
        .toolbar button.primary:hover { background: #15803d; }
        .toolbar button.danger { background: #dc2626; border-color: #dc2626; }
        .toolbar button.danger:hover { background: #b91c1c; }

        /* === FOGLIO A4 === */
        .page-sheet {
            width: 210mm;
            min-height: 297mm;
            padding: 20mm;
            margin: 0 auto 24px;
            background: #fff;
            box-shadow: 0 2px 10px rgba(0,0,0,0.14);
            box-sizing: border-box;
            position: relative;
            outline: none;
        }
        .page-sheet:last-child { margin-bottom: 0; }

        /* Modifica inline */
        [contenteditable="true"]:hover { outline: 1px dashed #aaa; border-radius: 2px; cursor: text; }
        [contenteditable="true"]:focus { outline: 2px solid var(--colore-primario); border-radius: 2px; }

        /* === INTESTAZIONE === */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid var(--colore-primario);
            page-break-inside: avoid;
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
            page-break-inside: avoid;
        }
        .cliente h3 { margin: 0 0 8px; font-size: 15px; border-bottom: 1px solid var(--bordo); padding-bottom: 5px; }
        .cliente p { margin: 3px 0; font-size: 13px; }

        /* === TABELLA === */
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; page-break-inside: avoid; }
        thead { display: table-header-group; }
        th, td { padding: 10px 12px; border: 1px solid var(--bordo); text-align: left; }
        th { background-color: var(--colore-sfondo); font-weight: 600; text-align: center; font-size: 13px; }
        td:nth-child(2) { width: 45%; }
        td:nth-child(3), td:nth-child(4) { text-align: center; width: 12%; }
        td:nth-child(5) { text-align: right; width: 18%; font-weight: 500; }
        tr { page-break-inside: avoid; }

        /* === TOTALI === */
        .totali { margin-left: auto; width: 45%; margin-bottom: 25px; page-break-inside: avoid; }
        .totali table { border: none; margin: 0; }
        .totali td { border: none; padding: 6px 10px; }
        .totali tr.totale-finale { font-size: 1.15em; font-weight: bold; border-top: 2px solid var(--colore-primario); }
        .totali tr.ricorrente-row td { color: #555; font-size: 0.92em; padding-top: 4px; border-top: 1px dashed #ccc; }
        .totali .importo { text-align: right; }

        /* === DESCRIZIONI FORMALI === */
        .descrizioni { margin-bottom: 25px; page-break-inside: avoid; }
        .descrizioni h3 { margin: 0 0 12px; font-size: 15px; color: var(--colore-primario); }
        .voce { margin-bottom: 12px; page-break-inside: avoid; }
        .voce strong { display: block; margin-bottom: 2px; }
        .voce p { margin: 0; font-size: 13px; color: #444; }

        /* === PAGAMENTO E NOTE === */
        .pagamento, .note { margin-bottom: 20px; font-size: 13px; page-break-inside: avoid; }
        .pagamento p, .note p { margin: 4px 0; }

        /* === FOOTER === */
        .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #777;
            border-top: 1px solid var(--bordo);
            padding-top: 15px;
            page-break-inside: avoid;
        }

        /* === STAMPA === */
        @media print {
            body { background: #fff; padding: 0; margin: 0; }
            .page-sheet {
                box-shadow: none;
                margin: 0 auto;
                break-after: page;
                page-break-after: always;
                width: 100%;
                min-height: auto;
                padding: 0;
            }
            .page-sheet:last-child {
                break-after: auto;
                page-break-after: auto;
            }
            @page { size: A4 portrait; margin: 20mm; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
            .toolbar, .no-print { display: none !important; }
            .page-sheet { border: none; }
            /* Evita spezzature sui blocchi principali */
            .header, .cliente, .totali, .descrizioni, .pagamento, .note, .footer, table, tbody, tr, .voce {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>

<div id="pages">
    <div class="page-sheet" contenteditable="true">
        <!-- INTESTAZIONE -->
        <header class="header">
            <div class="fornitore">
                ${companyLines || `<h1>Azienda</h1>`}
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
            ${paymentBlock || `
            <strong>Modalità di Pagamento:</strong> Bonifico Bancario
            <p>Scadenza: 30 giorni data fattura</p>
            `}
        </section>

        <!-- FOOTER -->
        <footer class="footer">
            <p>${footerCompany || "Azienda"}</p>
            <p>Documento generato il ${formatDateIt(new Date())} | Rif. ${esc(quote.number)}</p>
            <p style="font-size:11px; color:#999; margin-top:5px;">Per accettazione: Firma ________________________ Data _______________</p>
        </footer>
    </div>
</div>

<div class="toolbar no-print">
    <button onclick="addPage()">➕ Aggiungi pagina</button>
    <button class="danger" onclick="removeLastPage()">➖ Rimuovi pagina</button>
    <button class="primary" onclick="window.print()">🖨️ Stampa / Salva PDF</button>
</div>

<div class="no-print" style="text-align:center; margin: 10px auto 80px; font-size:12px; color:#888;">
    ✏️ Clicca su qualsiasi testo per modificarlo. Ogni foglio = una pagina PDF.
</div>

<script>
    function addPage() {
        const container = document.getElementById('pages');
        const page = document.createElement('div');
        page.className = 'page-sheet';
        page.contentEditable = 'true';
        page.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#bbb;font-style:italic;">Pagina vuota — clicca per scrivere</div>';
        container.appendChild(page);
        // Posiziona il cursore nel div vuoto
        const emptyDiv = page.querySelector('div');
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(emptyDiv);
        sel.removeAllRanges();
        sel.addRange(range);
    }
    function removeLastPage() {
        const container = document.getElementById('pages');
        if (container.children.length > 1) {
            if (confirm('Rimuovere l\\'ultima pagina?')) {
                container.removeChild(container.lastElementChild);
            }
        } else {
            alert('Deve rimanere almeno una pagina.');
        }
    }
</script>

</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
