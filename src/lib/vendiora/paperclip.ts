/**
 * Ponte CRM → Paperclip (azienda «VendiOra», consegna DFY).
 * Il CRM apre un compito principale assegnato al Project Manager e poi legge stato e commenti.
 * La chiave è quella dell'agente Project Manager: può creare compiti e leggere solo nell'azienda VendiOra.
 * Gli agenti non scrivono mai al cliente: qui leggiamo solo le righe «# Fase: …» e «# Serve dal cliente: …».
 */
import { getClient, patchClientOps } from "@/lib/vendiora/db";
import { playbookPackage } from "@/lib/vendiora/playbook";
import type { ClientOps, PaperclipDelivery, VdClient } from "@/lib/vendiora/types";

const URL_ = () => (process.env.PAPERCLIP_URL ?? "").replace(/\/$/, "");
const KEY = () => process.env.PAPERCLIP_VENDIORA_KEY ?? "";
const CO = () => process.env.PAPERCLIP_VENDIORA_COMPANY ?? "";
const PM = () => process.env.PAPERCLIP_VENDIORA_PM ?? "";
const PROJECT = () => process.env.PAPERCLIP_VENDIORA_PROJECT ?? "";

export const paperclipConfigured = () => !!(URL_() && KEY() && CO() && PM());
/** Avvio automatico all'attivazione di un cliente DFY (env PAPERCLIP_VENDIORA_AUTO=1) */
export const paperclipAuto = () => paperclipConfigured() && process.env.PAPERCLIP_VENDIORA_AUTO === "1";

async function pc<T>(method: string, path: string, body?: unknown): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(URL_() + path, {
      method,
      headers: { Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl.signal,
      cache: "no-store",
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(`Paperclip ${r.status}: ${txt.slice(0, 200)}`);
    return (txt ? JSON.parse(txt) : null) as T;
  } finally {
    clearTimeout(t);
  }
}

/** Codice stabile del cliente per ramo e cartelle: nome-in-minuscolo + 4 caratteri dell'id */
export function clientCode(c: Pick<VdClient, "id" | "name">): string {
  const slug = c.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "cliente";
  return `${slug}-${c.id.slice(-4)}`;
}

const ITA = (d: Date) => d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Rome" });

/** Testo del compito principale (niente email né telefono del cliente) */
export function deliveryBrief(c: VdClient, test: boolean): { title: string; description: string } {
  const pkg = playbookPackage(c.packageCode);
  const code = clientCode(c);
  const o: ClientOps = c.ops ?? {};
  const start = o.accessesAt ? new Date(o.accessesAt) : null;
  const due = start ? ITA(new Date(start.getTime() + 7 * 86400000)) : "7 giorni da quando arrivano tutti gli accessi (non ancora tutti arrivati)";
  const access = Object.entries(o.access ?? {}).map(([k, v]) => `${v ? "✅" : "⏳"} ${k}`).join(" · ") || "—";
  const h = o.handover ?? {};
  const lines = [
    test ? "**MODALITÀ PROVA** — cliente finto: fai solo il piano dei compiti e la ricerca. Zero crediti kie, nessuno store, nessun ramo da pubblicare." : null,
    `**Codice cliente:** \`${code}\` · ramo \`dfy/${code}\``,
    `**Pacchetto:** ${pkg?.code ?? c.packageCode ?? "?"} – ${pkg?.name ?? c.packageName}`,
    `**Scadenza consegna:** ${due}`,
    `**Store Shopify:** ${c.storeUrl || "non ancora collegato (vedi tabella «Store collegati» in regole-vendiora)"}`,
    `**Accessi:** ${access}`,
    `**Obiettivo del cliente:** ${o.objective || h.goal || "non scritto"}`,
    h.promises ? `**Promesse fatte in vendita (da rispettare):** ${h.promises}` : null,
    h.fears ? `**Paure del cliente:** ${h.fears}` : null,
    c.notes ? `**Note del CRM:** ${c.notes.slice(0, 1500)}` : null,
    `**Dati per le pagine legali:** ${c.name}${c.taxId ? ` · P.IVA/CF ${c.taxId}` : ""}${c.address ? ` · ${c.address}` : ""} (se mancano: segnaposto [DATI AZIENDA])`,
    `**Tetto crediti kie.ai:** ${test ? 0 : 400}`,
    "",
    "Segui la skill `flusso-consegna-dfy`. Gli aggiornamenti per i fondatori vanno in questo compito con le righe `# Fase: …` e `# Serve dal cliente: …`.",
    `_Aperto dal CRM VendiOra · cliente ${c.id}_`,
  ];
  return {
    title: `${test ? "[PROVA] " : ""}DFY ${pkg?.code ?? c.packageCode ?? ""} – ${c.name}`.replace(/\s+/g, " ").trim(),
    description: lines.filter((l) => l !== null).join("\n"),
  };
}

/** Apre il compito principale su Paperclip (una sola volta per cliente) */
export async function startDelivery(clientId: string, opts: { test?: boolean; by?: string } = {}): Promise<PaperclipDelivery> {
  if (!paperclipConfigured()) throw new Error("Paperclip non configurato sul CRM");
  const c = await getClient(clientId);
  if (!c) throw new Error("Cliente non trovato");
  if (c.ops.paperclip?.issueId) return c.ops.paperclip;
  const pkg = playbookPackage(c.packageCode);
  if (pkg?.line !== "dfy") throw new Error("Solo i pacchetti Done For You vanno a Paperclip");
  const test = !!opts.test;
  if (!test && !c.isPaid) throw new Error("Pagamento non ancora registrato");
  const { title, description } = deliveryBrief(c, test);
  const issue = await pc<{ id: string; identifier: string; status: string }>("POST", `/api/companies/${CO()}/issues`, {
    title, description, assigneeAgentId: PM(), ...(PROJECT() ? { projectId: PROJECT() } : {}), status: "todo", priority: "high",
  });
  const d: PaperclipDelivery = {
    issueId: issue.id, identifier: issue.identifier, status: issue.status, test, startedAt: new Date().toISOString(),
    startedBy: opts.by ?? null, phases: [], needs: [], lastSyncAt: null, error: null,
  };
  await patchClientOps(c.id, { paperclip: d });
  return d;
}

interface PcComment { id: string; body: string; createdAt: string; authorAgentId?: string | null }

/** Legge stato e commenti del compito e li salva sulla scheda del cliente */
export async function syncDelivery(clientId: string): Promise<PaperclipDelivery | null> {
  const c = await getClient(clientId);
  const d = c?.ops.paperclip;
  if (!c || !d?.issueId || !paperclipConfigured()) return d ?? null;
  try {
    const [issue, comments] = await Promise.all([
      pc<{ status: string; identifier: string }>("GET", `/api/issues/${d.issueId}`),
      pc<PcComment[] | { comments: PcComment[] }>("GET", `/api/issues/${d.issueId}/comments`),
    ]);
    const list = (Array.isArray(comments) ? comments : comments?.comments ?? []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const phases: PaperclipDelivery["phases"] = [];
    const needs: PaperclipDelivery["needs"] = [];
    for (const k of list) {
      for (const line of (k.body ?? "").split("\n")) {
        const m = line.match(/^#\s*Fase:\s*(.+)$/i);
        if (m) phases.push({ at: k.createdAt, label: m[1].trim().slice(0, 120) });
        const n = line.match(/^#\s*Serve dal cliente:\s*(.+)$/i);
        if (n) needs.push({ at: k.createdAt, text: n[1].trim().slice(0, 300) });
      }
    }
    const last = list.filter((k) => k.authorAgentId).at(-1);
    const next: PaperclipDelivery = {
      ...d, status: issue.status, identifier: issue.identifier ?? d.identifier, phases: phases.slice(-20), needs: needs.slice(-10),
      lastComment: last ? { at: last.createdAt, text: last.body.slice(0, 600) } : d.lastComment ?? null,
      lastSyncAt: new Date().toISOString(), error: null,
    };
    await patchClientOps(c.id, { paperclip: next });
    return next;
  } catch (e) {
    const next = { ...d, error: e instanceof Error ? e.message.slice(0, 200) : "errore", lastSyncAt: new Date().toISOString() };
    await patchClientOps(c.id, { paperclip: next }).catch(() => undefined);
    return next;
  }
}

/** Link al compito nella UI di Paperclip */
export const deliveryUrl = (d: Pick<PaperclipDelivery, "identifier">) =>
  URL_() && d.identifier ? `${URL_()}/${d.identifier.split("-")[0]}/issues/${d.identifier}` : null;
