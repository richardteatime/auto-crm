"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Users, Download, X, Phone, Mail, MessageCircle, ChevronRight, ArrowUpDown, Building2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ContactAvatar } from "@/components/shared/ContactAvatar";
import { Segmented } from "@/components/shared/Segmented";
import { useQuickCreate } from "@/components/shared/QuickCreate";
import { Button } from "@/components/ui/button";
import { SOURCE_LABELS, formatCurrencyShort, cleanPhoneForWhatsApp } from "@/lib/constants";
import { agoLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { LeadSource, Temperature } from "@/types";

export interface ContactRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string;
  temperature: Temperature;
  createdMs: number;
  openDeals: number;
  openValue: number;
  wonValue: number;
}

type SortKey = "recent" | "name" | "temperature" | "value";

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: "recent", label: "Più recenti" },
  { value: "name", label: "Nome A–Z" },
  { value: "temperature", label: "Più caldi" },
  { value: "value", label: "Valore in trattativa" },
];

const TEMP_RANK: Record<string, number> = { hot: 0, warm: 1, cold: 2 };

export function ContactsTable({ contacts, nowMs }: { contacts: ContactRow[]; nowMs: number }) {
  const router = useRouter();
  const quickCreate = useQuickCreate();
  const [search, setSearch] = useState("");
  const [filterTemp, setFilterTemp] = useState<"" | Temperature>("");
  const [filterSource, setFilterSource] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const counts = useMemo(
    () => ({
      hot: contacts.filter((c) => c.temperature === "hot").length,
      warm: contacts.filter((c) => c.temperature === "warm").length,
      cold: contacts.filter((c) => c.temperature === "cold").length,
    }),
    [contacts]
  );

  const sources = useMemo(() => [...new Set(contacts.map((c) => c.source).filter(Boolean))], [contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = contacts.filter((c) => {
      if (q) {
        const hit =
          c.name.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.phone?.replace(/\s/g, "").includes(q.replace(/\s/g, ""));
        if (!hit) return false;
      }
      if (filterTemp && c.temperature !== filterTemp) return false;
      if (filterSource && c.source !== filterSource) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "it");
      if (sort === "temperature") return (TEMP_RANK[a.temperature] ?? 3) - (TEMP_RANK[b.temperature] ?? 3) || b.createdMs - a.createdMs;
      if (sort === "value") return b.openValue - a.openValue || b.wonValue - a.wonValue;
      return b.createdMs - a.createdMs;
    });
  }, [contacts, search, filterTemp, filterSource, sort]);

  const isFiltered = !!(search || filterTemp || filterSource);
  const reset = () => {
    setSearch("");
    setFilterTemp("");
    setFilterSource("");
  };

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="size-5" />
        </span>
        <h2 className="mt-4 text-base font-semibold">Nessun contatto, per ora</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Aggiungi il primo lead: da qui partono trattative, preventivi e follow-up.
        </p>
        <Button className="mt-5" onClick={() => quickCreate("contact")}>
          Aggiungi contatto
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Nome, email, azienda, telefono…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-lg border bg-card pl-9 pr-3 text-sm shadow-card outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
          />
        </div>
        <Segmented
          label="Temperatura"
          value={filterTemp}
          onChange={setFilterTemp}
          options={[
            { value: "", label: `Tutti ${contacts.length}` },
            { value: "hot", label: `Caldi ${counts.hot}`, dot: "#f43f5e" },
            { value: "warm", label: `Tiepidi ${counts.warm}`, dot: "#f59e0b" },
            { value: "cold", label: `Freddi ${counts.cold}`, dot: "#38bdf8" },
          ]}
        />
        <select
          aria-label="Fonte del lead"
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="h-8 rounded-lg border bg-card px-2.5 text-xs font-medium text-muted-foreground shadow-card outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
        >
          <option value="">Tutte le fonti</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s as LeadSource] ?? s}
            </option>
          ))}
        </select>
        <label className="relative inline-flex items-center">
          <ArrowUpDown className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
          <select
            aria-label="Ordina"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-8 rounded-lg border bg-card pl-7 pr-2.5 text-xs font-medium text-muted-foreground shadow-card outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {isFiltered && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
            Azzera
          </button>
        )}
        <button
          type="button"
          onClick={() => window.open("/api/export?type=contacts")}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-xs font-medium shadow-card transition-colors hover:bg-muted"
        >
          <Download className="size-3.5" />
          Esporta CSV
        </button>
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="whitespace-nowrap border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5">Contatto</th>
              <th className="px-3 py-2.5">Azienda</th>
              <th className="hidden px-3 py-2.5 lg:table-cell">Fonte</th>
              <th className="px-3 py-2.5">Temperatura</th>
              <th className="px-3 py-2.5 text-right">In trattativa</th>
              <th className="hidden px-3 py-2.5 xl:table-cell">Aggiunto</th>
              <th className="w-32 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => router.push(`/contacts/${c.id}`)}
                className="group cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <ContactAvatar name={c.name} size="md" />
                    <div className="min-w-0">
                      <Link
                        href={`/contacts/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate font-semibold hover:text-primary"
                      >
                        {c.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{c.email || c.phone || "Nessun recapito"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {c.company ? (
                    <span className="flex items-center gap-1.5">
                      <Building2 className="size-3.5 shrink-0" />
                      <span className="truncate">{c.company}</span>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 text-muted-foreground lg:table-cell">
                  {SOURCE_LABELS[c.source as LeadSource] ?? c.source}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge temperature={c.temperature} size="sm" />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                  {c.openDeals > 0 ? (
                    <>
                      <span className="font-semibold">{formatCurrencyShort(c.openValue)}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {c.openDeals} {c.openDeals === 1 ? "aperta" : "aperte"}
                      </span>
                    </>
                  ) : c.wonValue > 0 ? (
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      Cliente · {formatCurrencyShort(c.wonValue)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground xl:table-cell">{agoLabel(c.createdMs, nowMs)}</td>
                <td className="px-3 py-2.5">
                  <QuickActions contact={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nessun contatto corrisponde ai filtri.{" "}
            <button type="button" onClick={reset} className="font-medium text-primary hover:underline">
              Azzera i filtri
            </button>
          </p>
        )}
      </div>

      {/* Phone: compact list */}
      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card md:hidden">
        {filtered.map((c) => (
          <li key={c.id}>
            <Link href={`/contacts/${c.id}`} className="flex items-center gap-3 px-3 py-3 active:bg-muted/60">
              <ContactAvatar name={c.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{c.company || c.email || c.phone || "—"}</p>
              </div>
              <StatusBadge temperature={c.temperature} size="sm" />
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
        {filtered.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nessun risultato.</li>}
      </ul>

      <p className="text-center text-xs text-muted-foreground tabular-nums">
        {filtered.length} di {contacts.length} contatti
      </p>
    </div>
  );
}

function QuickActions({ contact }: { contact: ContactRow }) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const base =
    "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground hover:shadow-card";
  return (
    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
      {contact.phone && (
        <>
          <a href={`tel:${contact.phone}`} onClick={stop} className={base} title={`Chiama ${contact.phone}`} aria-label={`Chiama ${contact.name}`}>
            <Phone className="size-3.5" />
          </a>
          <a
            href={`https://wa.me/${cleanPhoneForWhatsApp(contact.phone)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={stop}
            className={cn(base, "hover:text-emerald-600")}
            title="Scrivi su WhatsApp"
            aria-label={`WhatsApp a ${contact.name}`}
          >
            <MessageCircle className="size-3.5" />
          </a>
        </>
      )}
      {contact.email && (
        <a href={`mailto:${contact.email}`} onClick={stop} className={base} title={`Scrivi a ${contact.email}`} aria-label={`Email a ${contact.name}`}>
          <Mail className="size-3.5" />
        </a>
      )}
    </div>
  );
}
