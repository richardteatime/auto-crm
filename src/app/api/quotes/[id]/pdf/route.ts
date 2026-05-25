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
  discount?: number; // %
  billingType?: "una_tantum" | "mensile" | "annuale";
  isSetup?: boolean;
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

function lineTotal(item: DbQuoteItem): number {
  const qty = typeof item.quantity === "number" ? item.quantity : parseFloat(item.quantity as unknown as string) || 0;
  const price = typeof item.unitPrice === "number" ? item.unitPrice : parseFloat(item.unitPrice as unknown as string) || 0;
  const disc = typeof item.discount === "number" ? item.discount : parseFloat(item.discount as unknown as string) || 0;
  return Math.round(qty * price * (1 - disc / 100));
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

  const setupItem = items.find((i) => i.isSetup);
  const normalItems = items.filter((i) => !i.isSetup);

  const setupSub = setupItem ? lineTotal(setupItem) : 0;
  const oneTimeItems = normalItems.filter((i) => i.billingType === "una_tantum");
  const monthlyItems = normalItems.filter((i) => i.billingType === "mensile");
  const annualItems = normalItems.filter((i) => i.billingType === "annuale");

  const oneTimeSub = oneTimeItems.reduce((s, i) => s + lineTotal(i), 0);
  const monthlySub = monthlyItems.reduce((s, i) => s + lineTotal(i), 0);
  const annualSub = annualItems.reduce((s, i) => s + lineTotal(i), 0);

  // First year: setup + one-time normal + 12 months monthly + 1 year annual
  const firstYearSub = setupSub + oneTimeSub + monthlySub * 12 + annualSub;
  const firstYearVat = Math.round((firstYearSub * quote.vatRate) / 100);
  const firstYearTotal = firstYearSub + firstYearVat;

  // Second year onward: only recurring (no setup, no one-time)
  const secondYearSub = monthlySub * 12 + annualSub;

  const hasSetup = setupSub > 0;
  const hasOneTime = oneTimeSub > 0;
  const hasMonthly = monthlySub > 0;
  const hasAnnual = annualSub > 0;

  const itemRows = normalItems
    .map((item) => {
      const lt = lineTotal(item);
      const unitLabel = item.billingType === "annuale" ? "/anno" : item.billingType === "mensile" ? "/mese" : "";
      const price = typeof item.unitPrice === "number" ? item.unitPrice : parseFloat(item.unitPrice as unknown as string) || 0;
      const qty = typeof item.quantity === "number" ? item.quantity : parseFloat(item.quantity as unknown as string) || 0;
      const gross = Math.round(qty * price);
      const tipo = item.billingType === "mensile" ? "Ricorrente/mese" : item.billingType === "annuale" ? "Ricorrente/anno" : "Una tantum";

      return `
        <div class="item-row">
          <div class="item-col item-col-left">
            <div class="item-title">${esc(item.description) || "—"}</div>
          </div>
          <div class="item-col item-col-meta">
            <span class="item-lordo">${formatEur(gross)}${unitLabel}</span>
            <span class="item-sep">·</span>
            <span class="item-tipo">${tipo}</span>
            <span class="item-sep">·</span>
            <span class="item-sconto">Sconto ${item.discount ?? 0}%</span>
          </div>
          <div class="item-col item-col-right">
            <div class="item-total">${formatEur(lt)}${unitLabel}</div>
          </div>
        </div>`;
    })
    .join("");

  const setupRow = setupItem
    ? `
      <div class="item-row setup-row">
        <div class="item-col item-col-left">
          <div class="item-title">${esc(setupItem.description) || "Sviluppo e installazione"}</div>
        </div>
        <div class="item-col item-col-meta">
          <span class="item-lordo">${formatEur(Math.round((typeof setupItem.quantity === "number" ? setupItem.quantity : parseFloat(setupItem.quantity as unknown as string) || 0) * (typeof setupItem.unitPrice === "number" ? setupItem.unitPrice : parseFloat(setupItem.unitPrice as unknown as string) || 0)))}</span>
          <span class="item-sep">·</span>
          <span class="item-tipo">Una tantum</span>
          <span class="item-sep">·</span>
          <span class="item-sconto">Sconto ${setupItem.discount ?? 0}%</span>
        </div>
        <div class="item-col item-col-right">
          <div class="item-total">${formatEur(setupSub)}</div>
        </div>
      </div>`
    : "";

  const totalsRows = `
    ${hasSetup ? `<div class="total-row"><span>Sviluppo e installazione</span><span>${formatEur(setupSub)}</span></div>` : ""}
    ${hasOneTime ? `<div class="total-row"><span>Una tantum</span><span>${formatEur(oneTimeSub)}</span></div>` : ""}
    ${hasMonthly ? `<div class="total-row"><span>Ricorrente/mese</span><span>${formatEur(monthlySub)}/mese</span></div>` : ""}
    ${hasAnnual ? `<div class="total-row"><span>Ricorrente/anno</span><span>${formatEur(annualSub)}/anno</span></div>` : ""}
    <div class="total-row" style="border-top:1px solid var(--bordo); margin-top:6px; padding-top:8px;"><span>Subtotale primo anno</span><span>${formatEur(firstYearSub)}</span></div>
    <div class="total-row"><span>IVA (${quote.vatRate}%)</span><span>${formatEur(firstYearVat)}</span></div>
    <div class="total-row total-final">
      <span>TOTALE DA CORRISPONDERE</span>
      <span>${formatEur(firstYearTotal)}</span>
    </div>
    ${secondYearSub > 0 ? `<div class="total-row" style="margin-top:8px; color:#777;"><span>Canone secondo anno in poi</span><span>${formatEur(secondYearSub)}/anno</span></div>` : ""}`;

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
    company.paymentTerms
      ? `<strong>Modalità di Pagamento:</strong> ${esc(company.paymentTerms)}`
      : `<strong>Modalità di Pagamento:</strong> Bonifico Bancario`,
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
            margin-bottom: 25px;
            page-break-inside: avoid;
            border-bottom: 1px solid var(--bordo);
            padding-bottom: 15px;
        }
        .cliente h3 { margin: 0 0 8px; font-size: 15px; color: var(--colore-primario); }
        .cliente p { margin: 3px 0; font-size: 13px; }

        /* === NOTE / CONDIZIONI === */
        .note, .pagamento {
            margin-bottom: 25px;
            font-size: 13px;
            page-break-inside: avoid;
            line-height: 1.6;
        }
        .note h3, .pagamento h3 {
            margin: 0 0 10px;
            font-size: 14px;
            color: var(--colore-primario);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .note p, .pagamento p { margin: 4px 0; }

        /* === RIGHE OFFERTA (CLEAN) === */
        .items-section { margin-top: 10px; margin-bottom: 25px; }
        .items-section h3 {
            margin: 0 0 15px;
            font-size: 14px;
            color: var(--colore-primario);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid var(--colore-primario);
            padding-bottom: 6px;
        }
        .item-row {
            display: flex;
            align-items: center;
            padding: 14px 0;
            border-bottom: 1px solid #eee;
            page-break-inside: avoid;
        }
        .item-row:last-child { border-bottom: none; }
        .item-col { display: flex; flex-direction: column; }
        .item-col-left { flex: 1; padding-right: 20px; }
        .item-col-meta { width: 320px; text-align: center; flex-direction: row; align-items: center; justify-content: center; gap: 6px; font-size: 12px; color: #555; }
        .item-col-right { width: 140px; text-align: right; }
        .item-title { font-weight: 600; font-size: 14px; color: var(--testo); margin-bottom: 3px; }
        .item-lordo { color: #777; text-decoration: line-through; }
        .item-sep { color: #bbb; }
        .item-tipo { font-weight: 500; }
        .item-sconto { color: #c0392b; font-weight: 600; }
        .item-total { font-weight: 700; font-size: 15px; color: var(--colore-primario); }
        .setup-row { background: #f4f7fa; border-radius: 6px; padding: 14px 10px; margin-bottom: 4px; }
        .setup-row .item-title { color: var(--colore-primario); }

        /* === TOTALI === */
        .totals {
            margin-left: auto;
            width: 50%;
            margin-bottom: 25px;
            page-break-inside: avoid;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            font-size: 13px;
            color: #555;
        }
        .total-row.total-final {
            font-size: 1.15em;
            font-weight: bold;
            color: var(--colore-primario);
            border-top: 2px solid var(--colore-primario);
            margin-top: 6px;
            padding-top: 10px;
        }

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
            .toolbar, .no-print { display: none !important; }
            .page-sheet { border: none; }
            .header, .cliente, .note, .pagamento, .items-section, .totals, .footer, .item-row {
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

        <!-- NOTE / CONDIZIONI -->
        ${quote.notes ? `
        <section class="note">
            <h3>Note e Condizioni</h3>
            <p>${esc(quote.notes).replace(/\n/g, "<br>")}</p>
        </section>` : ""}

        <!-- MODALITÀ DI PAGAMENTO -->
        <section class="pagamento">
            <h3>Modalità di Pagamento</h3>
            ${paymentBlock || `
            <strong>Modalità di Pagamento:</strong> Bonifico Bancario
            <p>Scadenza: 30 giorni data fattura</p>
            `}
        </section>

        <!-- RIGHE OFFERTA -->
        <section class="items-section">
            <h3>Dettaglio Offerta</h3>
            ${setupRow}
            ${itemRows || `<p style="color:#999;font-style:italic;">Nessuna voce inserita</p>`}
        </section>

        <!-- TOTALI -->
        <div class="totals">
            ${totalsRows}
        </div>

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
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
