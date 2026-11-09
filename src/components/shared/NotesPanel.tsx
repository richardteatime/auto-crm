"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NotebookPen, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Large, central, edit-in-place notes box (Leo: "la sezione note grande, in mezzo").
 * Saves with PUT {field: text} to `endpoint`; Cmd/Ctrl+S saves too.
 */
export function NotesPanel({
  endpoint,
  initial,
  field = "notes",
  title = "Note",
  placeholder = "Scrivi qui tutto quello che serve ricordare…",
  className,
  minHeight = 220,
}: {
  endpoint: string;
  initial: string | null | undefined;
  field?: string;
  title?: string;
  placeholder?: string;
  className?: string;
  minHeight?: number;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial ?? "");
  const [value, setValue] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = value !== saved;

  useEffect(() => {
    setSaved(initial ?? "");
    setValue(initial ?? "");
  }, [initial]);

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value.trim() ? value : null }),
      });
      if (!res.ok) throw new Error();
      setSaved(value);
      toast.success("Note salvate");
      router.refresh();
    } catch {
      toast.error("Non sono riuscito a salvare le note, riprova");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={cn("rounded-xl border bg-card p-4 shadow-card md:p-5", className)}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <NotebookPen className="size-4" />
        </span>
        <h2 className="text-base font-semibold">{title}</h2>
        {dirty ? (
          <span className="text-xs text-amber-600 dark:text-amber-400">modifiche non salvate</span>
        ) : (
          saved && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="size-3" />
              salvate
            </span>
          )
        )}
        <Button size="sm" onClick={save} disabled={saving || !dirty} className="ml-auto gap-1.5">
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          Salva note
        </Button>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            save();
          }
        }}
        placeholder={placeholder}
        style={{ minHeight }}
        className="w-full resize-y rounded-lg border bg-background px-3.5 py-3 text-[15px] leading-relaxed outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
      />
    </section>
  );
}
