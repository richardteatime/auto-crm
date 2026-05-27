"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Plus, Trash2, Pencil, CheckSquare, X } from "lucide-react";
import { formatDate } from "@/lib/constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "todo" | "done">("all");
  const [search, setSearch] = useState("");

  // Create inline
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");

  // Edit dialog
  const [editing, setEditing] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDue, setEditDue] = useState("");

  // Delete dialog
  const [deleting, setDeleting] = useState<Task | null>(null);

  const loadTasks = () => {
    fetch("/api/tasks")
      .then((res) => res.json())
      .then((data) => { setTasks(data); setLoading(false); });
  };

  useEffect(() => { loadTasks(); }, []);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === "todo" && t.done) return false;
      if (filter === "done" && !t.done) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !(t.description || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [tasks, filter, search]);

  const counts = useMemo(() => ({
    all: tasks.length,
    todo: tasks.filter((t) => !t.done).length,
    done: tasks.filter((t) => t.done).length,
  }), [tasks]);

  const toggleDone = async (task: Task) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !task.done }),
      });
      if (!res.ok) throw new Error();
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, done: !t.done } : t));
      toast.success(task.done ? "Task ripristinata" : "Task completata");
    } catch {
      toast.error("Errore durante l'aggiornamento");
    }
  };

  const createTask = async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), dueAt: newDue || null }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setTasks((prev) => [created, ...prev]);
      setNewTitle("");
      setNewDue("");
      toast.success("Task creata");
    } catch {
      toast.error("Errore durante la creazione");
    }
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setEditTitle(task.title);
    setEditDue(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const res = await fetch(`/api/tasks/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), dueAt: editDue || null }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
      setEditing(null);
      toast.success("Task aggiornata");
    } catch {
      toast.error("Errore durante l'aggiornamento");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/tasks/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setTasks((prev) => prev.filter((t) => t.id !== deleting.id));
      toast.success("Task eliminata");
    } catch {
      toast.error("Errore durante l'eliminazione");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Task</h1>
          <p className="text-muted-foreground">Cose da fare e follow-up</p>
        </div>
      </div>

      {/* Quick create */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Nuova task</label>
          <Input
            placeholder="Cosa devi fare..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createTask(); }}
          />
        </div>
        <div className="w-40 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Scadenza</label>
          <Input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
        </div>
        <Button onClick={createTask} className="cursor-pointer" disabled={!newTitle.trim()}>
          <Plus className="h-4 w-4 mr-1" />
          Aggiungi
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1">
          {(["all", "todo", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer",
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {f === "all" ? `Tutte (${counts.all})` : f === "todo" ? `Da fare (${counts.todo})` : `Completate (${counts.done})`}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Input
            placeholder="Cerca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="Nessuna task"
          description="Crea la tua prima task per iniziare a organizzare il lavoro."
          actionLabel="Crea task"
          onAction={() => { setNewTitle("Nuova task"); }}
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Titolo</TableHead>
                <TableHead className="hidden md:table-cell">Scadenza</TableHead>
                <TableHead className="hidden md:table-cell">Creata</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">
                    Nessuna task corrisponde ai filtri.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((task) => (
                  <TableRow key={task.id} className={cn(task.done && "opacity-50")}>
                    <TableCell>
                      <Checkbox
                        checked={task.done}
                        onCheckedChange={() => toggleDone(task)}
                        className="cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className={cn("font-medium", task.done && "line-through text-muted-foreground")}>
                      {task.title}
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {task.dueAt ? formatDate(task.dueAt) : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {formatDate(task.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8" onClick={() => openEdit(task)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleting(task)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Modifica task</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Titolo</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Scadenza</label>
              <Input type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="cursor-pointer" onClick={() => setEditing(null)}>Annulla</Button>
              <Button className="cursor-pointer" onClick={saveEdit} disabled={!editTitle.trim()}>Salva</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Eliminare la task?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Stai per eliminare <strong>{deleting?.title}</strong>. Questa azione è irreversibile.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="cursor-pointer" onClick={() => setDeleting(null)}>Annulla</Button>
            <Button variant="destructive" className="cursor-pointer" onClick={confirmDelete}>Elimina</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
