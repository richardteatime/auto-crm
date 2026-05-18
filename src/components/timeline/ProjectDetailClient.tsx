"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectForm } from "./ProjectForm";
import { StatusChangeDialog } from "./StatusChangeDialog";
import { PROJECT_STATUS_CONFIG, PROJECT_PRIORITY_CONFIG } from "./projectConstants";
import {
  ArrowLeft, Pencil, Trash2, RefreshCw, CalendarDays,
  User, Users, Flag, FileText, Clock, CheckCircle2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { Project, ProjectLog, ProjectStatus } from "@/types";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(d: Date | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_ICON: Record<ProjectStatus, typeof Clock> = {
  aperto: FileText,
  in_lavorazione: RefreshCw,
  bloccato: AlertCircle,
  in_pausa: Clock,
  revisione_cto: CheckCircle2,
  consegnato: CheckCircle2,
};

interface ProjectDetailClientProps {
  project: Project;
  logs: ProjectLog[];
}

export function ProjectDetailClient({ project, logs }: ProjectDetailClientProps) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});

  // Mark notification as read when viewing project detail
  useEffect(() => {
    if (project?.id) {
      fetch("/api/notifications/read-by-related", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relatedId: project.id, relatedType: "project" }),
      }).catch(() => {});
    }
  }, [project?.id]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((users: Array<{ id: string; name: string; email: string }>) => {
        const map: Record<string, string> = {};
        for (const u of users) map[u.id] = u.name || u.email;
        setUsersMap(map);
      })
      .catch(() => {});
  }, []);

  const statusCfg = PROJECT_STATUS_CONFIG[project.status];
  const priorityCfg = PROJECT_PRIORITY_CONFIG[project.priority];
  const isOverdue = project.dueDate && project.status !== "consegnato"
    && new Date(project.dueDate) < new Date();

  const handleDelete = async () => {
    if (!confirm("Eliminare il progetto? L'azione non può essere annullata.")) return;
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Progetto eliminato");
      router.push("/timeline");
    } catch {
      toast.error("Errore durante l'eliminazione");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/timeline")} className="cursor-pointer mt-0.5">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{project.title}</h1>
            <Badge variant="outline" className={`${statusCfg.color} ${statusCfg.border}`}>
              {statusCfg.label}
            </Badge>
            <span className={`text-sm font-medium flex items-center gap-1 ${priorityCfg.color}`}>
              <Flag className="h-3.5 w-3.5" />
              {priorityCfg.label}
            </span>
          </div>
          {project.description && (
            <p className="text-muted-foreground mt-1">{project.description}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStatus(true)}
            className="cursor-pointer"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Aggiorna stato
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEdit(true)}
            className="cursor-pointer"
          >
            <Pencil className="h-4 w-4 mr-1" />
            Modifica
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="cursor-pointer text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dettagli</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {project.assignedTo.length > 0 && (
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  {project.assignedTo.map((uid) => (
                    <span
                      key={uid}
                      className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2 py-0.5"
                    >
                      <User className="h-3 w-3 text-muted-foreground" />
                      {usersMap[uid] ?? uid}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>
                Inizio: <strong>{formatDate(project.startDate)}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className={isOverdue ? "text-red-500 font-medium" : ""}>
                Scadenza: <strong>{formatDate(project.dueDate)}</strong>
                {isOverdue && " ⚠ Scaduto"}
              </span>
            </div>
            {project.deliveredAt && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Consegnato: <strong>{formatDate(project.deliveredAt)}</strong></span>
              </div>
            )}
            <div className="pt-2 border-t text-xs text-muted-foreground">
              Creato il {formatDate(project.createdAt)}
            </div>
            {project.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-1">Note</p>
                <p className="text-sm whitespace-pre-wrap">{project.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status flow */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fasi del progetto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(["aperto", "in_lavorazione", "bloccato", "in_pausa", "revisione_cto", "consegnato"] as ProjectStatus[]).map((s) => {
                const cfg = PROJECT_STATUS_CONFIG[s];
                const isCurrent = project.status === s;
                const Icon = STATUS_ICON[s];
                return (
                  <div key={s} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${isCurrent ? `${cfg.bg} ${cfg.border} border` : "text-muted-foreground"}`}>
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${isCurrent ? cfg.color : ""}`} />
                    <span className={isCurrent ? `font-semibold ${cfg.color}` : ""}>{cfg.label}</span>
                    {isCurrent && <span className="ml-auto text-xs">← attuale</span>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Log history */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Storico ({logs.length})</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowStatus(true)}
                className="cursor-pointer text-xs"
              >
                + Aggiorna
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna modifica registrata.</p>
            ) : (
              <div className="space-y-4">
                {logs.map((log) => {
                  const toCfg = PROJECT_STATUS_CONFIG[log.toStatus as ProjectStatus];
                  return (
                    <div key={log.id} className="flex gap-3">
                      <div className={`rounded-full w-2 h-2 mt-1.5 shrink-0 ${toCfg?.bg ?? "bg-gray-200"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {log.fromStatus && (
                            <>
                              <span className="text-xs text-muted-foreground">
                                {PROJECT_STATUS_CONFIG[log.fromStatus as ProjectStatus]?.label ?? log.fromStatus}
                              </span>
                              <span className="text-xs text-muted-foreground">→</span>
                            </>
                          )}
                          <span className={`text-xs font-semibold ${toCfg?.color ?? ""}`}>
                            {toCfg?.label ?? log.toStatus}
                          </span>
                        </div>
                        <p className="text-xs mt-0.5 text-foreground/80 whitespace-pre-wrap">{log.notes}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDateTime(log.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ProjectForm
        open={showEdit}
        onClose={() => { setShowEdit(false); router.refresh(); }}
        initialData={project}
      />
      <StatusChangeDialog
        open={showStatus}
        onClose={() => { setShowStatus(false); router.refresh(); }}
        projectId={project.id}
        currentStatus={project.status}
        currentAssignedTo={project.assignedTo}
      />
    </div>
  );
}
