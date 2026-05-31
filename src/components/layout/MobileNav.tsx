"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SheetClose } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Users,
  Kanban,
  Activity,
  Settings,
  Briefcase,
  MessageSquare,
  FileText,
  TrendingUp,
  Target,
  GitBranch,
  CalendarDays,
  Bell,
  Bot,
  CheckSquare,
  Inbox,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/components/shared/NotificationContext";

type BadgeKey = "activities" | "timeline" | "calendar" | "chat" | "total";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: BadgeKey;
}

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Vendite",
    items: [
      { href: "/leads", label: "Lead", icon: Inbox },
      { href: "/pipeline", label: "Pipeline", icon: Kanban },
      { href: "/contacts", label: "Contatti", icon: Users },
      { href: "/deals", label: "Trattative", icon: Briefcase },
      { href: "/opportunita", label: "Opportunità", icon: Target },
    ],
  },
  {
    label: "Operativo",
    items: [
      { href: "/activities", label: "Attività", icon: Activity, badge: "activities" as const },
      { href: "/tasks", label: "Task", icon: CheckSquare },
      { href: "/calendar", label: "Calendario", icon: CalendarDays, badge: "calendar" as const },
      { href: "/timeline", label: "Timeline", icon: GitBranch, badge: "timeline" as const },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/preventivi", label: "Preventivi", icon: FileText },
      { href: "/finance", label: "Finance", icon: TrendingUp },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/notifications", label: "Notifiche", icon: Bell, badge: "total" as const },
      { href: "/messages", label: "Chat Team", icon: MessageSquare, badge: "chat" as const },
      { href: "/orchestrator", label: "Orchestrator", icon: Bot },
      { href: "/settings", label: "Impostazioni", icon: Settings },
    ],
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { counts } = useNotifications();

  const isDashboardActive = pathname === "/";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex h-14 items-center gap-2 px-4 border-b">
        <Briefcase className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold tracking-tight">SarconX</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        <SheetClose
          render={
            <Link
              href="/"
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                isDashboardActive
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            />
          }
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span>Dashboard</span>
        </SheetClose>

        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const badgeCount = item.badge ? counts[item.badge] : 0;
                return (
                  <SheetClose
                    key={item.href}
                    render={
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                      />
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {badgeCount > 0 && (
                      <span className="ml-auto h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
                  </SheetClose>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t">
        <SheetClose
          render={
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            />
          }
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Esci
        </SheetClose>
      </div>
    </div>
  );
}
