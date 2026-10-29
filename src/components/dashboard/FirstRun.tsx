"use client";

import { UserPlus, Handshake, Settings2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useQuickCreate } from "@/components/shared/QuickCreate";

/** Shown instead of the dashboard while the CRM has no contacts and no deals */
export function FirstRun({ name }: { name: string }) {
  const quickCreate = useQuickCreate();
  const steps = [
    {
      icon: UserPlus,
      title: "Aggiungi il primo contatto",
      text: "Un lead, un cliente o un'azienda con cui stai parlando.",
      action: () => quickCreate("contact"),
    },
    {
      icon: Handshake,
      title: "Apri una trattativa",
      text: "Dai un valore all'opportunità e seguila nella pipeline.",
      action: () => quickCreate("deal"),
    },
  ];

  return (
    <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border bg-card px-6 py-10 text-center shadow-card md:px-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-brand-radial" />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Benvenuto</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          {name ? `Ciao ${name}, ` : ""}il tuo CRM è pronto
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Due passi e la dashboard «Oggi» inizia a lavorare per te: priorità, scadenze e trattative da seguire.
        </p>
        <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
          {steps.map((s) => (
            <button
              key={s.title}
              type="button"
              onClick={s.action}
              className="group flex items-start gap-3 rounded-xl border bg-background p-4 text-left transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-lifted"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-sm font-semibold">
                  {s.title}
                  <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{s.text}</span>
              </span>
            </button>
          ))}
        </div>
        <Link
          href="/settings"
          className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Settings2 className="size-3.5" />
          Prima vuoi sistemare le fasi della pipeline? Vai alle impostazioni
        </Link>
      </div>
    </div>
  );
}
