"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/constants";
import { clampPct, feeOf, type PartnerFeeConfig } from "@/lib/partner-fee-shared";

/** Deal page: how the price (VAT excluded) splits between us and the partner */
export function PartnerFeeCard({
  dealId,
  value,
  pct,
  isCustom,
  recurring,
  cfg,
}: {
  dealId: string;
  value: number;
  pct: number;
  isCustom: boolean;
  recurring: string | null;
  cfg: PartnerFeeConfig;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(String(pct));
  const [saving, setSaving] = useState(false);
  const draftPct = clampPct(draft);
  const shownPct = cfg.canEdit && draftPct !== null ? draftPct : pct;
  const fee = feeOf(value, shownPct);
  const dirty = draftPct !== null && draftPct !== pct;

  const save = async () => {
    if (draftPct === null) {
      toast.error("Scrivi una percentuale tra 0 e 100");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerFeePct: draftPct }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "");
      toast.success(`Fee ${cfg.name} aggiornata al ${draftPct}%`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Non sono riuscito a salvare la percentuale");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border bg-card p-4 shadow-card md:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/12 text-violet-600 dark:text-violet-300">
          <HandCoins className="size-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold">Divisione incasso</h2>
          <p className="text-xs text-muted-foreground">
            Sul prezzo senza IVA{recurring ? ` · vale su ogni rata (${recurring})` : ""}
            {!isCustom && " · percentuale standard"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {cfg.canEdit ? (
            <>
              <label htmlFor="fee-pct" className="text-sm text-muted-foreground">
                Fee {cfg.name}
              </label>
              <div className="relative">
                <Input
                  id="fee-pct"
                  inputMode="decimal"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && dirty && save()}
                  className="h-9 w-20 pr-6 text-right tabular-nums"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
              <Button size="sm" onClick={save} disabled={!dirty || saving} className="gap-1.5">
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                Salva
              </Button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground" title="Solo l'amministratore può cambiarla">
              <Lock className="size-3" />
              Fee {cfg.name} {pct}%
            </span>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <dt className="text-xs text-muted-foreground">Prezzo senza IVA</dt>
          <dd className="mt-0.5 text-xl font-bold tabular-nums">{formatCurrency(value)}</dd>
        </div>
        <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.06] px-4 py-3">
          <dt className="text-xs text-muted-foreground">
            A {cfg.name} ({shownPct}%)
          </dt>
          <dd className="mt-0.5 text-xl font-bold tabular-nums text-violet-700 dark:text-violet-300">{formatCurrency(fee)}</dd>
        </div>
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3">
          <dt className="text-xs text-muted-foreground">A noi ({Math.round((100 - shownPct) * 100) / 100}%)</dt>
          <dd className="mt-0.5 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(value - fee)}</dd>
        </div>
      </dl>
    </section>
  );
}
