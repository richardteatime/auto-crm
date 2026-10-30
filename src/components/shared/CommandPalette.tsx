"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Handshake, Moon, Sun, Building2, KeyRound } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { ALL_NAV_ITEMS } from "@/components/layout/nav-config";
import { QUICK_CREATE_ITEMS, useQuickCreate } from "./QuickCreate";
import { ContactAvatar } from "./ContactAvatar";
import { formatCurrencyShort } from "@/lib/constants";

interface SearchContact {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
}

interface SearchDeal {
  id: string;
  title: string;
  value: number;
  contactName?: string | null;
  stageName?: string | null;
}

const CommandPaletteContext = createContext<() => void>(() => {});

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const openPalette = useCallback(() => setOpen(true), []);

  return (
    <CommandPaletteContext.Provider value={openPalette}>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}

function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const quickCreate = useQuickCreate();
  const { resolvedTheme, setTheme } = useTheme();
  const [contacts, setContacts] = useState<SearchContact[]>([]);
  const [deals, setDeals] = useState<SearchDeal[]>([]);

  // Refresh the searchable records every time the palette opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([
      fetch("/api/contacts").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/deals").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([c, d]) => {
        if (cancelled) return;
        if (Array.isArray(c)) setContacts(c);
        if (Array.isArray(d)) setDeals(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const run = useCallback(
    (fn: () => void) => {
      onOpenChange(false);
      fn();
    },
    [onOpenChange]
  );

  const isDark = resolvedTheme === "dark";

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cerca nel CRM"
      description="Cerca contatti e trattative, apri una pagina o crea qualcosa di nuovo"
      className="sm:max-w-xl"
    >
      <Command className="rounded-none! bg-transparent p-0">
      <CommandInput placeholder="Cerca contatti, trattative, pagine…" />
      <CommandList className="max-h-[min(60vh,440px)] scrollbar-thin">
        <CommandEmpty>Nessun risultato. Prova con un nome, un&apos;azienda o una pagina.</CommandEmpty>

        <CommandGroup heading="Crea">
          {QUICK_CREATE_ITEMS.map((item) => (
            <CommandItem
              key={item.kind}
              value={`crea ${item.label} ${item.hint}`}
              onSelect={() => run(() => quickCreate(item.kind))}
            >
              <item.icon className="text-primary" />
              <span>{item.label}</span>
              <span className="ml-1 truncate text-xs text-muted-foreground">{item.hint}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {contacts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Contatti">
              {contacts.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`contatto ${c.name} ${c.company ?? ""} ${c.email ?? ""} ${c.phone ?? ""} ${c.id}`}
                  onSelect={() => run(() => router.push(`/contacts/${c.id}`))}
                >
                  <ContactAvatar name={c.name} size="xs" />
                  <span className="truncate">{c.name}</span>
                  {c.company && (
                    <span className="ml-1 flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
                      <Building2 className="size-3" />
                      {c.company}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {deals.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Trattative">
              {deals.map((d) => (
                <CommandItem
                  key={d.id}
                  value={`trattativa ${d.title} ${d.contactName ?? ""} ${d.stageName ?? ""} ${d.id}`}
                  onSelect={() => run(() => router.push(`/deals/${d.id}`))}
                >
                  <Handshake className="text-muted-foreground" />
                  <span className="truncate">{d.title}</span>
                  {d.contactName && (
                    <span className="ml-1 truncate text-xs text-muted-foreground">{d.contactName}</span>
                  )}
                  <CommandShortcut className="tabular-nums tracking-normal">{formatCurrencyShort(d.value)}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Vai a">
          {ALL_NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.href}
              value={`vai ${item.label} ${item.keywords ?? ""}`}
              onSelect={() => run(() => router.push(item.href))}
            >
              <item.icon className="text-muted-foreground" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Preferenze">
          <CommandItem
            value="tema chiaro scuro dark light aspetto"
            onSelect={() => run(() => setTheme(isDark ? "light" : "dark"))}
          >
            {isDark ? <Sun className="text-muted-foreground" /> : <Moon className="text-muted-foreground" />}
            <span>{isDark ? "Passa al tema chiaro" : "Passa al tema scuro"}</span>
          </CommandItem>
          <CommandItem
            value="cambia password sicurezza account accesso"
            onSelect={() => run(() => router.push("/settings"))}
          >
            <KeyRound className="text-muted-foreground" />
            <span>Cambia password</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> per muoverti · <Kbd>↵</Kbd> per aprire
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>esc</Kbd> per chiudere
        </span>
      </div>
      </Command>
    </CommandDialog>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border bg-muted px-1 font-sans text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}
