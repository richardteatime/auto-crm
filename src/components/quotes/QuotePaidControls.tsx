"use client";

import { useState } from "react";
import { CheckCircle2, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { quoteExpiry, quoteExpiryLabel } from "@/lib/quote-expiry";

type QuoteLike = {
  id: string;
  status?: string | null;
  isPaid?: boolean | null;
  /** The deal itself is marked paid: the quote counts as paid */
  dealIsPaid?: boolean | null;
  validUntil?: unknown;
};

/** Pagato (green) · Scade tra N gg (amber) · Scaduto (red); nothing when the quote is fine */
export function QuoteExpiryBadge({ quote, className }: { quote: QuoteLike; className?: string }) {
  const e = quoteExpiry(quote);
  const label = quoteExpiryLabel(e);
  if (!label) return null;
  const Icon = e.state === "paid" ? CheckCircle2 : e.state === "expired" ? AlertTriangle : Clock;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
        e.state === "paid" && "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
        e.state === "soon" && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        e.state === "expired" && "bg-rose-500/15 text-rose-700 dark:text-rose-300",
        className
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

/** Row tint for tables: red when expired and unpaid */
export function quoteRowClass(quote: QuoteLike): string | undefined {
  const s = quoteExpiry(quote).state;
  if (s === "expired") return "bg-rose-500/[0.10] hover:bg-rose-500/[0.15] shadow-[inset_3px_0_0_rgb(244_63_94)]";
  if (s === "soon") return "bg-amber-500/[0.07] hover:bg-amber-500/[0.11] shadow-[inset_3px_0_0_rgb(245_158_11)]";
  return undefined;
}

/** "Segna come pagato" toggle; calls onChange with the saved value */
export function QuotePaidButton({
  quote,
  onChange,
  size = "sm",
}: {
  quote: QuoteLike;
  onChange?: (isPaid: boolean) => void;
  size?: "sm" | "xs";
}) {
  const [saving, setSaving] = useState(false);
  const paid = !!quote.isPaid;
  if (!paid && (quote.status === "rifiutato" || quote.dealIsPaid)) return null;

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaid: !paid }),
      });
      if (!res.ok) throw new Error();
      toast.success(paid ? "Pagamento annullato" : "Preventivo segnato come pagato");
      onChange?.(!paid);
    } catch {
      toast.error("Non sono riuscito a salvare, riprova");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button
      type="button"
      variant={paid ? "ghost" : "outline"}
      size="sm"
      onClick={toggle}
      disabled={saving}
      title={paid ? "Annulla il pagamento" : "Segna come pagato"}
      className={cn(
        "cursor-pointer gap-1.5",
        size === "xs" && "h-7 px-2 text-xs",
        paid
          ? "text-muted-foreground hover:text-foreground"
          : "border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-emerald-300"
      )}
    >
      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
      {paid ? "Annulla pagato" : size === "xs" ? "Segna pagato" : "Segna come pagato"}
    </Button>
  );
}
