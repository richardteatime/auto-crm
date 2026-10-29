"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { ThemeToggle } from "@/components/shared/ThemeProvider";
import { useCommandPalette } from "@/components/shared/CommandPalette";
import { QUICK_CREATE_ITEMS, useQuickCreate } from "@/components/shared/QuickCreate";
import { BrandMark } from "./BrandMark";
import { findNav } from "./nav-config";

const SUBPAGE_LABELS: Record<string, string> = {
  "/finance/fatturato": "Fatturato",
  "/finance/spese": "Spese",
  "/finance/mrr": "MRR",
};

const DETAIL_LABELS: Record<string, string> = {
  "/contacts": "Scheda contatto",
  "/deals": "Scheda trattativa",
  "/timeline": "Progetto",
};

function useBreadcrumb() {
  const pathname = usePathname();
  const nav = findNav(pathname);
  if (!nav) return null;
  const isRoot = pathname === nav.item.href;
  const leaf = isRoot ? null : SUBPAGE_LABELS[pathname] ?? DETAIL_LABELS[nav.item.href] ?? "Dettaglio";
  return { ...nav, leaf };
}

export function Header() {
  const crumb = useBreadcrumb();
  const openPalette = useCommandPalette();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65 md:rounded-t-xl md:px-6">
      <Link href="/" className="mr-1 md:hidden" aria-label="Vai a Oggi">
        <BrandMark className="size-7" />
      </Link>

      {crumb && (
        <nav aria-label="Percorso" className="flex min-w-0 items-center gap-1.5 text-sm">
          {crumb.section && (
            <>
              <span className="hidden text-muted-foreground sm:inline">{crumb.section}</span>
              <ChevronRight className="hidden size-3.5 shrink-0 text-muted-foreground/50 sm:inline" />
            </>
          )}
          {crumb.leaf ? (
            <>
              <Link
                href={crumb.item.href}
                className="truncate text-muted-foreground transition-colors hover:text-foreground"
              >
                {crumb.item.label}
              </Link>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
              <span className="truncate font-medium">{crumb.leaf}</span>
            </>
          ) : (
            <span className="flex items-center gap-2 truncate font-medium">
              <crumb.item.icon className="size-4 text-muted-foreground" />
              {crumb.item.label}
            </span>
          )}
        </nav>
      )}

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={openPalette}
          aria-label="Cerca"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
        >
          <Search className="size-4" />
        </button>
        <ThemeToggle className="hidden md:flex" />
        <NotificationBell />
        <NewMenu />
      </div>
    </header>
  );
}

function NewMenu() {
  const quickCreate = useQuickCreate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" className="ml-1 gap-1.5 shadow-card" />}>
        <Plus className="size-4" />
        <span className="hidden sm:inline">Nuovo</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        {QUICK_CREATE_ITEMS.map((item) => (
          <DropdownMenuItem key={item.kind} onClick={() => quickCreate(item.kind)} className="items-start gap-2.5 py-2">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <item.icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="block text-xs text-muted-foreground">{item.hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
