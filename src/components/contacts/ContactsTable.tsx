"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Search, Users, Download, X, SlidersHorizontal } from "lucide-react";
import { formatDate, SOURCE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Contact, Temperature, LeadSource } from "@/types";

const TEMP_OPTIONS = [
  { value: "", label: "Tutti" },
  { value: "hot", label: "Caldo" },
  { value: "warm", label: "Tiepido" },
  { value: "cold", label: "Freddo" },
] as const;

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Tutte le fonti" },
  ...Object.entries(SOURCE_LABELS).map(([k, v]) => ({ value: k, label: v })),
];


interface ContactsTableProps {
  contacts: Contact[];
}

export function ContactsTable({ contacts }: ContactsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterTemp, setFilterTemp] = useState<Temperature | "">("");
  const [filterSource, setFilterSource] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const filtered = useMemo(() => contacts.filter((c) => {
    if (search) {
      const q = search.toLowerCase();
      const hit = c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q);
      if (!hit) return false;
    }
    if (filterTemp && c.temperature !== filterTemp) return false;
    if (filterSource && c.source !== filterSource) return false;
    return true;
  }), [contacts, search, filterTemp, filterSource, filterScoreMin]);

  const isFiltered = search || filterTemp || filterSource;

  const reset = () => {
    setSearch("");
    setFilterTemp("");
    setFilterSource("");
  };

  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nessun contatto"
        description="Aggiungi il tuo primo contatto per iniziare a gestire il tuo pipeline di vendita."
        actionLabel="Aggiungi contatto"
        onAction={() => router.push("/contacts?new=true")}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Primary filter row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, email, azienda, telefono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant={showAdvanced ? "default" : "outline"}
            size="sm"
            className="cursor-pointer gap-1.5"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtri
            {isFiltered && !search && (
              <span className="ml-0.5 bg-primary-foreground text-primary rounded-full w-4 h-4 text-xs flex items-center justify-center font-bold">
                !
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/api/export?type=contacts")}
            className="cursor-pointer"
          >
            <Download className="h-4 w-4 mr-1" />
            Esporta
          </Button>
        </div>
      </div>

      {/* Temperature quick chips */}
      <div className="flex flex-wrap gap-2">
        {TEMP_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilterTemp(value as Temperature | "")}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer",
              filterTemp === value
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {label}
            {value && (
              <span className="ml-1 opacity-60">
                ({contacts.filter((c) => c.temperature === value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Advanced filters panel */}
      {showAdvanced && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fonte lead</p>
              <div className="flex flex-wrap gap-1">
                {SOURCE_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setFilterSource(value)}
                    className={cn(
                      "px-2 py-0.5 rounded text-xs border transition-colors cursor-pointer",
                      filterSource === value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-end">
              {isFiltered && (
                <button
                  onClick={reset}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  Azzera filtri
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden sm:table-cell">Azienda</TableHead>
              <TableHead className="hidden md:table-cell">Fonte</TableHead>
              <TableHead>Temperatura</TableHead>
              <TableHead className="hidden lg:table-cell">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">
                  Nessun contatto corrisponde ai filtri applicati.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/contacts/${contact.id}`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-xs text-muted-foreground">{contact.email || "Senza email"}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{contact.company || "-"}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {SOURCE_LABELS[contact.source as LeadSource] || contact.source}
                  </TableCell>
                  <TableCell>
                    <StatusBadge temperature={contact.temperature as Temperature} size="sm" />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {formatDate(contact.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {filtered.length} di {contacts.length} contatti
        {isFiltered && (
          <button onClick={reset} className="ml-2 underline cursor-pointer hover:text-foreground">
            azzera filtri
          </button>
        )}
      </p>
    </div>
  );
}
