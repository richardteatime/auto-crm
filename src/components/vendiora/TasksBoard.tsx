"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TASK_ROLES, TASK_ROLE_LABELS, type TaskRole, type VdTask } from "@/lib/vendiora/types";
import { api, Field, inputCls } from "./ui";
import { TaskItem } from "./PlaybookClientPanel";

/** Team tasks of the playbook grouped by role (commerciale, CSM, coach, PM, admin, CEO) */
export function TasksBoard() {
  const [tasks, setTasks] = useState<VdTask[] | null>(null);
  const [role, setRole] = useState<TaskRole | "tutti">("tutti");
  const [show, setShow] = useState<"aperto" | "fatto">("aperto");
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ title: "", role: "admin" as TaskRole, dueAt: "" });
  useEffect(() => { api<{ tasks: VdTask[] }>(`/api/vendiora/tasks?status=${show}`).then((r) => setTasks(r.tasks)).catch((e) => toast.error(e.message)); }, [show]);
  const list = useMemo(() => (tasks ?? []).filter((t) => role === "tutti" || t.role === role), [tasks, role]);
  const [now] = useState(() => Date.now());
  const late = list.filter((t) => t.status === "aperto" && t.dueAt && Date.parse(t.dueAt) < now).length;

  async function done(t: VdTask) {
    try { await api(`/api/vendiora/tasks/${t.id}`, { method: "PUT", json: { status: t.status === "fatto" ? "aperto" : "fatto" } }); setTasks((x) => x?.filter((y) => y.id !== t.id) ?? null); } catch (e) { toast.error((e as Error).message); }
  }
  async function add() {
    try {
      const r = await api<{ task: VdTask }>("/api/vendiora/tasks", { json: { ...f, dueAt: f.dueAt ? new Date(f.dueAt + "T18:00").toISOString() : null } });
      setTasks((x) => [r.task, ...(x ?? [])]); setAdding(false); setF({ title: "", role: f.role, dueAt: "" });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-5 pb-10">
      <PageHeader title="Da fare" description={tasks ? `${list.length} ${show === "aperto" ? "aperti" : "fatti"}${late ? ` · ${late} in ritardo` : ""}. Li crea il playbook (chiamate, vocali, escalation, controlli) e li assegna al ruolo giusto.` : ""}
        actions={<Button onClick={() => setAdding((v) => !v)}><Plus /> Nuovo</Button>} />
      {adding && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
          <Field label="Cosa fare" className="min-w-[260px] flex-1"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus /></Field>
          <Field label="Ruolo"><select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as TaskRole })}>{TASK_ROLES.map((r) => <option key={r} value={r}>{TASK_ROLE_LABELS[r]}</option>)}</select></Field>
          <Field label="Entro"><input type="date" className={inputCls} value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} /></Field>
          <Button onClick={add} disabled={f.title.trim().length < 3}>Aggiungi</Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {(["tutti", ...TASK_ROLES] as const).map((r) => (
          <button key={r} type="button" onClick={() => setRole(r)} className={cn("rounded-full border px-3 py-1 text-[12.5px] font-medium", role === r ? "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300" : "hover:bg-accent")}>
            {r === "tutti" ? "Tutti" : TASK_ROLE_LABELS[r]} <span className="text-muted-foreground tabular-nums">{(tasks ?? []).filter((t) => r === "tutti" || t.role === r).length}</span>
          </button>
        ))}
        <span className="ml-auto" />
        <select className={inputCls + " h-8 w-auto"} value={show} onChange={(e) => { setTasks(null); setShow(e.target.value as "aperto" | "fatto"); }}><option value="aperto">Aperti</option><option value="fatto">Fatti</option></select>
      </div>
      {!tasks ? <Skeleton className="h-64 rounded-xl" /> : list.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Niente da fare qui.</p>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">{list.map((t) => <TaskItem key={t.id} t={t} onDone={() => done(t)} showWho />)}</ul>
      )}
    </div>
  );
}
