import { toMs } from "@/lib/utils";
import { DAY_MS, formatLongDay, romeHour, startOfRomeDay, startOfRomeMonth } from "@/lib/dates";
import type { ActivityWithContact } from "@/lib/db/activities";
import type { CalendarEvent, Contact, DealWithContact, PipelineStage, Project } from "@/types";

const DAY = DAY_MS;
const STALE_AFTER_DAYS = 14;

// Everything below is plain data (numbers/strings) so it can cross into client components.

export interface FocusItem {
  id: string;
  type: string;
  description: string;
  contactId: string | null;
  contactName: string | null;
  dueMs: number;
  overdue: boolean;
}

export interface AgendaItem {
  id: string;
  title: string;
  type: string;
  startMs: number;
  endMs: number;
  allDay: boolean;
  location: string | null;
  color: string | null;
}

export interface DealRow {
  id: string;
  title: string;
  value: number;
  probability: number;
  contactName: string | null;
  stageName: string | null;
  stageColor: string | null;
  billingType: string | null;
  dateMs: number;
}

export interface StageBar {
  id: string;
  name: string;
  color: string;
  count: number;
  value: number;
  isWon: boolean;
}

export interface Kpi {
  value: number;
  previous: number | null;
  series: number[];
}

export interface DashboardData {
  greeting: string;
  dateLabel: string;
  focus: FocusItem[];
  overdueCount: number;
  todayCount: number;
  agenda: AgendaItem[];
  eventsToday: number;
  kpis: {
    openValue: Kpi & { count: number; weighted: number };
    wonThisMonth: Kpi & { count: number };
    winRate: Kpi & { won: number; closed: number };
    newContacts: Kpi & { hot: number };
  };
  stages: StageBar[];
  lostCount: number;
  closingSoon: DealRow[];
  stale: DealRow[];
  recent: Array<{
    id: string;
    type: string;
    description: string;
    contactName: string | null;
    contactId: string | null;
    atMs: number;
    completed: boolean;
  }>;
  projects: { active: number; blocked: number; dueSoon: Array<{ id: string; title: string; dueMs: number; status: string }> };
  isEmpty: boolean;
}

export function greetingFor(date: Date): string {
  const h = romeHour(date.getTime());
  if (h < 5) return "Buonanotte";
  if (h < 13) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function startOfMonth(d: Date, offset = 0) {
  return startOfRomeMonth(d.getTime(), offset);
}

export function buildDashboard(input: {
  now: Date;
  contacts: Contact[];
  deals: DealWithContact[];
  stages: PipelineStage[];
  activities: ActivityWithContact[];
  events: CalendarEvent[];
  projects: Project[];
  /** Current user: focus shows their activities plus unassigned ones */
  userId?: string | null;
}): DashboardData {
  const { now, contacts, deals, stages, activities, events, projects } = input;
  const nowMs = now.getTime();
  const todayStart = startOfRomeDay(nowMs);
  const todayEnd = todayStart + DAY;

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const isOpen = (d: DealWithContact) => {
    const s = stageById.get(d.stageId);
    return !s || (!s.isWon && !s.isLost);
  };
  const isWon = (d: DealWithContact) => stageById.get(d.stageId)?.isWon === true;
  const isLost = (d: DealWithContact) => stageById.get(d.stageId)?.isLost === true;
  const contactName = new Map(contacts.map((c) => [c.id, c.name]));

  const toRow = (d: DealWithContact, dateMs: number): DealRow => {
    const s = stageById.get(d.stageId);
    return {
      id: d.id,
      title: d.title,
      value: d.value ?? 0,
      probability: d.probability ?? 0,
      contactName: d.contactName ?? contactName.get(d.contactId) ?? null,
      stageName: s?.name ?? null,
      stageColor: s?.color ?? null,
      billingType: d.billingType ?? null,
      dateMs,
    };
  };

  // --- Focus: open activities due today or earlier, mine or unassigned ------
  const open = activities.filter(
    (a) =>
      !a.completedAt &&
      !(a as { isCompleted?: boolean }).isCompleted &&
      (!input.userId || !a.assignedTo || a.assignedTo === input.userId)
  );
  const withDue = open
    .map((a) => ({ a, dueMs: toMs(a.startAt ?? a.scheduledAt) }))
    .filter((x) => x.dueMs > 0 && x.dueMs < todayEnd)
    .sort((x, y) => x.dueMs - y.dueMs);
  const overdueCount = withDue.filter((x) => x.dueMs < todayStart).length;
  const focus: FocusItem[] = withDue.slice(0, 8).map(({ a, dueMs }) => ({
    id: a.id,
    type: a.type,
    description: a.description,
    contactId: a.contactId ?? null,
    contactName: a.contactName ?? contactName.get(a.contactId) ?? null,
    dueMs,
    overdue: dueMs < todayStart,
  }));

  // --- Agenda: calendar events from now to 7 days ahead -------------------
  const agenda: AgendaItem[] = events
    .map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      startMs: toMs(e.startAt),
      endMs: toMs(e.endAt),
      allDay: !!e.allDay,
      location: e.location ?? null,
      color: e.color ?? null,
    }))
    .filter((e) => e.endMs >= nowMs - 60 * 60 * 1000 && e.startMs < todayStart + 7 * DAY)
    .sort((a, b) => a.startMs - b.startMs)
    .slice(0, 6);
  const eventsToday = events.filter((e) => {
    const s = toMs(e.startAt);
    return s >= todayStart && s < todayEnd;
  }).length;

  // --- KPIs -----------------------------------------------------------------
  const openDeals = deals.filter(isOpen);
  const openValue = openDeals.reduce((s, d) => s + (d.value ?? 0), 0);
  const weighted = openDeals.reduce((s, d) => s + ((d.value ?? 0) * (d.probability ?? 0)) / 100, 0);

  const wonAtMs = (d: DealWithContact) => toMs(d.wonAt ?? null) || toMs(d.updatedAt);
  const monthStarts = Array.from({ length: 7 }, (_, i) => startOfMonth(now, i - 5)); // 6 months + next boundary
  const wonByMonth = monthStarts.slice(0, 6).map((start, i) =>
    deals
      .filter(isWon)
      .filter((d) => {
        const ms = wonAtMs(d);
        return ms >= start && ms < monthStarts[i + 1];
      })
      .reduce((s, d) => s + (d.value ?? 0), 0)
  );
  const thisMonthStart = startOfMonth(now);
  const wonThisMonthDeals = deals.filter(isWon).filter((d) => wonAtMs(d) >= thisMonthStart);

  const won = deals.filter(isWon).length;
  const lost = deals.filter(isLost).length;
  const closed = won + lost;
  const winRateSeries = monthStarts.slice(0, 6).map((start, i) => {
    const inMonth = deals.filter((d) => {
      if (!isWon(d) && !isLost(d)) return false;
      const ms = toMs(d.updatedAt);
      return ms >= start && ms < monthStarts[i + 1];
    });
    const w = inMonth.filter(isWon).length;
    return inMonth.length ? Math.round((w / inMonth.length) * 100) : 0;
  });

  const weekStarts = Array.from({ length: 9 }, (_, i) => todayStart - (8 - i) * 7 * DAY + DAY);
  const contactsPerWeek = weekStarts.slice(0, 8).map((start, i) =>
    contacts.filter((c) => {
      const ms = toMs(c.createdAt);
      return ms >= start && ms < weekStarts[i + 1];
    }).length
  );
  const newThisMonth = contacts.filter((c) => toMs(c.createdAt) >= thisMonthStart).length;
  const newLastMonth = contacts.filter((c) => {
    const ms = toMs(c.createdAt);
    return ms >= startOfMonth(now, -1) && ms < thisMonthStart;
  }).length;

  // Pipeline value trend: open value of deals created up to each week
  const openSeries = weekStarts.slice(1).map((end) =>
    openDeals.filter((d) => toMs(d.createdAt) < end).reduce((s, d) => s + (d.value ?? 0), 0)
  );

  // --- Pipeline by stage ----------------------------------------------------
  const stageBars: StageBar[] = stages
    .filter((s) => !s.isLost)
    .map((s) => {
      const inStage = deals.filter((d) => d.stageId === s.id);
      return {
        id: s.id,
        name: s.name,
        color: s.color,
        count: inStage.length,
        value: inStage.reduce((sum, d) => sum + (d.value ?? 0), 0),
        isWon: s.isWon,
      };
    });

  // --- Deals needing attention ---------------------------------------------
  const closingSoon = openDeals
    .map((d) => ({ d, ms: toMs(d.expectedClose) }))
    .filter((x) => x.ms > 0 && x.ms < todayStart + 30 * DAY)
    .sort((a, b) => a.ms - b.ms)
    .slice(0, 5)
    .map(({ d, ms }) => toRow(d, ms));

  const stale = openDeals
    .map((d) => ({ d, ms: toMs(d.updatedAt) }))
    .filter((x) => x.ms > 0 && nowMs - x.ms > STALE_AFTER_DAYS * DAY)
    .sort((a, b) => a.ms - b.ms)
    .slice(0, 5)
    .map(({ d, ms }) => toRow(d, ms));

  // --- Recent activity ------------------------------------------------------
  const recent = [...activities]
    .sort((a, b) => toMs(b.completedAt ?? b.createdAt) - toMs(a.completedAt ?? a.createdAt))
    .slice(0, 6)
    .map((a) => ({
      id: a.id,
      type: a.type,
      description: a.description,
      contactName: a.contactName ?? contactName.get(a.contactId) ?? null,
      contactId: a.contactId ?? null,
      atMs: toMs(a.completedAt ?? a.createdAt),
      completed: !!a.completedAt,
    }));

  // --- Projects -------------------------------------------------------------
  const activeProjects = projects.filter((p) => p.status !== "consegnato");
  const projectsDueSoon = activeProjects
    .map((p) => ({ id: p.id, title: p.title, status: p.status, dueMs: toMs(p.dueDate) }))
    .filter((p) => p.dueMs > 0 && p.dueMs < todayStart + 10 * DAY)
    .sort((a, b) => a.dueMs - b.dueMs)
    .slice(0, 4);

  return {
    greeting: greetingFor(now),
    dateLabel: formatLongDay(nowMs),
    focus,
    overdueCount,
    todayCount: withDue.length - overdueCount,
    agenda,
    eventsToday,
    kpis: {
      openValue: { value: openValue, previous: null, series: openSeries, count: openDeals.length, weighted: Math.round(weighted) },
      wonThisMonth: {
        value: wonByMonth[5],
        previous: wonByMonth[4],
        series: wonByMonth,
        count: wonThisMonthDeals.length,
      },
      winRate: { value: closed ? Math.round((won / closed) * 100) : 0, previous: null, series: winRateSeries, won, closed },
      newContacts: {
        value: newThisMonth,
        previous: newLastMonth,
        series: contactsPerWeek,
        hot: contacts.filter((c) => c.temperature === "hot").length,
      },
    },
    stages: stageBars,
    lostCount: lost,
    closingSoon,
    stale,
    recent,
    projects: {
      active: activeProjects.length,
      blocked: activeProjects.filter((p) => p.status === "bloccato").length,
      dueSoon: projectsDueSoon,
    },
    isEmpty: contacts.length === 0 && deals.length === 0,
  };
}
