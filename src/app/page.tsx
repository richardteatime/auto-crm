import { listContacts, listDeals, getStages, listActivities } from "@/lib/db";
import { KPICards } from "@/components/dashboard/KPICards";
import { PipelineChart } from "@/components/dashboard/PipelineChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { NotificationBanner } from "@/components/dashboard/NotificationBanner";
import type { DashboardStats } from "@/types";
import { WHITE_LABEL } from "@/lib/white-label";
import { AlertTriangle, Wrench } from "lucide-react";

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
          <h1 className="text-2xl font-bold">Database non inizializzato</h1>
          <p className="text-muted-foreground">
            Il CRM non trova le collezioni su Appwrite. È necessario eseguire il setup una volta.
          </p>
          <div className="rounded-lg border bg-muted/50 p-4 text-left text-sm space-y-3">
            <div className="flex items-start gap-2">
              <Wrench className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Soluzione rapida</p>
                <p className="text-muted-foreground mt-1">
                  Dal tuo terminale locale, con le stesse variabili d&apos;ambiente del deploy:
                </p>
                <pre className="mt-2 p-3 rounded bg-black text-white text-xs font-mono overflow-x-auto">
                  npm run setup
                </pre>
                <p className="text-muted-foreground mt-2">
                  Oppure entra nel container su Coolify e lancia:
                </p>
                <pre className="mt-2 p-3 rounded bg-black text-white text-xs font-mono overflow-x-auto">
                  npx tsx scripts/setup-appwrite.ts
                </pre>
              </div>
            </div>
          </div>
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
          <p className="text-sm text-muted-foreground mb-4">
            Il tuo CRM è pronto. Ecco come iniziare:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-card border">
              <p className="font-medium">1. Personalizza il tuo CRM</p>
              <p className="text-xs text-muted-foreground mt-1">
                Esegui <code className="bg-muted px-1 rounded">/setup</code> in Claude Code
              </p>
            </div>
            <div className="p-3 rounded-lg bg-card border">
              <p className="font-medium">2. Aggiungi contatti</p>
              <p className="text-xs text-muted-foreground mt-1">
                Vai su Contatti o usa <code className="bg-muted px-1 rounded">/add-lead</code>
              </p>
            </div>
            <div className="p-3 rounded-lg bg-card border">
              <p className="font-medium">3. Carica dati demo</p>
              <p className="text-xs text-muted-foreground mt-1">
                Esegui <code className="bg-muted px-1 rounded">npm run seed</code> nel terminale
              </p>
            </div>
          </div>
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
