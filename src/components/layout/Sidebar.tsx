"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/components/shared/NotificationContext";
import { useCommandPalette, Kbd } from "@/components/shared/CommandPalette";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BrandMark } from "./BrandMark";
import { UserMenu } from "./UserMenu";
import { NAV_SECTIONS, SETTINGS_ITEM, isActivePath, type NavItem } from "./nav-config";
import { toggleSidebar } from "./sidebar-state";

export function Sidebar() {
  const pathname = usePathname();
  const { counts } = useNotifications();
  const openPalette = useCommandPalette();

  // "[" collapses / expands, like most pro tools
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
      if (e.key === "[" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) toggleSidebar();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <aside
      aria-label="Navigazione principale"
      className="hidden h-dvh w-[248px] shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out md:flex sidebar-collapsed:w-[68px]"
    >
      <div className="flex h-14 items-center gap-2 px-4 sidebar-collapsed:justify-center sidebar-collapsed:px-0">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <BrandMark className="size-7" />
          <span className="flex items-baseline gap-1.5 truncate sidebar-collapsed:hidden">
            <span className="text-[15px] font-extrabold tracking-tight text-foreground">
              Sarcon<span className="text-primary">X</span>
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">CRM</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Comprimi la barra laterale"
          title="Comprimi (tasto [)"
          className="ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground sidebar-collapsed:hidden"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      <div className="px-3 pb-3 sidebar-collapsed:px-2.5">
        <button
          type="button"
          onClick={openPalette}
          className="flex h-8 w-full items-center gap-2 rounded-lg border bg-card px-2.5 text-[13px] text-muted-foreground shadow-card transition-colors hover:border-input hover:text-foreground sidebar-collapsed:justify-center sidebar-collapsed:px-0"
          aria-label="Cerca nel CRM"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="sidebar-collapsed:hidden">Cerca…</span>
          <span className="ml-auto flex gap-0.5 sidebar-collapsed:hidden">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-1 scrollbar-thin sidebar-collapsed:px-2.5">
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.label ?? i}>
            {section.label && (
              <>
                <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80 sidebar-collapsed:hidden">
                  {section.label}
                </p>
                <div className="mx-auto mb-2 hidden h-px w-6 bg-sidebar-border sidebar-collapsed:block" />
              </>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  active={isActivePath(pathname, item.href)}
                  count={item.badge ? counts[item.badge] : 0}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-3 sidebar-collapsed:px-2.5">
        <ul>
          <SidebarLink item={SETTINGS_ITEM} active={isActivePath(pathname, SETTINGS_ITEM.href)} count={0} />
        </ul>
        <UserMenu />
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Espandi la barra laterale"
          title="Espandi (tasto [)"
          className="hidden h-8 w-full items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground sidebar-collapsed:flex"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({ item, active, count }: { item: NavItem; active: boolean; count: number }) {
  const Icon = item.icon;
  const badge = count > 99 ? "99+" : String(count);

  return (
    <li>
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sidebar-collapsed:justify-center sidebar-collapsed:px-0",
                active
                  ? "bg-card text-foreground shadow-card dark:bg-sidebar-accent"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            />
          }
        >
          <Icon
            className={cn(
              "size-[17px] shrink-0 transition-colors",
              active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )}
          />
          <span className="flex-1 truncate sidebar-collapsed:hidden">{item.label}</span>
          {count > 0 && (
            <>
              <span className="ml-auto min-w-5 rounded-full bg-primary/12 px-1.5 text-center text-[11px] font-semibold leading-5 tabular-nums text-primary sidebar-collapsed:hidden">
                {badge}
              </span>
              <span className="absolute right-2 top-1.5 hidden size-2 rounded-full bg-primary ring-2 ring-sidebar sidebar-collapsed:block" />
              <span className="sr-only">{badge} da vedere</span>
            </>
          )}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="sidebar-expanded:hidden">
          {item.label}
          {count > 0 ? ` · ${badge}` : ""}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}
