"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, ScrollText } from "lucide-react";
import {
  GENERAL_GROUP,
  clauseText,
  detectServiceGroups,
  isClauseOn,
  isPendingClause,
  toggleClause,
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

  const group = (g: ClauseGroup, open: boolean) => {
    const active = g.clauses.filter((c) => isClauseOn(c, value)).length;
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
            const on = isClauseOn(c, value);
            const pending = isPendingClause(c);
            return (
              <label key={c.id} className="flex cursor-pointer items-start gap-2.5 rounded px-1 py-1.5 hover:bg-muted/40">
                <input
                  type="checkbox"
                  className="accent-primary mt-0.5 h-4 w-4 shrink-0"
                  checked={on}
                  onChange={() => onChange(toggleClause(c, value))}
                />
                <span className={on ? "" : "opacity-55"}>
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    {c.title}
                    {pending && (
                      <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                        valore da confermare
                      </span>
                    )}
                  </span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">{clauseText(c)}</span>
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
        <Label>Condizioni di fornitura</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        {groups.length > 0
          ? `In base ai servizi inseriti il preventivo riporta le condizioni per: ${groups.map((g) => g.title).join(", ")}, più quelle generali. Togli la spunta a quelle che non valgono per questo cliente.`
          : "Scrivi i servizi nelle voci: le condizioni specifiche (sito, e-commerce, campagne…) si aggiungono da sole. Le condizioni generali sono sempre incluse."}
      </p>
      <div className="space-y-2">
        {groups.map((g) => group(g, true))}
        {group(GENERAL_GROUP, groups.length === 0)}
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
