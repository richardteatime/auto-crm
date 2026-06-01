"use client";

// Property editor for a single landing block. The parent passes the selected
// block and receives the fully-updated block back (type-safe via per-case
// spreads). Array blocks (features, testimonials) get inline add/remove rows.

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  assertNever,
  type ComparisonBlock,
  type FaqItem,
  type FeatureItem,
  type LandingBlock,
  type LogoItem,
  type ReviewItem,
  type TestimonialItem,
} from "@/lib/capture/types";

function FormPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [forms, setForms] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    fetch("/api/forms")
      .then((response) => response.json())
      .then((data) => setForms(Array.isArray(data) ? data : []))
      .catch(() => setForms([]));
  }, []);
  return (
    <select
      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">Campi predefiniti</option>
      {forms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 font-mono text-xs" />
      </div>
    </Field>
  );
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors cursor-pointer",
            value === o.value
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function updateComparisonColumns(block: ComparisonBlock, columns: string[]): ComparisonBlock {
  const nextColumns = columns.slice(0, 5);
  return {
    ...block,
    columns: nextColumns,
    highlightColumn: Math.min(block.highlightColumn, Math.max(0, nextColumns.length - 1)),
    rows: block.rows.map((row) => ({
      ...row,
      values: nextColumns.map((_, index) => row.values[index] ?? ""),
    })),
  };
}

export function LandingBlockForm({
  block,
  onChange,
}: {
  block: LandingBlock;
  onChange: (next: LandingBlock) => void;
}) {
  switch (block.type) {
    case "hero":
      return (
        <div className="space-y-3">
          <Field label="Titolo">
            <Input value={block.heading} onChange={(e) => onChange({ ...block, heading: e.target.value })} />
          </Field>
          <Field label="Sottotitolo">
            <Textarea value={block.subheading} onChange={(e) => onChange({ ...block, subheading: e.target.value })} rows={2} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Testo pulsante">
              <Input value={block.buttonText} onChange={(e) => onChange({ ...block, buttonText: e.target.value })} />
            </Field>
            <Field label="URL pulsante">
              <Input value={block.buttonUrl} onChange={(e) => onChange({ ...block, buttonUrl: e.target.value })} />
            </Field>
          </div>
          <Field label="Allineamento">
            <Toggle
              value={block.align}
              onChange={(v) => onChange({ ...block, align: v as "left" | "center" })}
              options={[{ value: "left", label: "Sinistra" }, { value: "center", label: "Centro" }]}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Sfondo" value={block.backgroundColor} onChange={(v) => onChange({ ...block, backgroundColor: v })} />
            <ColorField label="Testo" value={block.textColor} onChange={(v) => onChange({ ...block, textColor: v })} />
          </div>
        </div>
      );

    case "cta":
      return (
        <div className="space-y-3">
          <Field label="Titolo">
            <Input value={block.heading} onChange={(e) => onChange({ ...block, heading: e.target.value })} />
          </Field>
          <Field label="Sottotitolo">
            <Textarea value={block.subheading} onChange={(e) => onChange({ ...block, subheading: e.target.value })} rows={2} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Testo pulsante">
              <Input value={block.buttonText} onChange={(e) => onChange({ ...block, buttonText: e.target.value })} />
            </Field>
            <Field label="URL pulsante">
              <Input value={block.buttonUrl} onChange={(e) => onChange({ ...block, buttonUrl: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Sfondo" value={block.backgroundColor} onChange={(v) => onChange({ ...block, backgroundColor: v })} />
            <ColorField label="Testo" value={block.textColor} onChange={(v) => onChange({ ...block, textColor: v })} />
          </div>
        </div>
      );

    case "features": {
      const setItem = (i: number, patch: Partial<FeatureItem>) =>
        onChange({ ...block, items: block.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
      return (
        <div className="space-y-3">
          <Field label="Titolo sezione">
            <Input value={block.heading} onChange={(e) => onChange({ ...block, heading: e.target.value })} />
          </Field>
          <div className="space-y-2">
            {block.items.map((item, i) => (
              <div key={i} className="space-y-2 rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Elemento {i + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 cursor-pointer text-muted-foreground hover:text-destructive"
                    onClick={() => onChange({ ...block, items: block.items.filter((_, idx) => idx !== i) })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input value={item.title} placeholder="Titolo" onChange={(e) => setItem(i, { title: e.target.value })} />
                <Textarea value={item.description} placeholder="Descrizione" rows={2} onChange={(e) => setItem(i, { description: e.target.value })} />
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full cursor-pointer"
            onClick={() => onChange({ ...block, items: [...block.items, { title: "Nuovo", description: "Descrizione", icon: "Star" }] })}
          >
            <Plus className="h-4 w-4 mr-1" /> Aggiungi elemento
          </Button>
        </div>
      );
    }

    case "testimonials": {
      const setItem = (i: number, patch: Partial<TestimonialItem>) =>
        onChange({ ...block, items: block.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
      return (
        <div className="space-y-3">
          <Field label="Titolo sezione">
            <Input value={block.heading} onChange={(e) => onChange({ ...block, heading: e.target.value })} />
          </Field>
          <div className="space-y-2">
            {block.items.map((item, i) => (
              <div key={i} className="space-y-2 rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Testimonianza {i + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 cursor-pointer text-muted-foreground hover:text-destructive"
                    onClick={() => onChange({ ...block, items: block.items.filter((_, idx) => idx !== i) })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Textarea value={item.quote} placeholder="Citazione" rows={2} onChange={(e) => setItem(i, { quote: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={item.author} placeholder="Autore" onChange={(e) => setItem(i, { author: e.target.value })} />
                  <Input value={item.role} placeholder="Ruolo" onChange={(e) => setItem(i, { role: e.target.value })} />
                </div>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full cursor-pointer"
            onClick={() => onChange({ ...block, items: [...block.items, { quote: "", author: "", role: "" }] })}
          >
            <Plus className="h-4 w-4 mr-1" /> Aggiungi testimonianza
          </Button>
        </div>
      );
    }

    case "form":
      return (
        <div className="space-y-3">
          <Field label="Titolo form">
            <Input value={block.heading} onChange={(e) => onChange({ ...block, heading: e.target.value })} />
          </Field>
          <Field label="Form salvato">
            <FormPicker value={block.formId} onChange={(formId) => onChange({ ...block, formId })} />
          </Field>
          <p className="text-xs text-muted-foreground">
            Se non selezioni un form salvato, il blocco usa i campi predefiniti nome, email, telefono e messaggio.
          </p>
        </div>
      );

    case "image":
      return (
        <div className="space-y-3">
          <Field label="URL immagine">
            <Input value={block.url} placeholder="https://..." onChange={(e) => onChange({ ...block, url: e.target.value })} />
          </Field>
          <Field label="Testo alternativo">
            <Input value={block.alt} onChange={(e) => onChange({ ...block, alt: e.target.value })} />
          </Field>
          <Field label="Larghezza massima (px)">
            <Input
              type="number"
              value={block.maxWidth}
              onChange={(e) => onChange({ ...block, maxWidth: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>
      );

    case "text":
      return (
        <div className="space-y-3">
          <Field label="Contenuto">
            <Textarea value={block.content} rows={5} onChange={(e) => onChange({ ...block, content: e.target.value })} />
          </Field>
          <Field label="Allineamento">
            <Toggle
              value={block.align}
              onChange={(v) => onChange({ ...block, align: v as "left" | "center" | "right" })}
              options={[
                { value: "left", label: "Sinistra" },
                { value: "center", label: "Centro" },
                { value: "right", label: "Destra" },
              ]}
            />
          </Field>
        </div>
      );

    case "footer":
      return (
        <div className="space-y-3">
          <Field label="Testo footer">
            <Input value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} />
          </Field>
        </div>
      );

    case "logos": {
      const setItem = (i: number, patch: Partial<LogoItem>) =>
        onChange({ ...block, items: block.items.map((item, index) => (index === i ? { ...item, ...patch } : item)) });
      return (
        <div className="space-y-3">
          <Field label="Titolo sezione">
            <Input value={block.heading} onChange={(e) => onChange({ ...block, heading: e.target.value })} />
          </Field>
          <div className="space-y-2">
            {block.items.map((item, i) => (
              <div key={i} className="space-y-2 rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Logo {i + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 cursor-pointer text-muted-foreground hover:text-destructive"
                    onClick={() => onChange({ ...block, items: block.items.filter((_, index) => index !== i) })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input value={item.name} placeholder="Nome" onChange={(e) => setItem(i, { name: e.target.value })} />
                <Input value={item.imageUrl} placeholder="URL immagine opzionale" onChange={(e) => setItem(i, { imageUrl: e.target.value })} />
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full cursor-pointer"
            onClick={() => onChange({ ...block, items: [...block.items, { name: "Nuovo logo", imageUrl: "" }] })}
          >
            <Plus className="mr-1 h-4 w-4" /> Aggiungi logo
          </Button>
        </div>
      );
    }

    case "faq": {
      const setItem = (i: number, patch: Partial<FaqItem>) =>
        onChange({ ...block, items: block.items.map((item, index) => (index === i ? { ...item, ...patch } : item)) });
      return (
        <div className="space-y-3">
          <Field label="Titolo sezione">
            <Input value={block.heading} onChange={(e) => onChange({ ...block, heading: e.target.value })} />
          </Field>
          <div className="space-y-2">
            {block.items.map((item, i) => (
              <div key={i} className="space-y-2 rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Domanda {i + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 cursor-pointer text-muted-foreground hover:text-destructive"
                    onClick={() => onChange({ ...block, items: block.items.filter((_, index) => index !== i) })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input value={item.question} placeholder="Domanda" onChange={(e) => setItem(i, { question: e.target.value })} />
                <Textarea value={item.answer} placeholder="Risposta" rows={3} onChange={(e) => setItem(i, { answer: e.target.value })} />
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full cursor-pointer"
            onClick={() => onChange({ ...block, items: [...block.items, { question: "Nuova domanda", answer: "Risposta" }] })}
          >
            <Plus className="mr-1 h-4 w-4" /> Aggiungi domanda
          </Button>
        </div>
      );
    }

    case "reviews": {
      const setItem = (i: number, patch: Partial<ReviewItem>) =>
        onChange({ ...block, items: block.items.map((item, index) => (index === i ? { ...item, ...patch } : item)) });
      return (
        <div className="space-y-3">
          <Field label="Titolo sezione">
            <Input value={block.heading} onChange={(e) => onChange({ ...block, heading: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Rating medio">
              <Input
                type="number"
                min={1}
                max={5}
                step={0.1}
                value={block.averageRating}
                onChange={(e) => onChange({ ...block, averageRating: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })}
              />
            </Field>
            <Field label="Etichetta conteggio">
              <Input value={block.ratingCountLabel} onChange={(e) => onChange({ ...block, ratingCountLabel: e.target.value })} />
            </Field>
          </div>
          <div className="space-y-2">
            {block.items.map((item, i) => (
              <div key={i} className="space-y-2 rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Recensione {i + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 cursor-pointer text-muted-foreground hover:text-destructive"
                    onClick={() => onChange({ ...block, items: block.items.filter((_, index) => index !== i) })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Textarea value={item.quote} placeholder="Recensione" rows={2} onChange={(e) => setItem(i, { quote: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={item.author} placeholder="Autore" onChange={(e) => setItem(i, { author: e.target.value })} />
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={item.rating}
                    onChange={(e) => setItem(i, { rating: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })}
                  />
                </div>
                <Input value={item.avatarUrl ?? ""} placeholder="URL avatar opzionale" onChange={(e) => setItem(i, { avatarUrl: e.target.value })} />
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full cursor-pointer"
            onClick={() => onChange({ ...block, items: [...block.items, { quote: "", author: "", rating: 5, avatarUrl: "" }] })}
          >
            <Plus className="mr-1 h-4 w-4" /> Aggiungi recensione
          </Button>
        </div>
      );
    }

    case "offer":
      return (
        <div className="space-y-3">
          <Field label="Badge opzionale">
            <Input value={block.badgeText} onChange={(e) => onChange({ ...block, badgeText: e.target.value })} />
          </Field>
          <Field label="Titolo">
            <Input value={block.heading} onChange={(e) => onChange({ ...block, heading: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Prezzo testuale">
              <Input value={block.priceLabel} onChange={(e) => onChange({ ...block, priceLabel: e.target.value })} />
            </Field>
            <Field label="Prezzo barrato">
              <Input value={block.comparePriceLabel} onChange={(e) => onChange({ ...block, comparePriceLabel: e.target.value })} />
            </Field>
          </div>
          <div className="space-y-2">
            {block.includes.map((item, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={item}
                  placeholder="Elemento incluso"
                  onChange={(e) => onChange({ ...block, includes: block.includes.map((value, index) => (index === i ? e.target.value : value)) })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 cursor-pointer text-muted-foreground hover:text-destructive"
                  onClick={() => onChange({ ...block, includes: block.includes.filter((_, index) => index !== i) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full cursor-pointer"
            onClick={() => onChange({ ...block, includes: [...block.includes, "Nuovo vantaggio"] })}
          >
            <Plus className="mr-1 h-4 w-4" /> Aggiungi vantaggio
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Testo pulsante">
              <Input value={block.buttonText} onChange={(e) => onChange({ ...block, buttonText: e.target.value })} />
            </Field>
            <Field label="URL pulsante">
              <Input value={block.buttonUrl} onChange={(e) => onChange({ ...block, buttonUrl: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Sfondo" value={block.backgroundColor} onChange={(v) => onChange({ ...block, backgroundColor: v })} />
            <ColorField label="Testo" value={block.textColor} onChange={(v) => onChange({ ...block, textColor: v })} />
          </div>
        </div>
      );

    case "comparison": {
      const setColumn = (i: number, value: string) =>
        onChange(updateComparisonColumns(block, block.columns.map((column, index) => (index === i ? value : column))));
      const setRow = (i: number, patch: Partial<(typeof block.rows)[number]>) =>
        onChange({ ...block, rows: block.rows.map((row, index) => (index === i ? { ...row, ...patch } : row)) });
      const setCell = (rowIndex: number, columnIndex: number, value: boolean | string) => {
        const row = block.rows[rowIndex];
        setRow(rowIndex, { values: row.values.map((cell, index) => (index === columnIndex ? value : cell)) });
      };
      return (
        <div className="space-y-3">
          <Field label="Titolo sezione">
            <Input value={block.heading} onChange={(e) => onChange({ ...block, heading: e.target.value })} />
          </Field>
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Colonne (max 5)</span>
            {block.columns.map((column, i) => (
              <div key={i} className="flex gap-2">
                <Input value={column} onChange={(e) => setColumn(i, e.target.value)} />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={block.columns.length <= 1}
                  className="shrink-0 cursor-pointer text-muted-foreground hover:text-destructive"
                  onClick={() => onChange(updateComparisonColumns(block, block.columns.filter((_, index) => index !== i)))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={block.columns.length >= 5}
              className="w-full cursor-pointer"
              onClick={() => onChange(updateComparisonColumns(block, [...block.columns, `Alternativa ${block.columns.length + 1}`]))}
            >
              <Plus className="mr-1 h-4 w-4" /> Aggiungi colonna
            </Button>
          </div>
          <Field label="Colonna evidenziata">
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={block.highlightColumn}
              onChange={(e) => onChange({ ...block, highlightColumn: Number(e.target.value) })}
            >
              {block.columns.map((column, i) => <option key={i} value={i}>{column}</option>)}
            </select>
          </Field>
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Righe</span>
            {block.rows.map((row, rowIndex) => (
              <div key={rowIndex} className="space-y-2 rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Riga {rowIndex + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 cursor-pointer text-muted-foreground hover:text-destructive"
                    onClick={() => onChange({ ...block, rows: block.rows.filter((_, index) => index !== rowIndex) })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input value={row.label} placeholder="Caratteristica" onChange={(e) => setRow(rowIndex, { label: e.target.value })} />
                {row.values.map((value, columnIndex) => (
                  <div key={columnIndex} className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
                    <Input
                      value={typeof value === "string" ? value : ""}
                      placeholder={block.columns[columnIndex]}
                      disabled={typeof value === "boolean"}
                      onChange={(e) => setCell(rowIndex, columnIndex, e.target.value)}
                    />
                    <select
                      className="rounded-md border bg-background px-2 py-1 text-xs"
                      value={typeof value === "boolean" ? (value ? "yes" : "no") : "text"}
                      onChange={(e) => setCell(rowIndex, columnIndex, e.target.value === "text" ? "" : e.target.value === "yes")}
                    >
                      <option value="text">Testo</option>
                      <option value="yes">Sì</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full cursor-pointer"
            onClick={() => onChange({ ...block, rows: [...block.rows, { label: "Nuova caratteristica", values: block.columns.map(() => true) }] })}
          >
            <Plus className="mr-1 h-4 w-4" /> Aggiungi riga
          </Button>
        </div>
      );
    }

    case "divider":
      return <p className="text-xs text-muted-foreground">Separatore orizzontale. Nessuna opzione.</p>;

    default:
      return assertNever(block);
  }
}
