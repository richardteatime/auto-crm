"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, ScrollText } from "lucide-react";
import {
  CLAUSES_DRAFT,
  GENERAL_GROUP,
  detectServiceGroups,
  resolveClause,
  type ClauseGroup,
  type QuoteClauses,
} from "@/lib/quote-clauses";

interface Props {
  title: string;
  lines: { description: string; billingType?: string; isSetup?: boolean }[];
  value: QuoteClauses;
  onChange: (next: QuoteClauses) => void;
}

/** Conditions printed on the quote: detected from the services, switchable one by one. */
export function QuoteClausesEditor({ title, lines, value, onChange }: Props) {
  const groups = useMemo(() => detectServiceGroups(lines, title), [lines, title]);
  const off = new Set(value.excluded);

  const toggle = (id: string) => {
    const next = new Set(off);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...value, excluded: [...next] });
  };

  const group = (g: ClauseGroup, open: boolean) => {
    const active = g.clauses.filter((c) => !off.has(c.id)).length;
    return (
      <details key={g.id} open={open} className="group rounded-md border bg-background">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
          {g.title}
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {active}/{g.clauses.length} incluse
          </span>
        </summary>
        <div className="space-y-1 border-t px-3 py-2">
          {g.clauses.map((c) => {
            const text = resolveClause(c).parts.map((p) => p.text).join("");
            return (
              <label key={c.id} className="flex cursor-pointer items-start gap-2.5 rounded px-1 py-1.5 hover:bg-muted/40">
                <input
                  type="checkbox"
                  className="accent-primary mt-0.5 h-4 w-4 shrink-0"
                  checked={!off.has(c.id)}
                  onChange={() => toggle(c.id)}
                />
                <span className={off.has(c.id) ? "opacity-50" : ""}>
                  <span className="block text-xs font-semibold">{c.title}</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">{text}</span>
                </span>
              </label>
            );
          })}
        </div>
      </details>
    );
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <ScrollText className="h-4 w-4 text-muted-foreground" />
        <Label>Condizioni del preventivo</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        {groups.length > 0
          ? `In base ai servizi inseriti vengono aggiunte le condizioni per: ${groups.map((g) => g.title.toLowerCase()).join(", ")}. Togli la spunta a quelle che non valgono per questo cliente.`
          : "Scrivi i servizi nelle voci: le condizioni specifiche (sito, e-commerce, campagne…) si aggiungono da sole."}
        {CLAUSES_DRAFT && " Testi in bozza, da approvare."}
      </p>
      <div className="space-y-2">
        {groups.map((g) => group(g, true))}
        {group(GENERAL_GROUP, false)}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="q-extra-clauses" className="text-xs">
          Condizioni aggiuntive per questo preventivo
        </Label>
        <Textarea
          id="q-extra-clauses"
          rows={2}
          value={value.extra}
          onChange={(e) => onChange({ ...value, extra: e.target.value })}
          placeholder="Una condizione per riga, es. Il servizio fotografico è previsto in un'unica giornata presso la sede del Cliente."
        />
      </div>
    </div>
  );
}
