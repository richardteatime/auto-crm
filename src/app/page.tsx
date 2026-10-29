import type { Metadata } from "next";
import Link from "next/link";
import {
  ListChecks,
  CalendarDays,
  SquareKanban,
  CalendarClock,
  Hourglass,
  Activity,
  FolderKanban,
  CalendarCheck,
  Coffee,
  Inbox,
  CircleCheck,
} from "lucide-react";
import {
  listContacts,
  listDeals,
  getStages,
  listActivities,
  listCalendarEvents,
  listProjects,
} from "@/lib/db";
import { getServerUser } from "@/lib/auth-server";
import { buildDashboard } from "@/lib/dashboard";
import { firstNameOf } from "@/lib/names";
import { DAY_MS, dayLabel, startOfRomeDay } from "@/lib/dates";
import { TodayHero } from "@/components/dashboard/TodayHero";
import { KPICards } from "@/components/dashboard/KPICards";
import { FocusList } from "@/components/dashboard/FocusList";
import { AgendaList } from "@/components/dashboard/AgendaList";
import { PipelineChart } from "@/components/dashboard/PipelineChart";
import { ClosingSoonList, StaleDealsList } from "@/components/dashboard/DealWatchlist";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { DashboardCard, CardEmpty } from "@/components/dashboard/DashboardCard";
import { FirstRun } from "@/components/dashboard/FirstRun";
import { PROJECT_STATUS_CONFIG } from "@/components/timeline/projectConstants";
import type { ProjectStatus } from "@/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Oggi" };

export default async function DashboardPage() {
  const now = new Date();
  const nowMs = now.getTime();
  const dayStart = startOfRomeDay(nowMs);

  const [user, contacts, deals, stages, activities, events, projects] = await Promise.all([
    getServerUser(),
    listContacts(),
    listDeals(),
    getStages(),
    listActivities(),
    listCalendarEvents({
      startAfter: new Date(dayStart - DAY_MS),
      endBefore: new Date(dayStart + 8 * DAY_MS),
    }).catch(() => []),
    listProjects().catch(() => []),
  ]);

  // A colleague's private event shows up only as busy time
  const visibleEvents = events.map((e) =>
    e.isPrivate && e.createdBy !== user?.id && !(e.assignedTo ?? []).includes(user?.id ?? "")
      ? { ...e, title: "Impegno privato", location: null, description: null }
      : e
  );

  const data = buildDashboard({
    now,
    contacts,
    deals,
    stages,
    activities,
    events: visibleEvents,
    projects,
    userId: user?.id ?? null,
  });

  if (data.isEmpty) return <FirstRun name={firstNameOf(user?.name)} />;

  return (
    <div className="space-y-5">
      <TodayHero
        greeting={data.greeting}
        firstName={firstNameOf(user?.name)}
        dateLabel={data.dateLabel}
        overdue={data.overdueCount}
        today={data.todayCount}
        events={data.eventsToday}
        hot={data.kpis.newContacts.hot}
      />

      <KPICards kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <DashboardCard
          title="Il tuo focus"
          icon={ListChecks}
          action={{ href: "/activities", label: "Tutte le attività" }}
          className="lg:col-span-2"
          delay={280}
        >
          <FocusList items={data.focus} nowMs={nowMs} />
        </DashboardCard>

        <DashboardCard title="Agenda" icon={CalendarDays} action={{ href: "/calendar", label: "Calendario" }} delay={320}>
          {data.agenda.length > 0 ? (
            <AgendaList items={data.agenda} nowMs={nowMs} />
          ) : (
            <CardEmpty icon={Coffee} title="Agenda libera" hint="Nessun evento nei prossimi 7 giorni." />
          )}
        </DashboardCard>

        <DashboardCard
          title="Pipeline"
          icon={SquareKanban}
          action={{ href: "/pipeline", label: "Apri la pipeline" }}
          className="lg:col-span-2"
          delay={360}
        >
          {data.stages.some((s) => s.count > 0) ? (
            <PipelineChart stages={data.stages} lostCount={data.lostCount} />
          ) : (
            <CardEmpty icon={Inbox} title="Nessuna trattativa" hint="Crea la prima trattativa dal pulsante Nuovo." />
          )}
        </DashboardCard>

        <DashboardCard title="In chiusura" icon={CalendarClock} action={{ href: "/deals", label: "Trattative" }} delay={400}>
          {data.closingSoon.length > 0 ? (
            <ClosingSoonList deals={data.closingSoon} nowMs={nowMs} />
          ) : (
            <CardEmpty icon={CalendarCheck} title="Niente in scadenza" hint="Nessuna trattativa con chiusura prevista nei prossimi 30 giorni." />
          )}
        </DashboardCard>

        <DashboardCard title="Da risvegliare" icon={Hourglass} delay={440}>
          {data.stale.length > 0 ? (
            <>
              <p className="-mt-1 mb-2 text-xs text-muted-foreground">Trattative aperte senza aggiornamenti da oltre 2 settimane.</p>
              <StaleDealsList deals={data.stale} nowMs={nowMs} />
            </>
          ) : (
            <CardEmpty icon={CircleCheck} title="Tutto in movimento" hint="Ogni trattativa aperta è stata aggiornata di recente." />
          )}
        </DashboardCard>

        <DashboardCard title="Ultime attività" icon={Activity} action={{ href: "/activities", label: "Storico" }} delay={480}>
          {data.recent.length > 0 ? (
            <RecentActivity items={data.recent} nowMs={nowMs} />
          ) : (
            <CardEmpty icon={Activity} title="Ancora nessuna attività" />
          )}
        </DashboardCard>

        <DashboardCard title="Progetti" icon={FolderKanban} action={{ href: "/timeline", label: "Tutti i progetti" }} delay={520}>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="text-2xl font-bold tabular-nums">{data.projects.active}</p>
              <p className="text-xs text-muted-foreground">in corso</p>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <p className={`text-2xl font-bold tabular-nums ${data.projects.blocked > 0 ? "text-rose-600 dark:text-rose-400" : ""}`}>
                {data.projects.blocked}
              </p>
              <p className="text-xs text-muted-foreground">bloccati</p>
            </div>
          </div>
          {data.projects.dueSoon.length > 0 ? (
            <ul className="space-y-1">
              {data.projects.dueSoon.map((p) => {
                const cfg = PROJECT_STATUS_CONFIG[p.status as ProjectStatus];
                return (
                  <li key={p.id}>
                    <Link
                      href={`/timeline/${p.id}`}
                      className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm transition-colors hover:bg-muted/50"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{cfg?.label ?? p.status}</span>
                      <span className={`shrink-0 text-xs font-medium tabular-nums ${p.dueMs < nowMs ? "text-rose-600 dark:text-rose-400" : ""}`}>
                        {dayLabel(p.dueMs, nowMs)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Nessuna consegna nei prossimi 10 giorni.</p>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}
