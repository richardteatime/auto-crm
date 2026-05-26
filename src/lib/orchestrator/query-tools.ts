import { listProjects } from "@/lib/db/projects";
import { listContacts } from "@/lib/db/contacts";
import { listRevenues } from "@/lib/db/revenues";
import { listDeals } from "@/lib/db/deals";
import { listTasks } from "@/lib/db/tasks";
import { listRuns } from "@/lib/orchestrator/runs";
import { formatCurrency } from "@/lib/constants";
import { SOURCE_LABELS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function isToday(date: Date | string | number | null | undefined): boolean {
  if (!date) return false;
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function getActiveProjects(): Promise<string> {
  const projects = await listProjects();
  const active = projects.filter((p) => p.status !== "consegnato");

  if (active.length === 0) {
    return "📌 Nessun progetto attivo al momento.";
  }

  const lines = active.map((p, i) => {
    const statusMap: Record<string, string> = {
      aperto: "Aperto",
      in_lavorazione: "In lavorazione",
      bloccato: "Bloccato",
      in_pausa: "In pausa",
      revisione_cto: "Revisione CTO",
      consegnato: "Consegnato",
    };
    return `${i + 1}. ${p.title}${p.description ? ` — ${p.description}` : ""}\n   Stato: ${statusMap[p.status] ?? p.status}`;
  });

  return `📌 Progetti attivi:\n\n${lines.join("\n\n")}`;
}

export async function getBlockedProjects(): Promise<string> {
  const projects = await listProjects();
  const blocked = projects.filter((p) => p.status === "bloccato");

  if (blocked.length === 0) {
    return "✅ Nessun progetto bloccato al momento.";
  }

  const lines = blocked.map((p, i) => `${i + 1}. ${p.title}`);
  return `⚠️ Progetti bloccati:\n\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Revenue
// ---------------------------------------------------------------------------

export async function getTodayRevenue(): Promise<string> {
  const revenues = await listRevenues();
  const todayRevenues = revenues.filter((r) => isToday(r.date));

  const deals = await listDeals();
  const todayWonDeals = deals.filter((d) => d.wonAt && isToday(d.wonAt));
  const pipelineDeals = deals.filter((d) => !d.wonAt);
  const pipelineValue = pipelineDeals.reduce((sum, d) => sum + d.value, 0);

  const lines: string[] = [];

  if (todayRevenues.length > 0) {
    const total = todayRevenues.reduce((sum, r) => sum + r.amount, 0);
    lines.push(`- Incassato registrato: ${formatCurrency(total)}`);
  }

  if (todayWonDeals.length > 0) {
    const total = todayWonDeals.reduce((sum, d) => sum + d.value, 0);
    lines.push(`- Deal vinti: ${todayWonDeals.length} (${formatCurrency(total)})`);
  }

  if (pipelineValue > 0) {
    lines.push(`- Pipeline aperta: ${formatCurrency(pipelineValue)}`);
  }

  if (lines.length === 0) {
    return "Dato non ancora disponibile: non ho trovato ricavi o deal vinti per oggi nel CRM.";
  }

  return `📊 Ricavi oggi:\n\n${lines.join("\n")}\n\nNota: considero solo i dati presenti nel CRM.`;
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export async function getLeadSummary(): Promise<string> {
  const contacts = await listContacts();

  if (contacts.length === 0) {
    return "Dato non ancora disponibile: non ho trovato contatti nel CRM.";
  }

  const byTemperature = {
    cold: contacts.filter((c) => c.temperature === "cold").length,
    warm: contacts.filter((c) => c.temperature === "warm").length,
    hot: contacts.filter((c) => c.temperature === "hot").length,
  };

  const bySource = contacts.reduce(
    (acc, c) => {
      const label = SOURCE_LABELS[c.source] ?? c.source;
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const lines = [
    `- Totale contatti: ${contacts.length}`,
    `- Freddi: ${byTemperature.cold}`,
    `- Tiepidi: ${byTemperature.warm}`,
    `- Caldi: ${byTemperature.hot}`,
  ];

  const sourceLines = Object.entries(bySource)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([source, count]) => `  ${source}: ${count}`);

  if (sourceLines.length > 0) {
    lines.push(`- Fonti principali:`);
    lines.push(...sourceLines);
  }

  return `👥 Lead summary:\n\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Agents / Automations
// ---------------------------------------------------------------------------

export async function getAgentStatus(): Promise<string> {
  const runs = await listRuns({ limit: 10 });

  if (runs.length === 0) {
    return "🤖 Nessuna automazione attiva al momento.";
  }

  const lines = runs.map((r, i) => {
    return `${i + 1}. ${r.intent} — ${r.status}\n   ${r.commandText.slice(0, 60)}${r.commandText.length > 60 ? "..." : ""}`;
  });

  return `🤖 Ultime automazioni:\n\n${lines.join("\n\n")}`;
}

// ---------------------------------------------------------------------------
// Deployments
// ---------------------------------------------------------------------------

export async function getDeploymentStatus(): Promise<string> {
  // Phase 8 will populate deployment_results; for now, check if any exist
  try {
    const { databases, DB_ID, COLLECTIONS } = await import("@/lib/appwrite");
    const { Query } = await import("@/lib/query17");
    const res = await databases.listDocuments(
      DB_ID,
      COLLECTIONS.deploymentResults,
      [Query.limit(1)],
    );
    if (res.total === 0) {
      return "🚀 Stato deploy:\n\nNessun deployment registrato al momento.";
    }
    return "🚀 Stato deploy:\n\n_(dettaglio deployment in arrivo — Phase 8)_";
  } catch {
    return "Dato non ancora disponibile: la collection deployment_results non è ancora configurata.";
  }
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function getMyTasksToday(): Promise<string> {
  const tasks = await listTasks();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const pending = tasks.filter((t) => !t.done);

  const overdue = pending.filter((t) => t.dueAt && new Date(t.dueAt) < todayStart);
  const today = pending.filter((t) => t.dueAt && new Date(t.dueAt) >= todayStart && new Date(t.dueAt) <= todayEnd);
  const upcoming = pending.filter((t) => t.dueAt && new Date(t.dueAt) > todayEnd);
  const noDue = pending.filter((t) => !t.dueAt);

  const lines: string[] = [];

  if (overdue.length > 0) {
    lines.push("⚠️ *SCADUTE:*");
    overdue.forEach((t, i) => {
      lines.push(`${i + 1}. ${t.title}${t.dueAt ? " (scaduta il " + new Date(t.dueAt).toLocaleDateString("it-IT") + ")" : ""}`);
    });
    lines.push("");
  }

  if (today.length > 0) {
    lines.push("📅 *OGGI:*");
    today.forEach((t, i) => {
      lines.push(`${i + 1}. ${t.title}`);
    });
    lines.push("");
  }

  if (upcoming.length > 0) {
    lines.push("🔮 *PROSSIME:*");
    upcoming.slice(0, 5).forEach((t, i) => {
      lines.push(`${i + 1}. ${t.title}${t.dueAt ? " (entro " + new Date(t.dueAt).toLocaleDateString("it-IT") + ")" : ""}`);
    });
    lines.push("");
  }

  if (noDue.length > 0) {
    lines.push("📝 *SENZA SCADENZA:*");
    noDue.slice(0, 3).forEach((t, i) => {
      lines.push(`${i + 1}. ${t.title}`);
    });
    lines.push("");
  }

  if (lines.length === 0) {
    return "✅ Non hai task in sospeso. Tutto fatto!";
  }

  return lines.join("\n").trim();
}
