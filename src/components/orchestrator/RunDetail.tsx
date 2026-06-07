"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RunStatusBadge } from "./RunStatusBadge";
import { formatDate } from "@/lib/constants";
import type { OrchestratorRun, WorkflowEvent, AgentTask, ProjectArtifact } from "@/lib/orchestrator/types";
import { ArrowLeft, Bot, GitBranch, Package, Activity } from "lucide-react";

interface RunDetailProps {
  run: OrchestratorRun;
  events: WorkflowEvent[];
  tasks: AgentTask[];
  artifacts: ProjectArtifact[];
}

export function RunDetail({ run, events, tasks, artifacts }: RunDetailProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/orchestrator">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dettaglio Run</h1>
          <p className="text-sm text-muted-foreground">{run.id}</p>
        </div>
      </div>

      {/* Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Panoramica
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Stato</p>
            <RunStatusBadge status={run.status} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Intento</p>
            <p className="text-sm font-medium">{run.intent}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Workflow</p>
            <p className="text-sm font-medium">{run.workflow ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Sorgente</p>
            <p className="text-sm font-medium">{run.source}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Telefono mittente</p>
            <p className="text-sm font-medium">{run.senderPhone ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Ruolo</p>
            <p className="text-sm font-medium">{run.senderRole}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Step corrente</p>
            <p className="text-sm font-medium">{run.currentStep ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Data</p>
            <p className="text-sm font-medium">{formatDate(run.createdAt)}</p>
          </div>
          {run.finalUrl && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground mb-1">URL Finale</p>
              <a
                href={run.finalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 hover:underline break-all"
              >
                {run.finalUrl}
              </a>
            </div>
          )}
          {run.repoUrl && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Repository</p>
              <a
                href={run.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 hover:underline break-all"
              >
                {run.repoUrl}
              </a>
            </div>
          )}
          {run.error && (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-xs text-muted-foreground mb-1">Errore</p>
              <p className="text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 p-2 rounded border border-red-100 dark:border-red-800">
                {run.error}
              </p>
            </div>
          )}
          {run.resultSummary && (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-xs text-muted-foreground mb-1">Risultato</p>
              <p className="text-sm whitespace-pre-line bg-muted p-2 rounded">
                {run.resultSummary}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Eventi ({events.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun evento registrato.</p>
          ) : (
            <div className="space-y-3">
              {events.map((ev) => (
                <div key={ev.id} className="flex gap-3 items-start text-sm">
                  <Badge variant="outline" className="shrink-0 mt-0.5">
                    {ev.eventType}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{ev.message}</p>
                    {ev.metadata && (
                      <pre className="mt-1 text-xs text-muted-foreground bg-muted p-1.5 rounded overflow-x-auto">
                        {JSON.stringify(ev.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {formatDate(ev.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Agent Tasks ({tasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun task agente.</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="flex gap-3 items-start text-sm border rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{task.agentName}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {task.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{task.taskType}</span>
                    </div>
                    {task.input && (
                      <p className="text-xs text-muted-foreground truncate">{task.input}</p>
                    )}
                    {task.output && (
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">{task.output}</p>
                    )}
                    {task.error && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{task.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Artifacts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Artifacts ({artifacts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {artifacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun artifact.</p>
          ) : (
            <div className="space-y-2">
              {artifacts.map((art) => (
                <div key={art.id} className="flex items-center gap-3 text-sm border rounded-lg p-3">
                  <Badge variant="outline">{art.artifactType}</Badge>
                  <span className="font-medium flex-1">{art.name}</span>
                  {art.url && (
                    <a
                      href={art.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Apri
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
