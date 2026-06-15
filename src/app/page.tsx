import { listContacts, listDeals, getStages, listActivities } from "@/lib/db";
import { KPICards } from "@/components/dashboard/KPICards";
import { PipelineChart } from "@/components/dashboard/PipelineChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { NotificationBanner } from "@/components/dashboard/NotificationBanner";
import type { DashboardStats } from "@/types";
import { WHITE_LABEL } from "@/lib/white-label";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let allContacts: Awaited<ReturnType<typeof listContacts>> = [];
  let allDeals: Awaited<ReturnType<typeof listDeals>> = [];
  let stages: Awaited<ReturnType<typeof getStages>> = [];
  let recentActivities: Awaited<ReturnType<typeof listActivities>> = [];
  let error: string | null = null;

  try {
    [allContacts, allDeals, stages] = await Promise.all([
      listContacts(),
      listDeals(),
      getStages(),
    ]);
    recentActivities = await listActivities();
  } catch (e: any) {
    error = e.message || "Errore di connessione al database";
  }

  const activeDeals = allDeals.filter((d) => {
    const stage = stages.find((s) => s.id === d.stageId);
    return stage && !stage.isWon && !stage.isLost;
  });

  const wonDeals = allDeals.filter((d) => {
    const stage = stages.find((s) => s.id === d.stageId);
    return stage?.isWon;
  });

  const stats: DashboardStats = {
    totalContacts: allContacts.length,
    activeDeals: activeDeals.length,
    totalPipelineValue: activeDeals.reduce((sum, d) => sum + d.value, 0),
    wonDealsValue: wonDeals.reduce((sum, d) => sum + d.value, 0),
    conversionRate:
      allDeals.length > 0
        ? Math.round((wonDeals.length / allDeals.length) * 100)
        : 0,
    hotLeads: allContacts.filter((c) => c.temperature === "hot").length,
  };

  const pipelineData = stages
    .filter((s) => !s.isLost)
    .map((stage) => ({
      name: stage.name,
      count: allDeals.filter((d) => d.stageId === stage.id).length,
      value: allDeals
        .filter((d) => d.stageId === stage.id)
        .reduce((sum, d) => sum + d.value, 0),
      color: stage.color,
    }));

  const isFirstRun = allContacts.length === 0 && allDeals.length === 0;

  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="max-w-lg w-full space-y-6 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold">Errore di connessione</h1>
          <p className="text-muted-foreground">
            Il CRM non riesce a connettersi al database. Contatta l&apos;amministratore di sistema.
          </p>
          <p className="text-xs text-muted-foreground">
            Errore: {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Riepilogo del tuo pipeline di vendita
        </p>
      </div>

      {isFirstRun && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
          <h2 className="text-lg font-semibold mb-2">
            Benvenuto in {WHITE_LABEL.productName}
          </h2>
          <p className="text-sm text-muted-foreground">
            Il tuo CRM è pronto. Inizia aggiungendo i tuoi contatti e creando il primo deal.
          </p>
        </div>
      )}

      <NotificationBanner />

      <KPICards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PipelineChart data={pipelineData} />
        </div>
        <div>
          <RecentActivity
            activities={recentActivities.slice(0, 5).map((a) => ({
              id: a.id,
              type: a.type,
              description: a.description,
              contactName: a.contactName ?? null,
              createdAt: a.createdAt,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
