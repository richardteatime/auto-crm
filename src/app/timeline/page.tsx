"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProjectForm } from "@/components/timeline/ProjectForm";
import { PROJECT_STATUS_CONFIG, PROJECT_STATUS_OPTIONS, PROJECT_PRIORITY_CONFIG } from "@/components/timeline/projectConstants";
import {
  Plus, Search, CalendarDays, Users, User, ArrowRight, Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/types";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

export default function TimelinePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | "">("");
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});

  const load = () => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => { setProjects(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetch("/api/users")
      .then((r) => r.json())
      .then((users: Array<{ id: string; name: string; email: string }>) => {
        const map: Record<string, string> = {};
        for (const u of users) map[u.id] = u.name || u.email;
        setUsersMap(map);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => projects.filter((p) => {
    if (filterStatus && p.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.title.toLowerCase().includes(q) ||
        p.assignedTo.some((uid) => (usersMap[uid] ?? uid).toLowerCase().includes(q)) ||
        p.description?.toLowerCase().includes(q);
    }
    return true;
  }), [projects, filterStatus, search, usersMap]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { "": projects.length };
    for (const p of projects) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [projects]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Timeline Progetti</h1>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Timeline Progetti</h1>
          <p className="text-muted-foreground">Traccia lo stato di avanzamento dei tuoi progetti tecnici</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />
          Nuovo Progetto
        </Button>
      </div>

      <ProjectForm
        open={showForm}
        onClose={() => { setShowForm(false); load(); }}
      />

      {/* Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca progetto, responsabile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterStatus("")}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer",
              filterStatus === "" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Tutti ({counts[""] ?? 0})
          </button>
          {PROJECT_STATUS_OPTIONS.map((s) => {
            const cfg = PROJECT_STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer",
                  filterStatus === s
                    ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {cfg.label} ({counts[s] ?? 0})
              </button>
            );
          })}
        </div>
      </div>

      {/* Project list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {projects.length === 0
            ? "Nessun progetto. Crea il primo cliccando \"Nuovo Progetto\"."
            : "Nessun progetto corrisponde ai filtri."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((project) => {
            const statusCfg = PROJECT_STATUS_CONFIG[project.status];
            const priorityCfg = PROJECT_PRIORITY_CONFIG[project.priority];
            const isOverdue = project.dueDate && project.status !== "consegnato"
              && new Date(project.dueDate) < new Date();
            return (
              <Card
                key={project.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/timeline/${project.id}`)}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-start gap-4">
                    <div className={`mt-0.5 rounded-full w-3 h-3 shrink-0 ${statusCfg.bg} ${statusCfg.border} border-2`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{project.title}</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${statusCfg.color} ${statusCfg.border}`}
                        >
                          {statusCfg.label}
                        </Badge>
                        <span className={`text-xs font-medium flex items-center gap-0.5 ${priorityCfg.color}`}>
                          <Flag className="h-3 w-3" />
                          {priorityCfg.label}
                        </span>
                      </div>

                      {project.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{project.description}</p>
                      )}

                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {project.assignedTo.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {project.assignedTo.map((uid) => usersMap[uid] ?? uid).join(", ")}
                          </span>
                        )}
                        {project.startDate && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="h-3 w-3" />
                            {formatDate(project.startDate)}
                            {project.dueDate && (
                              <>
                                <ArrowRight className="h-3 w-3" />
                                <span className={isOverdue ? "text-red-500 font-medium" : ""}>
                                  {formatDate(project.dueDate)}
                                  {isOverdue && " ⚠"}
                                </span>
                              </>
                            )}
                          </span>
                        )}
                        {!project.startDate && project.dueDate && (
                          <span className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                            <CalendarDays className="h-3 w-3" />
                            Scadenza: {formatDate(project.dueDate)}
                            {isOverdue && " ⚠"}
                          </span>
                        )}
                      </div>
                    </div>

                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
