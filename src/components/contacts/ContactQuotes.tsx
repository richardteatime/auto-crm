"use client";

import Link from "next/link";
import { FileDown, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { QuoteExpiryBadge } from "@/components/quotes/QuotePaidControls";
import { RelatedChip } from "@/components/shared/RelatedChip";
import { formatCurrency, formatDate } from "@/lib/constants";

export interface ContactQuote {
  id: string;
  number: string;
  title: string;
  status: string;
  dealId: string;
  dealTitle: string | null;
  opportunityId: string | null;
  opportunityTitle: string | null;
  /** cents, VAT included */
  total: number;
  validUntil: Date | string | null;
  isPaid: boolean;
  dealIsPaid: boolean;
  createdAt: Date | string;
}

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  bozza: { label: "Bozza", variant: "secondary" },
  inviato: { label: "Inviato", variant: "outline" },
  accettato: { label: "Accettato", variant: "default" },
  rifiutato: { label: "Rifiutato", variant: "destructive" },
};

/** Every quote made on this contact's deals, with links to the deal, the opportunity and the quote itself */
export function ContactQuotes({ quotes }: { quotes: ContactQuote[] }) {
  const accepted = quotes.filter((q) => q.status === "accettato").reduce((s, q) => s + q.total, 0);

  return (
    <section className="rounded-xl border bg-card shadow-card">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <FileText className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Preventivi</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{quotes.length}</span>
        {accepted > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            Accettati: <span className="font-semibold text-foreground tabular-nums">{formatCurrency(accepted)}</span>
          </span>
        )}
      </header>

      {quotes.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Nessun preventivo per questo contatto. I preventivi si creano dalla scheda di una trattativa.
        </p>
      ) : (
        <ul className="divide-y">
          {quotes.map((q) => {
            const cfg = STATUS[q.status] ?? STATUS.bozza;
            return (
              <li key={q.id} id={`preventivo-${q.id}`} className="space-y-2 px-4 py-3 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/deals/${q.dealId}#preventivo-${q.id}`}
                      className="group inline-flex max-w-full items-baseline gap-2 hover:text-primary"
                      title="Apri il preventivo"
                    >
                      <span className="font-mono text-xs text-muted-foreground group-hover:text-primary">{q.number}</span>
                      <span className="truncate text-sm font-medium group-hover:underline">{q.title}</span>
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      <QuoteExpiryBadge quote={q} />
                      {q.validUntil && (
                        <span className="text-xs text-muted-foreground">valido fino al {formatDate(new Date(q.validUntil))}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-sm font-semibold tabular-nums text-primary">{formatCurrency(q.total)}</span>
                    <a
                      href={`/api/quotes/${q.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Scarica il PDF"
                      title="Scarica il PDF"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <FileDown className="size-4" />
                    </a>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <RelatedChip kind="trattativa" href={`/deals/${q.dealId}`} label={q.dealTitle ? `Trattativa · ${q.dealTitle}` : "Trattativa"} />
                  {q.opportunityId && (
                    <RelatedChip kind="opportunita" href={`#opportunita-${q.opportunityId}`} label={q.opportunityTitle ? `Opportunità · ${q.opportunityTitle}` : "Opportunità"} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
