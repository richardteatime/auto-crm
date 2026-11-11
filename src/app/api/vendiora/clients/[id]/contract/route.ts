import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getClient, getSettings, listOffers } from "@/lib/vendiora/db";
import { buildContract, contractHtml, CONTRACT_CSS } from "@/lib/vendiora/contract";
import { playbookPackage } from "@/lib/vendiora/playbook";
import type { VdPackage } from "@/lib/vendiora/types";

export const dynamic = "force-dynamic";

// VendiOra contract on the official model "Offerta di fornitura servizi e consulenza" (art. 1–16, signatures,
// art. 1341/1342 approval, Allegato A with ONLY the package sold). Fixed text; missing data stays "[DA INSERIRE]".
// If the client signed online, the frozen signed text is shown (with signer, date, IP and SHA-256).
// Print-ready HTML ("Scarica PDF" prints it).

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }) : "");

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return new Response("Cliente non trovato", { status: 404 });
  const s = await getSettings();
  const offer = (await listOffers()).find((o) => o.clientId === client.id && o.signedAt) ?? null;

  let pkg: Partial<VdPackage> = {};
  try { pkg = client.packageSnapshot ? JSON.parse(client.packageSnapshot) : {}; } catch { pkg = {}; }
  const code = client.packageCode ?? pkg.code ?? null;
  const doc = buildContract({
    number: client.contractNumber, date: client.contractDate, name: client.name, address: client.address, taxId: client.taxId,
    email: client.email, phone: client.phoneE164 ?? client.phone, packageCode: code, packageName: client.packageName, price: client.price,
    payPlan: offer?.payPlan ?? (client.ops.installments?.length && client.ops.installments.length > 1 ? { n: client.ops.installments.length, amounts: client.ops.installments.map((r) => r.amount) } : null),
    signedAt: offer?.signedAt ?? null, signName: offer?.signName ?? null,
    customSheet: playbookPackage(code) ? null : {
      title: client.packageName, lines: (pkg.deliverables || "").split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean),
      duration: pkg.coachingDays ? `${pkg.coachingDays} giorni` : "", calls: pkg.includedCalls ?? 0,
    },
  }, s);
  const signed = offer?.contractText
    ? `<section class="signed"><b>Firmato elettronicamente</b> da ${esc(offer.signName)} il ${esc(new Date(offer.signedAt!).toLocaleString("it-IT", { timeZone: "Europe/Rome" }))} · IP ${esc(offer.signIp ?? "n/d")}<br>Impronta SHA-256 del testo firmato: <code>${esc(offer.signHash ?? "")}</code></section>`
    : "";
  const missing = doc.missing.length ? `Dati da completare: ${doc.missing.map(esc).join(", ")}.` : "Tutti i dati sono compilati.";

  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Contratto ${esc(client.contractNumber)} · ${esc(client.name)}</title>
<style>
  *{box-sizing:border-box} body{margin:0;background:#e5e7eb;color:#111827;font:400 13px/1.55 "Helvetica Neue",Helvetica,Arial,sans-serif}
  .toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;background:#111827;color:#fff;padding:10px 16px}
  .toolbar .warn{color:#fde68a;font-size:12px} .actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .toolbar button{font:600 13px/1 inherit;border-radius:8px;padding:9px 12px;border:1px solid #374151;background:#1f2937;color:#fff;cursor:pointer}
  .toolbar button.primary{background:#ea580c;border-color:#ea580c}
  .sheet{width:210mm;min-height:297mm;margin:16px auto;background:#fff;padding:18mm 18mm 22mm;box-shadow:0 10px 30px rgba(0,0,0,.12)}
  .head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8mm}
  .brand{font:800 22px/1 inherit;letter-spacing:-.02em} .brand b{color:#ea580c} .num{text-align:right;font-size:12px;color:#4b5563}
  .signed{margin-top:8mm;padding:10px 12px;border:1px solid #a7f3d0;background:#ecfdf5;border-radius:8px;font-size:12px;color:#065f46} .signed code{font-size:11px;word-break:break-all}
  pre.frozen{white-space:pre-wrap;font:13px/1.55 inherit;margin:0}
  ${CONTRACT_CSS}
  body.editing .sheet{outline:2px dashed #ea580c}
  @media print{ @page{size:A4;margin:14mm} body{background:#fff} .toolbar{display:none} .sheet{width:auto;min-height:0;margin:0;padding:0;box-shadow:none;outline:none !important} .contract .missing{background:none} }
</style></head><body>
<div class="toolbar">
  <div class="t"><strong>Contratto ${esc(client.contractNumber)}</strong> &nbsp;·&nbsp; ${esc(client.name)} &nbsp;·&nbsp; ${esc(client.packageName)}</div>
  <div class="actions">
    <span class="warn">${offer?.contractText ? "Testo firmato: non modificabile." : `Modello ufficiale. ${missing}`}</span>
    ${offer?.contractText ? "" : `<button type="button" id="edit-btn" onclick="toggleEdit()">Modifica testo</button>`}
    <button type="button" class="primary" onclick="window.print()">Scarica PDF</button>
  </div>
</div>
<main class="sheet">
  <header class="head">
    <div class="brand">Vendi<b>Ora</b></div>
    <div class="num"><strong>Offerta / contratto n. ${esc(offer?.number ?? client.contractNumber)}</strong><br>del ${date(client.contractDate)}</div>
  </header>
  <div class="contract">${offer?.contractText ? `<pre class="frozen">${esc(offer.contractText)}</pre>` : contractHtml(doc)}</div>
  ${signed}
</main>
<script>
function toggleEdit(){ const on=document.body.classList.toggle('editing'); document.querySelector('.contract').contentEditable=on?'true':'false'; document.getElementById('edit-btn').textContent=on?'Fine modifica':'Modifica testo'; }
</script>
</body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
