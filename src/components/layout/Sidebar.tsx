"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  LogOut,
  Bell,
  Bot,
  CheckSquare,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/components/shared/NotificationContext";

const dashboardItem = { href: "/", label: "Dashboard", icon: LayoutDashboard };

const navGroups = [
  {
    label: "Vendite",
    items: [
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

function NavLink({ item, isActive, badgeCount }: { item: any; isActive: boolean; badgeCount: number }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer",
        isActive
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {badgeCount > 0 && (
        <span className="ml-auto h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { counts } = useNotifications();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isDashboardActive = pathname === "/";

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col bg-card border-r min-h-screen">
      <div className="flex h-14 items-center gap-2 px-4 border-b">
        <Briefcase className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold tracking-tight">SarconX</span>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        <NavLink
          item={dashboardItem}
          isActive={isDashboardActive}
          badgeCount={0}
        />

        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const badgeCount = item.badge ? (counts as any)[item.badge] : 0;
                return (
                  <NavLink
                    key={item.href}
                    item={item}
                    isActive={isActive}
                    badgeCount={badgeCount}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-2 py-3 border-t space-y-0.5">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Esci
        </button>
      </div>
    </aside>
  );
}
