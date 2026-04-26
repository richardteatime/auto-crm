import { NextRequest } from "next/server";
import { listContacts } from "@/lib/db/contacts";
import { listDeals } from "@/lib/db/deals";
import { listActivities } from "@/lib/db/activities";
import { listQuotes } from "@/lib/db/quotes";
import { listTasks } from "@/lib/db/tasks";
import { listExpenses } from "@/lib/db/expenses";
import { getStages } from "@/lib/db/pipeline";
import { formatDate, formatCurrency, SOURCE_LABELS } from "@/lib/constants";
import type { LeadSource } from "@/types";

export const dynamic = "force-dynamic";

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n"))
    return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function buildCSV(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n");
}

function getTs(val: Date | number | null | undefined): number {
  if (!val) return 0;
  if (val instanceof Date) return val.getTime();
  const n = val as number;
  return n < 1e12 ? n * 1000 : n;
}

function parsePeriod(from: string | null, to: string | null) {
  return {
    fromMs: from ? new Date(from + "T00:00:00").getTime() : 0,
    maxMs: to ? new Date(to + "T23:59:59.999").getTime() : Infinity,
  };
}

function inRange(ts: number, fromMs: number, maxMs: number) {
  return ts >= fromMs && ts <= maxMs;
}

function calcQuoteTotal(itemsJson: string, vatRate: number): number {
  try {
    const items = JSON.parse(itemsJson) as { quantity: number; unitPrice: number }[];
    const sub = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    return sub + Math.round((sub * vatRate) / 100);
  } catch {
    return 0;
  }
}

function csvResponse(csv: string, filename: string) {
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "contacts";
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const { fromMs, maxMs } = parsePeriod(fromParam, toParam);
  const today = new Date().toISOString().split("T")[0];
  const suffix = fromParam && toParam ? `_${fromParam}_${toParam}` : `_${today}`;

  /* ── CONTACTS ──────────────────────────────────────────── */
  if (type === "contacts") {
    const rows = (await listContacts())
      .filter((c) => inRange(getTs(c.createdAt), fromMs, maxMs));

    const csv = buildCSV(
      ["Nome", "Email", "Telefono", "Azienda", "Fonte", "Temperatura", "Score", "Note", "Data creazione"],
      rows.map((c) => [
        c.name, c.email || "", c.phone || "", c.company || "",
        SOURCE_LABELS[c.source as LeadSource] || c.source,
        c.temperature === "hot" ? "Caldo" : c.temperature === "warm" ? "Tiepido" : "Freddo",
        String(c.score), c.notes || "", formatDate(c.createdAt),
      ])
    );
    return csvResponse(csv, `contatti${suffix}.csv`);
  }

  /* ── DEALS ─────────────────────────────────────────────── */
  if (type === "deals") {
    const [allDeals, stages] = await Promise.all([listDeals(), getStages()]);

    const rows = allDeals
      .filter((d) => inRange(getTs(d.createdAt), fromMs, maxMs));

    const csv = buildCSV(
      ["Titolo", "Contatto", "Valore", "Tipo", "Durata (mesi)", "Fase", "Probabilità", "Data vittoria", "Chiusura stimata", "Note", "Data creazione"],
      rows.map((d) => {
        const stage = stages.find((s) => s.id === d.stageId);
        return [
          d.title, d.contactName || d.contact?.name || "", formatCurrency(d.value),
          d.isRecurring ? "Ricorrente" : "Una Tantum",
          d.recurringMonths ? String(d.recurringMonths) : "",
          stage?.name || "", `${d.probability}%`,
          formatDate(d.wonAt as Date | null),
          formatDate(d.expectedClose), d.notes || "", formatDate(d.createdAt),
        ];
      })
    );
    return csvResponse(csv, `trattative${suffix}.csv`);
  }

  /* ── ACTIVITIES ─────────────────────────────────────────── */
  if (type === "activities") {
    const TYPE_LABEL: Record<string, string> = {
      call: "Chiamata", email: "Email", meeting: "Riunione",
      note: "Nota", follow_up: "Follow-up",
    };
    const rows = (await listActivities())
      .filter((a) => inRange(getTs(a.createdAt), fromMs, maxMs));

    const csv = buildCSV(
      ["Tipo", "Descrizione", "Contatto", "Stato", "Data inizio", "Data fine", "Programmata", "Completata", "Note", "Data creazione"],
      rows.map((a) => [
        TYPE_LABEL[a.type] || a.type, a.description, a.contactName || "",
        a.completedAt
          ? "Completata"
          : a.scheduledAt && getTs(a.scheduledAt as Date | number) < Date.now()
            ? "Scaduta"
            : "Aperta",
        formatDate(null),
        formatDate(null),
        formatDate(a.scheduledAt as Date | null),
        formatDate(a.completedAt as Date | null),
        "", formatDate(a.createdAt),
      ])
    );
    return csvResponse(csv, `attivita${suffix}.csv`);
  }

  /* ── QUOTES / PREVENTIVI ────────────────────────────────── */
  if (type === "quotes") {
    const STATUS_LABEL: Record<string, string> = {
      bozza: "Bozza", inviato: "Inviato", accettato: "Accettato", rifiutato: "Rifiutato",
    };

    const [allQuotes, allDeals] = await Promise.all([listQuotes(), listDeals()]);

    const rows = allQuotes
      .filter((q) => inRange(getTs(q.createdAt), fromMs, maxMs));

    const csv = buildCSV(
      ["Numero", "Titolo", "Cliente", "Azienda", "Trattativa", "Stato", "Totale (IVA incl.)", "IVA %", "Valido fino", "Note", "Data creazione"],
      rows.map((q) => {
        const deal = allDeals.find((d) => d.id === q.dealId);
        const contactName = deal?.contactName || deal?.contact?.name || "";
        const contactCompany = deal?.contact?.company || "";
        return [
          q.number, q.title, contactName, contactCompany,
          deal?.title || "", STATUS_LABEL[q.status] || q.status,
          formatCurrency(calcQuoteTotal(q.items, q.vatRate)), `${q.vatRate}%`,
          formatDate(q.validUntil as Date | null), q.notes || "", formatDate(q.createdAt),
        ];
      })
    );
    return csvResponse(csv, `preventivi${suffix}.csv`);
  }

  /* ── TASKS ──────────────────────────────────────────────── */
  if (type === "tasks") {
    const rows = (await listTasks())
      .filter((t) => inRange(getTs(t.createdAt), fromMs, maxMs));

    const csv = buildCSV(
      ["Titolo", "Descrizione", "Assegnato a", "Creato da", "Stato", "Scadenza", "Data creazione"],
      rows.map((t) => [
        t.title, t.description || "", t.assignedTo, t.createdBy,
        t.done ? "Completato" : "Da fare",
        formatDate(t.dueAt as Date | null), formatDate(t.createdAt),
      ])
    );
    return csvResponse(csv, `task${suffix}.csv`);
  }

  /* ── FINANCE REPORT ─────────────────────────────────────── */
  if (type === "finance") {
    const [allDeals, allExpenses] = await Promise.all([listDeals(), listExpenses()]);

    const expRows = allExpenses
      .filter((e) => inRange(getTs(e.date), fromMs, maxMs));
    const totalExpenses = expRows.reduce((s, e) => s + e.amount, 0);

    let revenue = 0;
    let mrr = 0;
    const now = Date.now();
    const effectiveMax = maxMs === Infinity ? now : maxMs;
    const wonInPeriod: { title: string; contactName: string | null; value: number; wonAt: Date | number | null }[] = [];

    for (const d of allDeals) {
      const startMs =
        getTs(d.recurringStartDate as Date | number | null) ||
        getTs(d.wonAt as Date | number | null) ||
        getTs(d.createdAt);
      if (!startMs) continue;

      if (d.isRecurring && d.recurringMonths) {
        const endMs = startMs + d.recurringMonths * 30 * 86400000;
        if (endMs > fromMs && startMs < effectiveMax) {
          const months =
            Math.max(0, Math.min(endMs, effectiveMax) - Math.max(startMs, fromMs)) /
            (30 * 86400000);
          revenue += Math.round(d.value * months);
          if (startMs <= now && endMs >= now) mrr += d.value;
        }
      } else {
        const wonTs = getTs(d.wonAt as Date | number | null);
        if (!wonTs || !inRange(wonTs, fromMs, effectiveMax)) continue;
        revenue += d.value;
        wonInPeriod.push({
          title: d.title,
          contactName: d.contactName || d.contact?.name || null,
          value: d.value,
          wonAt: d.wonAt as Date | number | null,
        });
      }
    }

    const fromLabel = fromParam || "—";
    const toLabel = toParam || "—";
    const TYPE_LABEL_EXP: Record<string, string> = {
      spesa: "Spesa", investimento: "Investimento", stipendio: "Stipendio",
    };

    const lines: string[][] = [
      ["REPORT FINANZIARIO"],
      ["Periodo", `${fromLabel} → ${toLabel}`],
      [],
      ["RIEPILOGO"],
      ["Fatturato Periodo", formatCurrency(revenue)],
      ["MRR Attivo", formatCurrency(mrr)],
      ["Spese Totali", formatCurrency(totalExpenses)],
      ["Cash Flow Netto", formatCurrency(revenue - totalExpenses)],
      [],
      ["DETTAGLIO SPESE"],
      ["Data", "Tipo", "Categoria", "Descrizione", "Importo", "Inserito da"],
      ...expRows.map((e) => [
        formatDate(e.date),
        TYPE_LABEL_EXP[e.type] || e.type,
        e.category, e.description,
        formatCurrency(e.amount), e.createdBy,
      ]),
      [],
      ["TRATTATIVE VINTE (una tantum) NEL PERIODO"],
      ["Titolo", "Contatto", "Valore", "Data vittoria"],
      ...wonInPeriod.map((d) => [
        d.title, d.contactName || "",
        formatCurrency(d.value),
        formatDate(d.wonAt as Date | null),
      ]),
    ];

    const csv = lines.map((r) => r.map(escapeCSV).join(",")).join("\n");
    return csvResponse(csv, `report-finanziario${suffix}.csv`);
  }

  return new Response("Tipo non valido. Usare ?type=contacts|deals|activities|quotes|tasks|finance", {
    status: 400,
  });
}
