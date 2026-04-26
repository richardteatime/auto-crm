"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  User,
  ClipboardList,
  Calendar,
  Search,
  X,
} from "lucide-react";
import { ReportDialog } from "@/components/shared/ReportDialog";
import { formatDate } from "@/lib/constants";
import { toast } from "sonner";

const AUTHOR_KEY = "crm-display-name";

interface Task {
  id: string;
  title: string;
  description: string | null;
  assignedTo: string;
  createdBy: string;
  done: boolean;
  dueAt: number | Date | null;
  createdAt: number | Date;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "mine" | "todo" | "done">("all");
  const [search, setSearch] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterDue, setFilterDue] = useState<"" | "overdue" | "today" | "week">("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    dueAt: "",
  });

  useEffect(() => {
    const saved = localStorage.getItem(AUTHOR_KEY);
    if (saved) setCurrentUser(saved);
  }, []);

  const saveName = () => {
    const name = nameInput.trim();
    if (!name) return;
    localStorage.setItem(AUTHOR_KEY, name);
    setCurrentUser(name);
    setNameInput("");
  };

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const data: Task[] = await res.json();
      setTasks(data);
    } catch {
      toast.error("Errore nel caricamento dei task");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) loadTasks();
  }, [currentUser, loadTasks]);

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.assignedTo.trim()) return;

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          assignedTo: form.assignedTo,
          createdBy: currentUser,
          dueAt: form.dueAt || null,
        }),
      });
      if (!res.ok) throw new Error();
      const task: Task = await res.json();
      setTasks((prev) => [task, ...prev]);
      setForm({ title: "", description: "", assignedTo: "", dueAt: "" });
      setOpen(false);
      toast.success("Task creato");
    } catch {
      toast.error("Errore nella creazione del task");
    }
  };

  const toggleDone = async (task: Task) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !task.done }),
      });
      if (!res.ok) throw new Error();
      const updated: Task = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch {
      toast.error("Errore nell'aggiornamento");
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast.success("Task eliminato");
    } catch {
      toast.error("Errore nell'eliminazione");
    }
  };

  const filtered = tasks.filter((t) => {
    if (filter === "mine" && !(t.assignedTo === currentUser || t.createdBy === currentUser)) return false;
    if (filter === "todo" && t.done) return false;
    if (filter === "done" && !t.done) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) &&
          !t.description?.toLowerCase().includes(q) &&
          !t.assignedTo.toLowerCase().includes(q)) return false;
    }
    if (filterAssignee && !t.assignedTo.toLowerCase().includes(filterAssignee.toLowerCase())) return false;
    if (filterDue === "overdue") {
      if (!t.dueAt || t.done) return false;
      const d = typeof t.dueAt === "number" ? (t.dueAt < 1e12 ? t.dueAt * 1000 : t.dueAt) : (t.dueAt as Date).getTime();
      if (d >= Date.now()) return false;
    }
    if (filterDue === "today") {
      if (!t.dueAt || t.done) return false;
      const d = new Date(typeof t.dueAt === "number" ? (t.dueAt < 1e12 ? t.dueAt * 1000 : t.dueAt) : (t.dueAt as Date).getTime());
      const now = new Date();
      if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth() || d.getDate() !== now.getDate()) return false;
    }
    if (filterDue === "week") {
      if (!t.dueAt || t.done) return false;
      const d = typeof t.dueAt === "number" ? (t.dueAt < 1e12 ? t.dueAt * 1000 : t.dueAt) : (t.dueAt as Date).getTime();
      if (d > Date.now() + 7 * 86400000) return false;
    }
    return true;
  });

  const isFiltered = !!(search || filterAssignee || filterDue);
  const resetTaskFilters = () => { setSearch(""); setFilterAssignee(""); setFilterDue(""); };

  const counts = {
    all: tasks.length,
    mine: tasks.filter((t) => t.assignedTo === currentUser || t.createdBy === currentUser).length,
    todo: tasks.filter((t) => !t.done).length,
    done: tasks.filter((t) => t.done).length,
  };

  // Name setup screen (shared with chat)
  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5" />
              Come ti chiami?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Scegli un nome per identificarti nei task del team.
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); saveName(); }}
              className="flex gap-2"
            >
              <Input
                autoFocus
                placeholder="Es: Marco Rossi"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
              <Button type="submit" disabled={!nameInput.trim()} className="cursor-pointer">
                Entra
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Task del Team</h1>
          <p className="text-muted-foreground">Assegna e monitora le attività con i colleghi</p>
        </div>
        <div className="flex items-center gap-3">
          <ReportDialog section="tasks" />
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{currentUser}</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs cursor-pointer h-7 px-2"
              onClick={() => { localStorage.removeItem(AUTHOR_KEY); setCurrentUser(""); }}
            >
              Cambia
            </Button>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button className="cursor-pointer gap-2" />}>
              <Plus className="h-4 w-4" />
              Nuovo Task
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Crea nuovo task</DialogTitle>
              </DialogHeader>
              <form onSubmit={createTask} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Titolo *</Label>
                  <Input
                    id="title"
                    placeholder="Descrizione breve del task"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Note / Descrizione</Label>
                  <Textarea
                    id="description"
                    placeholder="Dettagli, istruzioni, link..."
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="assignedTo">Assegna a *</Label>
                  <Input
                    id="assignedTo"
                    placeholder="Nome del collega"
                    value={form.assignedTo}
                    onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dueAt">Scadenza (opzionale)</Label>
                  <Input
                    id="dueAt"
                    type="date"
                    value={form.dueAt}
                    onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => setOpen(false)}
                  >
                    Annulla
                  </Button>
                  <Button
                    type="submit"
                    disabled={!form.title.trim() || !form.assignedTo.trim()}
                    className="cursor-pointer"
                  >
                    Crea
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search + filters */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per titolo, note, assegnatario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {isFiltered && (
            <Button variant="ghost" size="sm" onClick={resetTaskFilters} className="cursor-pointer gap-1 shrink-0">
              <X className="h-3.5 w-3.5" />
              Azzera
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Scadenza:</span>
            {([["", "Tutte"], ["overdue", "Scaduti"], ["today", "Oggi"], ["week", "Questa settimana"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setFilterDue(v)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                  filterDue === v
                    ? v === "overdue" ? "bg-red-500 text-white border-red-500" : "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Assegnato a:</span>
            <Input
              placeholder="Filtra per persona..."
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="h-7 w-36 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "mine", "todo", "done"] as const).map((f) => {
          const labels = { all: "Tutti", mine: "Miei", todo: "Da fare", done: "Completati" };
          return (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              className="cursor-pointer gap-1.5"
              onClick={() => setFilter(f)}
            >
              {labels[f]}
              <Badge
                variant={filter === f ? "secondary" : "outline"}
                className="h-4 min-w-4 px-1 text-xs"
              >
                {counts[f]}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nessun task trovato</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crea il primo task con il pulsante in alto
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => {
            const isOverdue =
              task.dueAt && !task.done && new Date(task.dueAt) < new Date();
            const isAssignedToMe = task.assignedTo === currentUser;

            return (
              <Card
                key={task.id}
                className={`transition-opacity ${task.done ? "opacity-60" : ""}`}
              >
                <CardContent className="p-4 flex gap-3">
                  <button
                    onClick={() => toggleDone(task)}
                    className="mt-0.5 shrink-0 cursor-pointer text-muted-foreground hover:text-primary transition-colors"
                    aria-label={task.done ? "Segna come da fare" : "Segna come fatto"}
                  >
                    {task.done ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`font-medium text-sm leading-snug ${
                          task.done ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {task.title}
                      </p>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="shrink-0 cursor-pointer text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Elimina task"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge
                        variant={isAssignedToMe ? "default" : "secondary"}
                        className="text-xs gap-1"
                      >
                        <User className="h-3 w-3" />
                        {task.assignedTo}
                      </Badge>

                      <span className="text-xs text-muted-foreground">
                        da {task.createdBy}
                      </span>

                      {task.dueAt && (
                        <span
                          className={`flex items-center gap-1 text-xs ${
                            isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
                          }`}
                        >
                          <Calendar className="h-3 w-3" />
                          {isOverdue ? "Scaduto · " : ""}
                          {formatDate(task.dueAt)}
                        </span>
                      )}

                      {task.done && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                          Completato
                        </Badge>
                      )}
                    </div>
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
