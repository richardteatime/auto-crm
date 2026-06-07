"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { LandingBlockForm } from "@/components/capture/LandingBlockForm";
import { LandingBlockPreview } from "@/components/capture/LandingBlockPreview";
import { createBlock } from "@/lib/capture/defaults";
import { slugify } from "@/lib/capture/slug";
import {
  BLOCK_TYPES,
  BLOCK_LABELS,
  ASSET_STATUS_LABELS,
} from "@/lib/capture/types";
import type {
  LandingBlock,
  LandingConfig,
  LandingPage,
  AssetStatus,
} from "@/lib/capture/types";
import {
  ArrowLeft, Plus, GripVertical, Copy, Trash2, Save, Globe, ExternalLink, Eye,
  Monitor, Tablet, Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<AssetStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-green-100 text-green-700",
  archived: "bg-amber-100 text-amber-700",
};

function parseConfig(raw: string): LandingConfig {
  try {
    const p = JSON.parse(raw) as Partial<LandingConfig>;
    return {
      blocks: Array.isArray(p.blocks) ? (p.blocks as LandingBlock[]) : [],
      theme: {
        primaryColor: p.theme?.primaryColor ?? "#2563eb",
        fontFamily: p.theme?.fontFamily ?? "Inter, sans-serif",
        maxWidth: p.theme?.maxWidth ?? 1100,
      },
    };
  } catch {
    return { blocks: [], theme: { primaryColor: "#2563eb", fontFamily: "Inter, sans-serif", maxWidth: 1100 } };
  }
}

function SortableBlock({
  block, primaryColor, selected, onSelect, onDuplicate, onDelete,
}: {
  block: LandingBlock;
  primaryColor: string;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn("group relative cursor-pointer border-b last:border-b-0", selected && "ring-2 ring-inset ring-primary")}
    >
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md border bg-card/90 text-muted-foreground shadow-sm active:cursor-grabbing"
          title="Trascina"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          className="flex h-7 w-7 items-center justify-center rounded-md border bg-card/90 text-muted-foreground shadow-sm hover:text-foreground"
          title="Duplica"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex h-7 w-7 items-center justify-center rounded-md border bg-white/90 text-gray-600 shadow-sm hover:text-destructive"
          title="Elimina"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="pointer-events-none">
        <LandingBlockPreview block={block} primaryColor={primaryColor} />
      </div>
    </div>
  );
}

export function LandingPageEditor({ page }: { page: LandingPage }) {
  const router = useRouter();
  const [config, setConfig] = useState<LandingConfig>(() => parseConfig(page.config));
  const [name, setName] = useState(page.name);
  const [slug, setSlug] = useState(page.slug);
  const [status, setStatus] = useState<AssetStatus>(page.status);
  const [metaTitle, setMetaTitle] = useState(page.metaTitle);
  const [metaDescription, setMetaDescription] = useState(page.metaDescription);
  const [faviconUrl, setFaviconUrl] = useState(page.faviconUrl ?? "");
  const [ogImageUrl, setOgImageUrl] = useState(page.ogImageUrl ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(config.blocks[0]?.id ?? null);
  const [tab, setTab] = useState<"block" | "page">("page");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const selected = config.blocks.find((b) => b.id === selectedId) ?? null;

  const mutate = (next: Partial<LandingConfig>) => {
    setConfig((prev) => ({ ...prev, ...next }));
    setDirty(true);
  };

  const addBlock = (type: (typeof BLOCK_TYPES)[number]) => {
    const block = createBlock(type);
    mutate({ blocks: [...config.blocks, block] });
    setSelectedId(block.id);
    setTab("block");
  };

  const updateBlock = (next: LandingBlock) => {
    mutate({ blocks: config.blocks.map((b) => (b.id === next.id ? next : b)) });
  };

  const duplicateBlock = (id: string) => {
    const idx = config.blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const copy = { ...config.blocks[idx], id: createBlock(config.blocks[idx].type).id };
    const blocks = [...config.blocks];
    blocks.splice(idx + 1, 0, copy);
    mutate({ blocks });
    setSelectedId(copy.id);
  };

  const deleteBlock = (id: string) => {
    mutate({ blocks: config.blocks.filter((b) => b.id !== id) });
    if (selectedId === id) setSelectedId(null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = config.blocks.findIndex((b) => b.id === active.id);
    const newIdx = config.blocks.findIndex((b) => b.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    mutate({ blocks: arrayMove(config.blocks, oldIdx, newIdx) });
  };

  const persist = async (nextStatus?: AssetStatus) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/landing-pages/${page.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Senza nome",
          slug,
          config: JSON.stringify(config),
          metaTitle,
          metaDescription,
          faviconUrl,
          ogImageUrl,
          ...(nextStatus ? { status: nextStatus } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Errore");
      }
      const updated: LandingPage = await res.json();
      setSlug(updated.slug);
      if (nextStatus) setStatus(nextStatus);
      setDirty(false);
      toast.success(nextStatus === "published" ? "Landing page pubblicata" : nextStatus === "draft" ? "Ripristinata in bozza" : "Modifiche salvate");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => router.push("/landing-pages")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold tracking-tight">{name || "Senza nome"}</h1>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[status])}>
              {ASSET_STATUS_LABELS[status]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">/l/{slug}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="cursor-pointer" />}>
            <Plus className="h-4 w-4 mr-1" /> Blocco
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {BLOCK_TYPES.map((t) => (
              <DropdownMenuItem key={t} onClick={() => addBlock(t)} className="cursor-pointer">
                {BLOCK_LABELS[t]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {status === "published" && (
          <a href={`/l/${slug}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="cursor-pointer">
              <ExternalLink className="h-4 w-4 mr-1" /> Apri
            </Button>
          </a>
        )}

        <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => persist()} disabled={saving || !dirty}>
          <Save className="h-4 w-4 mr-1" /> Salva
        </Button>

        {status === "published" ? (
          <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => persist("draft")} disabled={saving}>
            <Eye className="h-4 w-4 mr-1" /> Bozza
          </Button>
        ) : (
          <Button size="sm" className="cursor-pointer" onClick={() => persist("published")} disabled={saving}>
            <Globe className="h-4 w-4 mr-1" /> Pubblica
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Canvas */}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex justify-center gap-1">
            {([
              ["desktop", Monitor, "Desktop"],
              ["tablet", Tablet, "Tablet"],
              ["mobile", Smartphone, "Mobile"],
            ] as const).map(([value, Icon, label]) => (
              <Button
                key={value}
                type="button"
                variant={device === value ? "default" : "outline"}
                size="icon"
                className="h-8 w-8 cursor-pointer"
                onClick={() => setDevice(value)}
                title={`Preview ${label}`}
              >
                <Icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
          {config.blocks.length === 0 ? (
            <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 text-center">
              <p className="text-sm text-muted-foreground">Nessun blocco. Aggiungi il primo per iniziare.</p>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button size="sm" className="cursor-pointer" />}>
                  <Plus className="h-4 w-4 mr-1" /> Aggiungi blocco
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-44">
                  {BLOCK_TYPES.map((t) => (
                    <DropdownMenuItem key={t} onClick={() => addBlock(t)} className="cursor-pointer">
                      {BLOCK_LABELS[t]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div
              className={cn(
                "@container mx-auto overflow-hidden rounded-lg border bg-card transition-[max-width]",
                device === "tablet" && "max-w-[768px]",
                device === "mobile" && "max-w-[390px]",
              )}
            >
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={config.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  {config.blocks.map((block) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      primaryColor={config.theme.primaryColor}
                      selected={selectedId === block.id}
                      onSelect={() => { setSelectedId(block.id); setTab("block"); }}
                      onDuplicate={() => duplicateBlock(block.id)}
                      onDelete={() => deleteBlock(block.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>

        {/* Right panel */}
        <aside className="shrink-0 space-y-3 lg:w-80">
          <div className="flex gap-1 rounded-lg border p-1">
            {(["page", "block"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                  tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {t === "page" ? "Pagina" : "Blocco"}
              </button>
            ))}
          </div>

          <div className="rounded-lg border p-3">
            {tab === "block" ? (
              selected ? (
                <LandingBlockForm block={selected} onChange={updateBlock} />
              ) : (
                <p className="text-xs text-muted-foreground">Seleziona un blocco nel canvas per modificarlo.</p>
              )
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Nome</label>
                  <Input value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Slug (URL)</label>
                  <Input
                    value={slug}
                    onChange={(e) => { setSlug(slugify(e.target.value)); setDirty(true); }}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Colore primario</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.theme.primaryColor}
                      onChange={(e) => mutate({ theme: { ...config.theme, primaryColor: e.target.value } })}
                      className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5"
                    />
                    <Input
                      value={config.theme.primaryColor}
                      onChange={(e) => mutate({ theme: { ...config.theme, primaryColor: e.target.value } })}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Larghezza max (px)</label>
                  <Input
                    type="number"
                    value={config.theme.maxWidth}
                    onChange={(e) => mutate({ theme: { ...config.theme, maxWidth: Number(e.target.value) || 0 } })}
                  />
                </div>
                <div className="h-px bg-border" />
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Meta titolo (SEO)</label>
                  <Input value={metaTitle} onChange={(e) => { setMetaTitle(e.target.value); setDirty(true); }} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Meta descrizione (SEO)</label>
                  <Textarea value={metaDescription} rows={2} onChange={(e) => { setMetaDescription(e.target.value); setDirty(true); }} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Favicon (URL)</label>
                  <Input value={faviconUrl} placeholder="https://..." onChange={(e) => { setFaviconUrl(e.target.value); setDirty(true); }} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Immagine OG (URL)</label>
                  <Input value={ogImageUrl} placeholder="https://..." onChange={(e) => { setOgImageUrl(e.target.value); setDirty(true); }} />
                </div>
              </div>
            )}
          </div>

          <Link href="/landing-pages" className="block text-center text-xs text-muted-foreground hover:underline">
            Tutte le landing page
          </Link>
        </aside>
      </div>
    </div>
  );
}
