import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getClient, getSettings } from "@/lib/vendiora/db";
import type { VdPackage } from "@/lib/vendiora/types";

export const dynamic = "force-dynamic";

// Vendiora contract: fixed clauses, values from the package snapshot taken at sale time.
// Print-ready HTML ("Scarica PDF" prints it), same approach as the quote PDF.

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MISSING = `<span class="missing">[DA INSERIRE]</span>`;
const val = (s: string | null | undefined) => (s && s.trim() ? esc(s.trim()) : MISSING);
const eurFmt = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", useGrouping: "always" });
const eur = (cents: number) => eurFmt.format(cents / 100);
const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }) : "";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return new Response("Cliente non trovato", { status: 404 });
  const { company } = await getSettings();

  let pkg: Partial<VdPackage> = {};
  try { pkg = client.packageSnapshot ? JSON.parse(client.packageSnapshot) : {}; } catch { pkg = {}; }
  const calls = pkg.includedCalls ?? 0;
  const buildDays = pkg.buildDays ?? 7;
  const coachingDays = pkg.coachingDays ?? 0;
  const vat = Math.round((client.price * (client.vatRate ?? 22)) / 100);
  const deliverables = (pkg.deliverables || "").split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

  const provider = [
    `<strong>${val(company.name)}</strong>${company.legalForm ? ` ${esc(company.legalForm)}` : ""}`,
    `sede: ${val(company.address)}${company.state ? `, ${esc(company.state)}` : ""}`,
    `P.IVA / n. registrazione: ${val(company.ein)}`,
    `rappresentata da ${val(company.representative)}${company.representativeRole ? `, ${esc(company.representativeRole)}` : ""}`,
    [company.email, company.phone].filter(Boolean).map(esc).join(" · "),
  ].filter(Boolean).join("<br>");
  const customer = [
    `<strong>${esc(client.name)}</strong>`,
    `C.F. / P.IVA: ${val(client.taxId)}`,
    `residenza / sede: ${val(client.address)}`,
    [client.email, client.phone].filter(Boolean).map(esc).join(" · "),
  ].filter(Boolean).join("<br>");

  let n = 0;
  const art = (title: string, body: string) => `<section class="art"><h3>Art. ${++n} – ${esc(title)}</h3>${body}</section>`;
  const P = (s: string) => `<p>${s}</p>`;

  const articles = [
    art("Oggetto", P(`Il Fornitore si impegna a realizzare per il Cliente uno store e-commerce su piattaforma Shopify e ad affiancarlo nel suo avvio secondo il pacchetto <strong>«${esc(client.packageName)}»</strong>${pkg.tagline ? ` (${esc(pkg.tagline)})` : ""}, che comprende:`) +
      (deliverables.length ? `<ul>${deliverables.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : P(MISSING)) +
      P(`Sono incluse <strong>${calls} call individuali</strong> in videochiamata${coachingDays ? ` da svolgersi entro <strong>${coachingDays} giorni</strong> dalla call di avvio` : ""}. Quanto non è espressamente elencato non è compreso nel presente contratto.`)),
    art("Avvio e tempi di consegna", P(`I lavori iniziano con la call di avvio. Lo store viene consegnato online entro <strong>${buildDays} giorni</strong> dalla call di avvio, a condizione che entro quella data il Cliente abbia fornito quanto richiesto dal Fornitore: accessi agli account (Shopify, dominio, sistemi di pagamento), informazioni su prodotti e fornitori, testi, immagini, dati fiscali e legali dell'attività. I giorni di ritardo nella consegna dei materiali o nelle approvazioni imputabili al Cliente non sono conteggiati nel termine.`)),
    art("Garanzia di consegna", P(pkg.guarantee ? esc(pkg.guarantee).replace(/\n/g, "<br>") : MISSING) + P(`La garanzia si applica solo se il Cliente ha rispettato quanto previsto all'art. 2 e non opera per ritardi dovuti a terzi (ad esempio verifiche o sospensioni da parte di Shopify, dei fornitori di pagamento o del registrar del dominio).`)),
    art("Corrispettivo e pagamento", `<table class="money"><tr><td>Corrispettivo</td><td>${eur(client.price)}</td></tr><tr><td>IVA ${client.vatRate ?? 22}%</td><td>${eur(vat)}</td></tr><tr class="tot"><td>Totale</td><td>${eur(client.price + vat)}</td></tr></table>` +
      P(`Modalità di pagamento: ${client.paymentTerms ? esc(client.paymentTerms).replace(/\n/g, "<br>") : MISSING}${company.bank ? `<br>Coordinate: ${esc(company.bank)}` : ""}`) +
      P(`Restano a carico del Cliente, e non sono compresi nel corrispettivo: abbonamento Shopify e app a pagamento, dominio, budget pubblicitario, acquisto della merce, costi di spedizione e commissioni dei sistemi di pagamento.`)),
    art("Call di affiancamento", P(`Le call si prenotano attraverso il calendario indicato dal Fornitore. Una call può essere spostata avvisando almeno 24 ore prima; in caso contrario si considera svolta. Le call non utilizzate entro il periodo di affiancamento non sono recuperabili né rimborsabili. Tra una call e l'altra il Fornitore offre supporto via chat nei giorni lavorativi.`)),
    art("Obblighi del Cliente", P(`Il Cliente è titolare degli account, del dominio e dell'attività di vendita, ed è l'unico responsabile della conformità dell'attività alle norme fiscali, commerciali e di tutela dei consumatori (resi, garanzie, privacy, etichettatura), della liceità dei prodotti e dei contenuti forniti e dei rapporti con i propri fornitori e clienti.`)),
    art("Nessuna garanzia di risultato", P(`Il Fornitore presta la propria attività con diligenza professionale, ma non garantisce alcun risultato economico: vendite e guadagni dipendono da prodotto, mercato, budget investito ed esecuzione da parte del Cliente. Eventuali risultati di altri clienti mostrati a scopo illustrativo non costituiscono promessa di guadagno.`)),
    art("Proprietà", P(`Lo store, il dominio, gli account e i contenuti realizzati per il Cliente sono di sua proprietà una volta saldato il corrispettivo. Metodi, materiali formativi e modelli del Fornitore restano di sua proprietà e sono concessi al Cliente per uso personale, senza diritto di cederli o divulgarli.`)),
    art("Riservatezza e dati personali", P(`Le parti mantengono riservate le informazioni ricevute nell'esecuzione del contratto. I dati personali del Cliente sono trattati dal Fornitore solo per eseguire il contratto e adempiere agli obblighi di legge, nel rispetto del Regolamento UE 2016/679 (GDPR).`)),
    art("Diritto di recesso", P(`Se il Cliente è un consumatore e il contratto è concluso a distanza, può recedere senza motivo entro 14 giorni dalla conclusione (artt. 52 e seguenti del Codice del Consumo) comunicandolo per iscritto a ${val(company.email)}. Firmando, il Cliente chiede espressamente che i servizi inizino prima della fine di tale periodo: in caso di recesso pagherà la parte di servizio già prestata e, a servizio interamente eseguito, perderà il diritto di recesso.`)),
    art("Durata e risoluzione", P(`Il contratto dura fino al termine del periodo di affiancamento. In caso di mancato pagamento nei termini, il Fornitore può sospendere i servizi dopo un sollecito scritto rimasto senza esito per 7 giorni e risolvere il contratto ai sensi dell'art. 1456 c.c.`)),
    art("Legge applicabile e foro", P(`Il contratto è regolato dalla legge italiana. Se il Cliente è un consumatore, è competente il foro del suo luogo di residenza; negli altri casi è competente in via esclusiva il foro di ${val(company.court)}.`)),
  ].join("");

  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8">
<title>Contratto ${esc(client.contractNumber)} · ${esc(client.name)}</title>
<style>
  :root { --ink:#111827; --ink-2:#374151; --muted:#6b7280; --line:#d1d5db; --soft:#e5e7eb; --accent:#ea580c; --font:"Helvetica Neue",Helvetica,Arial,sans-serif; }
  * { box-sizing:border-box; } html { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { margin:0; background:#e5e7eb; color:var(--ink); font:400 10pt/1.5 var(--font); }
  .sheet { width:210mm; min-height:297mm; margin:72px auto 48px; background:#fff; padding:15mm 16mm 18mm; box-shadow:0 10px 30px rgba(0,0,0,.08); }
  body.editing .sheet { outline:2px dashed var(--accent); outline-offset:6px; }
  .head { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid var(--ink); padding-bottom:4mm; }
  .brand { font:800 18pt/1 var(--font); letter-spacing:-.02em; } .brand b { color:var(--accent); }
  .num { text-align:right; font-size:9pt; color:var(--ink-2); } .num strong { color:var(--ink); font-size:10pt; }
  h1 { font:700 15pt/1.25 var(--font); margin:7mm 0 1mm; } .sub { color:var(--muted); margin:0 0 6mm; font-size:9.5pt; }
  .parties { display:grid; grid-template-columns:1fr 1fr; gap:6mm; margin-bottom:6mm; }
  .box { border:1px solid var(--line); padding:3.5mm 4mm; font-size:9.3pt; line-height:1.55; }
  .box .lab { font:600 7.5pt/1 var(--font); letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-bottom:2mm; }
  .premise { font-size:9.5pt; color:var(--ink-2); margin:0 0 5mm; }
  .art { break-inside:avoid-page; margin:0 0 4mm; }
  .art h3 { font:700 9.8pt/1.3 var(--font); margin:0 0 1.3mm; break-after:avoid; }
  .art p { margin:0 0 1.6mm; font-size:9.3pt; color:var(--ink-2); text-align:justify; }
  .art ul { margin:0 0 1.6mm; padding-left:5mm; font-size:9.3pt; color:var(--ink-2); } .art li { margin:0 0 .6mm; }
  table.money { border-collapse:collapse; margin:1mm 0 2mm; min-width:85mm; font-variant-numeric:tabular-nums; }
  table.money td { padding:1.2mm 0; border-bottom:1px solid var(--soft); font-size:9.5pt; } table.money td:last-child { text-align:right; padding-left:12mm; font-weight:600; }
  table.money tr.tot td { font-weight:700; color:var(--ink); border-bottom:1px solid var(--ink); }
  .missing { background:#fef3c7; color:#92400e; padding:0 3px; border-radius:2px; font-weight:600; }
  .signs { display:grid; grid-template-columns:1fr 1fr; gap:16mm; margin-top:8mm; break-inside:avoid; }
  .signs .who { font-size:8.5pt; color:var(--muted); } .signs .line { border-bottom:1px solid var(--ink); height:14mm; } .signs .cap { font-size:8pt; color:var(--muted); margin-top:1.2mm; }
  .approve { margin-top:7mm; font-size:8.6pt; color:var(--ink-2); break-inside:avoid; }
  .toolbar { position:fixed; inset:0 0 auto 0; height:52px; display:flex; align-items:center; justify-content:space-between; padding:0 20px; background:#111827; color:#fff; font:600 13px/1 var(--font); z-index:10; }
  .toolbar .t { color:#d1d5db; font-weight:400; } .toolbar .t strong { color:#fff; font-weight:600; } .toolbar .actions { display:flex; gap:8px; align-items:center; }
  .toolbar button { font:600 13px/1 var(--font); color:#fff; background:transparent; border:1px solid #4b5563; border-radius:6px; padding:9px 14px; cursor:pointer; }
  .toolbar button.primary { background:var(--accent); border-color:var(--accent); }
  .toolbar .warn { font:400 12px/1.3 var(--font); color:#fcd34d; margin-right:8px; max-width:420px; }
  @page { size:A4; margin:14mm 16mm 16mm; @bottom-right { content:"Contratto ${esc(client.contractNumber)} – pag. " counter(page) " di " counter(pages); font:7pt Arial,sans-serif; color:#6b7280; } }
  @media print { body { background:#fff; } .toolbar { display:none !important; } .sheet { width:auto; min-height:0; margin:0; padding:0; box-shadow:none; outline:none !important; } .missing { background:none; } }
</style></head><body>
<div class="toolbar">
  <div class="t"><strong>Contratto ${esc(client.contractNumber)}</strong> &nbsp;·&nbsp; ${esc(client.name)} &nbsp;·&nbsp; ${esc(client.packageName)}</div>
  <div class="actions">
    <span class="warn">Bozza standard: va fatta rivedere da un legale prima dell'uso. I campi gialli sono da completare.</span>
    <button type="button" id="edit-btn" onclick="toggleEdit()">Modifica testo</button>
    <button type="button" class="primary" onclick="window.print()">Scarica PDF</button>
  </div>
</div>
<main class="sheet">
  <header class="head">
    <div class="brand">Vendi<b>Ora</b></div>
    <div class="num"><strong>Contratto n. ${esc(client.contractNumber)}</strong><br>del ${date(client.contractDate)}</div>
  </header>
  <h1>Contratto di servizi – ${esc(client.packageName)}</h1>
  <p class="sub">Realizzazione store e-commerce e affiancamento</p>
  <section class="parties">
    <div class="box"><div class="lab">Fornitore</div>${provider}</div>
    <div class="box"><div class="lab">Cliente</div>${customer}</div>
  </section>
  <p class="premise">Le parti sopra indicate («Fornitore» e «Cliente») convengono quanto segue.</p>
  ${articles}
  <div class="signs">
    <div><div class="who">Luogo e data</div><div class="line"></div></div>
    <div></div>
    <div><div class="who">Il Fornitore</div><div class="line"></div><div class="cap">${val(company.representative)} per ${val(company.name)}</div></div>
    <div><div class="who">Il Cliente</div><div class="line"></div><div class="cap">${esc(client.name)}</div></div>
  </div>
  <p class="approve">Ai sensi degli artt. 1341 e 1342 c.c. il Cliente dichiara di approvare specificamente gli articoli 3 (Garanzia di consegna), 5 (Call di affiancamento), 7 (Nessuna garanzia di risultato), 11 (Durata e risoluzione) e 12 (Legge applicabile e foro).</p>
  <div class="signs" style="margin-top:4mm"><div></div><div><div class="who">Il Cliente</div><div class="line"></div></div></div>
</main>
<script>
function toggleEdit(){ const on=document.body.classList.toggle('editing'); document.querySelector('.sheet').contentEditable=on?'true':'false'; document.getElementById('edit-btn').textContent=on?'Fine modifica':'Modifica testo'; }
</script>
</body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
