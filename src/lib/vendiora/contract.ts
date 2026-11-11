// Official contract "Offerta di fornitura servizi e consulenza": art. 1–16 + signatures + art. 1341/1342
// + Allegato A with ONLY the sheet of the package sold. Text is fixed (contract-template.ts, verbatim from the
// document); client data comes from the offer/client, provider data from Impostazioni, anything missing
// stays "[DA INSERIRE]". Nothing is invented.

import { CONTRACT_LINES } from "@/lib/vendiora/contract-template";
import { playbookPackage, type PlaybookPackage } from "@/lib/vendiora/playbook";
import type { VdOffer, VdPackage, VendioraSettings } from "@/lib/vendiora/types";

export const MISSING = "[DA INSERIRE]";

const eurNum = (cents: number) => new Intl.NumberFormat("it-IT", { useGrouping: "always", minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100);
const dateIt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }) : "";

export interface ContractInput {
  number: string;
  date: string | null;
  name: string;
  address: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  packageCode: string | null;
  packageName: string;
  /** cents */
  price: number;
  payPlan?: { n: number; amounts?: number[]; dueDays?: number[] } | null;
  signedAt?: string | null;
  signName?: string | null;
  /** fallback sheet for packages outside the playbook */
  customSheet?: { title: string; lines: string[]; duration: string; calls: number } | null;
}

export interface ContractDoc {
  /** Plain lines (frozen at signing, hashed) */
  lines: { kind: "title" | "h" | "p" | "li" | "sig"; text: string; missing: boolean }[];
  missing: string[];
  text: string;
}

export function installments(price: number, plan: ContractInput["payPlan"]): { amount: number; day: number }[] {
  const n = Math.max(1, Math.min(12, plan?.n ?? 1));
  if (n === 1) return [{ amount: price, day: 0 }];
  const base = Math.floor(price / n / 100) * 100;
  const amounts = plan?.amounts?.length === n ? plan.amounts : Array.from({ length: n }, (_, i) => (i === n - 1 ? price - base * (n - 1) : base));
  const days = plan?.dueDays?.length === n ? plan.dueDays : Array.from({ length: n }, (_, i) => i * 30);
  return amounts.map((amount, i) => ({ amount, day: days[i] }));
}

export function buildContract(input: ContractInput, settings: VendioraSettings): ContractDoc {
  const co = settings.company;
  const pc = settings.playbook.contract;
  const pkg: PlaybookPackage | null = playbookPackage(input.packageCode);
  const rates = installments(input.price, input.payPlan);
  const start = input.signedAt || input.date || new Date().toISOString();
  const missing: string[] = [];
  const v = (label: string, s: string | null | undefined) => {
    if (s && String(s).trim()) return String(s).trim();
    missing.push(label);
    return MISSING;
  };
  const providerName = [co.name, co.legalForm].filter(Boolean).join(" ");
  const vals: Record<string, string> = {
    numero_offerta: input.number,
    data_offerta: dateIt(input.date) || dateIt(new Date().toISOString()),
    ragione_sociale_fornitore: v("Ragione sociale del fornitore", providerName),
    sede_fornitore: v("Sede del fornitore", [co.address, co.state].filter(Boolean).join(", ")),
    piva_fornitore: v("P.IVA del fornitore", co.ein),
    pec_fornitore: v("PEC del fornitore", pc.pec),
    pec_o_email_fornitore: v("PEC o email del fornitore", pc.pec || co.email),
    legale_rappresentante: v("Legale rappresentante", co.representative),
    nome_cognome_o_ragione_sociale_cliente: v("Nome del cliente", input.name),
    indirizzo_cliente: v("Indirizzo del cliente", input.address),
    cf_piva_cliente: v("C.F. / P.IVA del cliente", input.taxId),
    email_cliente: v("Email del cliente", input.email),
    telefono_cliente: v("Telefono del cliente", input.phone),
    nome_pacchetto: input.packageName,
    durata_pacchetto: pkg?.durationLabel ?? v("Durata del pacchetto", input.customSheet?.duration),
    numero_call: String(pkg?.calls.length ?? input.customSheet?.calls ?? v("Numero di call", null)),
    prezzo: eurNum(input.price),
    iva_inclusa_o_esclusa: pc.vat === "inclusa" ? "IVA inclusa" : "+ IVA",
    unica_soluzione_o_rate: rates.length > 1 ? `in ${rates.length} rate` : "in unica soluzione",
    numero_rate: rates.length > 1 ? String(rates.length) : "—",
    importo_rata: rates.length > 1 ? (new Set(rates.map((r) => r.amount)).size === 1 ? eurNum(rates[0].amount) : rates.map((r) => eurNum(r.amount)).join(" / ")) : "—",
    scadenze_rate: rates.length > 1 ? rates.map((r, i) => (i === 0 ? "alla firma" : `a ${r.day} giorni dalla firma`)).join(", ") : "—",
    link_informativa_privacy: v("Link all'informativa privacy", settings.playbook.links.privacy),
    foro_competente: v("Foro competente", pc.court || co.court),
    luogo: v("Luogo di firma", pc.place),
    data_firma: input.signedAt ? dateIt(input.signedAt) : dateIt(start),
  };
  const fill = (l: string) => l.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vals[k] ?? MISSING);
  const out: ContractDoc["lines"] = [];
  const push = (kind: ContractDoc["lines"][number]["kind"], text: string) => out.push({ kind, text, missing: text.includes(MISSING) });

  let inSig = false;
  let firma = 0;
  CONTRACT_LINES.forEach((raw, i) => {
    let l = fill(raw);
    if (i === 0) return push("title", l);
    if (/^(Parti|Premesse|Firme|Approvazione specifica delle clausole)$/.test(l) || /^Art\. \d+ – /.test(l)) {
      inSig = l === "Firme";
      return push("h", l);
    }
    if (l.startsWith("Luogo e data")) return push("p", l);
    if (inSig || /^Firma: _+$/.test(l)) {
      // 1st "Firma" = provider, the others = client
      if (/^Firma: _+$/.test(l) && ++firma !== 1 && input.signName) l = `Firma: ${input.signName} (firma elettronica del ${dateIt(input.signedAt)})`;
      return push("sig", l);
    }
    if (l.startsWith("• ")) return push("li", l.slice(2));
    push("p", l);
  });
  // Allegato A: only the package sold
  push("h", "Allegato A – Scheda del pacchetto");
  if (pkg) {
    push("p", pkg.sheetTitle.replace(/\d[\d.]* €$/, `${eurNum(input.price)} €`));
    for (const s of pkg.sheet) push("li", s);
  } else if (input.customSheet) {
    push("p", input.customSheet.title);
    for (const s of input.customSheet.lines) push("li", s);
  } else {
    push("p", MISSING);
    missing.push("Scheda del pacchetto");
  }
  const text = out.map((x) => (x.kind === "li" ? `• ${x.text}` : x.text)).join("\n");
  return { lines: out, missing: [...new Set(missing)], text };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Body HTML (no <html>): used by the print page and by the public offer page */
export function contractHtml(doc: ContractDoc): string {
  const mark = (s: string) => esc(s).replaceAll(MISSING, `<span class="missing">${MISSING}</span>`);
  let html = "";
  let list = false;
  let sig: string[] = [];
  const flushSig = () => {
    if (!sig.length) return;
    html += `<div class="sig">${sig.map((s) => `<div>${s}</div>`).join("")}</div>`;
    sig = [];
  };
  for (const l of doc.lines) {
    if (l.kind !== "li" && list) { html += "</ul>"; list = false; }
    if (l.kind !== "sig") flushSig();
    if (l.kind === "title") html += `<h1>${mark(l.text)}</h1>`;
    else if (l.kind === "h") html += `<h3>${mark(l.text)}</h3>`;
    else if (l.kind === "li") { if (!list) { html += "<ul>"; list = true; } html += `<li>${mark(l.text)}</li>`; }
    else if (l.kind === "sig") sig.push(mark(l.text));
    else html += `<p>${mark(l.text)}</p>`;
  }
  if (list) html += "</ul>";
  flushSig();
  return html;
}

export const CONTRACT_CSS = `
.contract h1{font-size:20px;margin:0 0 4px}
.contract h3{font-size:13.5px;margin:18px 0 6px;text-transform:none}
.contract p,.contract li{font-size:13px;line-height:1.55;margin:4px 0}
.contract ul{margin:4px 0 4px 18px;padding:0}
.contract .sig{display:grid;grid-template-columns:1fr 1fr;gap:6px 40px;margin:8px 0;font-size:13px}
.contract .missing{background:#fde68a;color:#7c2d12;border-radius:3px;padding:0 3px;font-weight:600}
`;

/** Contract input from an offer (public page, print page, client conversion) */
export function offerContractInput(o: VdOffer, signName?: string | null, signedAt?: string | null): ContractInput {
  let pkg: Partial<VdPackage> = {};
  try { pkg = o.packageSnapshot ? JSON.parse(o.packageSnapshot) : {}; } catch { pkg = {}; }
  const code = o.packageCode ?? pkg.code ?? null;
  return {
    number: o.number, date: o.sentAt || o.createdAt, name: o.name, address: o.address ?? null, taxId: o.taxId ?? null, email: o.email,
    phone: o.phoneE164, packageCode: code, packageName: o.packageName, price: o.price, payPlan: o.payPlan ?? null,
    signedAt: signedAt ?? o.signedAt ?? null, signName: signName ?? o.signName ?? null,
    customSheet: playbookPackage(code) ? null : {
      title: `${o.packageName} – ${eurNum(o.price)} €`, lines: (pkg.deliverables || "").split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean),
      duration: pkg.coachingDays ? `${pkg.coachingDays} giorni` : "", calls: pkg.includedCalls ?? 0,
    },
  };
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
