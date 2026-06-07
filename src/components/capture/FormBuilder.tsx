"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { FormFieldEditor } from "@/components/capture/FormFieldEditor";
import { createFormField } from "@/lib/capture/defaults";
import {
  FORM_FIELD_TYPES, FORM_FIELD_LABELS,
} from "@/lib/capture/types";
import type { CrmForm, FormField, FormStyle, FormStatus } from "@/lib/capture/types";
import {
  ArrowLeft, Plus, GripVertical, Copy, Trash2, Save, Globe, Eye, ExternalLink, ClipboardCopy,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<FormStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-700",
  archived: "bg-amber-100 text-amber-700",
};
const STATUS_LABELS: Record<FormStatus, string> = {
  draft: "Bozza", active: "Attivo", archived: "Archiviato",
};
const DEFAULT_STYLE: FormStyle = { theme: "light", primaryColor: "#2563eb", borderRadius: 8, logoUrl: "", backgroundColor: "", buttonText: "Invia", fontFamily: "" };

const FONT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Predefinito" },
  { value: "Inter, system-ui, sans-serif", label: "Inter (sans)" },
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia (serif)" },
  { value: "'Courier New', monospace", label: "Monospace" },
  { value: "'Trebuchet MS', sans-serif", label: "Trebuchet" },
];

function parseFields(raw: string): FormField[] {
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? (p as FormField[]) : [];
  } catch { return []; }
}
function parseStyle(raw: string): FormStyle {
  try { return { ...DEFAULT_STYLE, ...(JSON.parse(raw) as Partial<FormStyle>) }; }
  catch { return DEFAULT_STYLE; }
}

function FieldPreview({ field }: { field: FormField }) {
  const box = "rounded-md border bg-muted/40";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{field.label}</span>
        {field.validation.required && <span className="text-red-500">*</span>}
        <span className="rounded border px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          {FORM_FIELD_LABELS[field.type]}
        </span>
      </div>
      {field.type === "textarea" ? (
        <div className={cn(box, "h-16 px-3 py-2 text-sm text-muted-foreground")}>{field.placeholder}</div>
      ) : field.type === "checkbox" ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-4 w-4 rounded border" /> {field.label}</div>
      ) : field.type === "radio" ? (
        <div className="space-y-1">
          {field.options.slice(0, 3).map((o, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-3 w-3 rounded-full border" /> {o}</div>
          ))}
        </div>
      ) : field.type === "select" ? (
        <div className={cn(box, "flex h-9 items-center px-3 text-sm text-muted-foreground")}>{field.placeholder || "Seleziona..."}</div>
      ) : (
        <div className={cn(box, "flex h-9 items-center px-3 text-sm text-muted-foreground")}>{field.placeholder}</div>
      )}
    </div>
  );
}

function SortableField({
  field, selected, onSelect, onDuplicate, onDelete,
}: {
  field: FormField;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn("group relative cursor-pointer rounded-lg border bg-card p-3", selected && "ring-2 ring-primary")}
    >
      <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md border bg-card text-muted-foreground active:cursor-grabbing" title="Trascina">
          <GripVertical className="h-4 w-4" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="flex h-7 w-7 items-center justify-center rounded-md border bg-card text-muted-foreground hover:text-foreground" title="Duplica">
          <Copy className="h-4 w-4" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="flex h-7 w-7 items-center justify-center rounded-md border bg-card text-muted-foreground hover:text-destructive" title="Elimina">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <FieldPreview field={field} />
    </div>
  );
}

export function FormBuilder({ form }: { form: CrmForm }) {
  const router = useRouter();
  const [fields, setFields] = useState<FormField[]>(() => parseFields(form.fields));
  const [style, setStyle] = useState<FormStyle>(() => parseStyle(form.style));
  const [name, setName] = useState(form.name);
  const [description, setDescription] = useState(form.description ?? "");
  const [successMessage, setSuccessMessage] = useState(form.successMessage);
  const [redirectUrl, setRedirectUrl] = useState(form.redirectUrl ?? "");
  const [status, setStatus] = useState<FormStatus>(form.status);
  const [selectedId, setSelectedId] = useState<string | null>(fields[0]?.id ?? null);
  const [tab, setTab] = useState<"field" | "settings" | "embed">("field");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const selected = fields.find((f) => f.id === selectedId) ?? null;
  const touch = () => setDirty(true);

  const addField = (type: (typeof FORM_FIELD_TYPES)[number]) => {
    const field = createFormField(type);
    setFields((prev) => [...prev, field]);
    setSelectedId(field.id);
    setTab("field");
    touch();
  };
  const updateField = (next: FormField) => {
    setFields((prev) => prev.map((f) => (f.id === next.id ? next : f)));
    touch();
  };
  const duplicateField = (id: string) => {
    const idx = fields.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const copy = { ...fields[idx], id: createFormField(fields[idx].type).id };
    const next = [...fields];
    next.splice(idx + 1, 0, copy);
    setFields(next);
    setSelectedId(copy.id);
    touch();
  };
  const deleteField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
    touch();
  };
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = fields.findIndex((f) => f.id === active.id);
    const newIdx = fields.findIndex((f) => f.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    setFields((prev) => arrayMove(prev, oldIdx, newIdx));
    touch();
  };

  const persist = async (nextStatus?: FormStatus) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/forms/${form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Senza nome",
          description,
          fields: JSON.stringify(fields),
          style: JSON.stringify(style),
          successMessage,
          redirectUrl,
          ...(nextStatus ? { status: nextStatus } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Errore");
      }
      if (nextStatus) setStatus(nextStatus);
      setDirty(false);
      toast.success(nextStatus === "active" ? "Form attivato" : nextStatus === "draft" ? "Form disattivato" : "Modifiche salvate");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copiato`)).catch(() => toast.error("Copia non riuscita"));
  };
  const embedSnippet = `<script src="${origin}/embed/form.js" data-form-id="${form.id}"></script>`;
  const directLink = `${origin}/form/${form.id}`;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => router.push("/forms")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold tracking-tight">{name || "Senza nome"}</h1>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[status])}>{STATUS_LABELS[status]}</span>
          </div>
          <p className="text-xs text-muted-foreground">{fields.length} campi</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="outline" size="sm" className="cursor-pointer">
              <Plus className="h-4 w-4 mr-1" /> Campo
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {FORM_FIELD_TYPES.map((t) => (
              <DropdownMenuItem key={t} onClick={() => addField(t)} className="cursor-pointer">
                {FORM_FIELD_LABELS[t]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {status === "active" && (
          <a href={`/form/${form.id}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="cursor-pointer">
              <ExternalLink className="h-4 w-4 mr-1" /> Apri
            </Button>
          </a>
        )}

        <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => persist()} disabled={saving || !dirty}>
          <Save className="h-4 w-4 mr-1" /> Salva
        </Button>

        {status === "active" ? (
          <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => persist("draft")} disabled={saving}>
            <Eye className="h-4 w-4 mr-1" /> Disattiva
          </Button>
        ) : (
          <Button size="sm" className="cursor-pointer" onClick={() => persist("active")} disabled={saving}>
            <Globe className="h-4 w-4 mr-1" /> Attiva
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Canvas */}
        <div className="min-w-0 flex-1">
          {fields.length === 0 ? (
            <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 text-center">
              <p className="text-sm text-muted-foreground">Nessun campo. Aggiungi il primo per iniziare.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.map((field) => (
                    <SortableField
                      key={field.id}
                      field={field}
                      selected={selectedId === field.id}
                      onSelect={() => { setSelectedId(field.id); setTab("field"); }}
                      onDuplicate={() => duplicateField(field.id)}
                      onDelete={() => deleteField(field.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Right panel */}
        <aside className="shrink-0 space-y-3 lg:w-80">
          <div className="flex gap-1 rounded-lg border p-1">
            {(["field", "settings", "embed"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                  tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {t === "field" ? "Campo" : t === "settings" ? "Impostazioni" : "Embed"}
              </button>
            ))}
          </div>

          <div className="rounded-lg border p-3">
            {tab === "field" && (
              selected ? (
                <FormFieldEditor field={selected} onChange={updateField} />
              ) : (
                <p className="text-xs text-muted-foreground">Seleziona un campo per modificarlo.</p>
              )
            )}

            {tab === "settings" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Nome</label>
                  <Input value={name} onChange={(e) => { setName(e.target.value); touch(); }} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Descrizione</label>
                  <Textarea value={description} rows={2} onChange={(e) => { setDescription(e.target.value); touch(); }} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Messaggio di successo</label>
                  <Textarea value={successMessage} rows={2} onChange={(e) => { setSuccessMessage(e.target.value); touch(); }} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">URL di reindirizzamento (opzionale)</label>
                  <Input value={redirectUrl} placeholder="https://..." onChange={(e) => { setRedirectUrl(e.target.value); touch(); }} />
                </div>
                <div className="h-px bg-border" />
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Tema</label>
                  <div className="flex gap-1">
                    {(["light", "dark"] as const).map((th) => (
                      <button
                        key={th}
                        onClick={() => { setStyle((s) => ({ ...s, theme: th })); touch(); }}
                        className={cn(
                          "flex-1 rounded-md border px-2 py-1 text-xs font-medium cursor-pointer",
                          style.theme === th ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {th === "light" ? "Chiaro" : "Scuro"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Colore primario</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={style.primaryColor} onChange={(e) => { setStyle((s) => ({ ...s, primaryColor: e.target.value })); touch(); }} className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5" />
                    <Input value={style.primaryColor} onChange={(e) => { setStyle((s) => ({ ...s, primaryColor: e.target.value })); touch(); }} className="h-8 font-mono text-xs" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Raggio bordi (px)</label>
                  <Input type="number" value={style.borderRadius} onChange={(e) => { setStyle((s) => ({ ...s, borderRadius: Number(e.target.value) || 0 })); touch(); }} />
                </div>
                <div className="h-px bg-border" />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Brand</p>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Logo (URL)</label>
                  <Input value={style.logoUrl ?? ""} placeholder="https://..." onChange={(e) => { setStyle((s) => ({ ...s, logoUrl: e.target.value })); touch(); }} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Colore sfondo</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={style.backgroundColor || "#ffffff"} onChange={(e) => { setStyle((s) => ({ ...s, backgroundColor: e.target.value })); touch(); }} className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5" />
                    <Input value={style.backgroundColor ?? ""} placeholder="(default tema)" onChange={(e) => { setStyle((s) => ({ ...s, backgroundColor: e.target.value })); touch(); }} className="h-8 font-mono text-xs" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Testo pulsante</label>
                  <Input value={style.buttonText ?? ""} placeholder="Invia" onChange={(e) => { setStyle((s) => ({ ...s, buttonText: e.target.value })); touch(); }} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Font</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={style.fontFamily ?? ""}
                    onChange={(e) => { setStyle((s) => ({ ...s, fontFamily: e.target.value })); touch(); }}
                  >
                    {FONT_OPTIONS.map((o) => <option key={o.label} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {tab === "embed" && (
              <div className="space-y-3">
                {status !== "active" && (
                  <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
                    Attiva il form per renderlo accessibile pubblicamente.
                  </p>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Codice di incorporamento</label>
                  <pre className="overflow-x-auto rounded-md bg-muted p-2 text-[11px] leading-relaxed">{embedSnippet}</pre>
                  <Button variant="outline" size="sm" className="w-full cursor-pointer" onClick={() => copy(embedSnippet, "Codice")}>
                    <ClipboardCopy className="h-4 w-4 mr-1" /> Copia codice
                  </Button>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Link diretto</label>
                  <pre className="overflow-x-auto rounded-md bg-muted p-2 text-[11px]">{directLink}</pre>
                  <Button variant="outline" size="sm" className="w-full cursor-pointer" onClick={() => copy(directLink, "Link")}>
                    <ClipboardCopy className="h-4 w-4 mr-1" /> Copia link
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Link href="/forms" className="block text-center text-xs text-muted-foreground hover:underline">
            Tutti i form
          </Link>
        </aside>
      </div>
    </div>
  );
}
