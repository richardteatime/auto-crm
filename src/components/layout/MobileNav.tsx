"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Sun, SquareKanban, Users, ListChecks, LayoutGrid, LogOut, Search } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/components/shared/NotificationContext";
import { useCommandPalette } from "@/components/shared/CommandPalette";
import { useCurrentUser } from "@/components/shared/CurrentUserContext";
import { ContactAvatar } from "@/components/shared/ContactAvatar";
import { ThemeSwitch } from "@/components/shared/ThemeProvider";
import { BrandMark } from "./BrandMark";
import { logout } from "./UserMenu";
import { NAV_SECTIONS, SETTINGS_ITEM, isActivePath } from "./nav-config";

const TABS = [
  { href: "/", label: "Oggi", icon: Sun },
  { href: "/pipeline", label: "Pipeline", icon: SquareKanban },
  { href: "/contacts", label: "Contatti", icon: Users },
  { href: "/activities", label: "Attività", icon: ListChecks, badge: "activities" as const },
];

/** Bottom tab bar for phones, with the full menu in a sheet */
export function BottomNav() {
  const pathname = usePathname();
  const { counts } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);

  const inTabs = TABS.some((t) => isActivePath(pathname, t.href));

  return (
    <>
      <nav
        aria-label="Navigazione rapida"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <ul className="grid grid-cols-5">
          {TABS.map((tab) => {
            const active = isActivePath(pathname, tab.href);
            const count = tab.badge ? counts[tab.badge] : 0;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <tab.icon className="size-5" />
                  {tab.label}
                  {count > 0 && (
                    <span className="absolute left-1/2 top-2 ml-2 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-4 text-primary-foreground">
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className={cn(
                "relative flex h-14 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                !inTabs ? "text-primary" : "text-muted-foreground"
              )}
            >
              <LayoutGrid className="size-5" />
              Altro
              {counts.total > 0 && <span className="absolute left-1/2 top-2.5 ml-2 size-2 rounded-full bg-primary" />}
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[86vw] max-w-xs gap-0 bg-sidebar p-0">
          <MobileNav onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

export function MobileNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { counts } = useNotifications();
  const openPalette = useCommandPalette();
  const user = useCurrentUser();

  return (
    <div className="flex h-full flex-col text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <BrandMark className="size-7" />
        <SheetTitle className="text-[15px] font-extrabold tracking-tight">
          Sarcon<span className="text-primary">X</span>{" "}
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">CRM</span>
        </SheetTitle>
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            openPalette();
          }}
          className="flex h-9 w-full items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-card"
        >
          <Search className="size-4" />
          Cerca contatti, trattative…
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4 scrollbar-thin">
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.label ?? i}>
            {section.label && (
              <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {[...section.items, ...(i === NAV_SECTIONS.length - 1 ? [SETTINGS_ITEM] : [])].map((item) => {
                const active = isActivePath(pathname, item.href);
                const count = item.badge ? counts[item.badge] : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-10 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors",
                        active ? "bg-card text-foreground shadow-card dark:bg-sidebar-accent" : "hover:bg-sidebar-accent"
                      )}
                    >
                      <item.icon className={cn("size-[18px]", active ? "text-primary" : "text-muted-foreground")} />
                      <span className="flex-1">{item.label}</span>
                      {count > 0 && (
                        <span className="rounded-full bg-primary/12 px-1.5 text-[11px] font-semibold leading-5 text-primary">
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-sidebar-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-muted-foreground">Tema</span>
          <ThemeSwitch />
        </div>
        <div className="flex items-center gap-2.5 rounded-lg bg-card p-2 shadow-card dark:bg-sidebar-accent">
          <ContactAvatar name={user?.name ?? "?"} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.name ?? "Il tuo account"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => logout(router)}
            aria-label="Esci"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
