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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/components/shared/NotificationContext";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, badge: null as null | "activities" | "timeline" },
  { href: "/pipeline", label: "Pipeline", icon: Kanban, badge: null },
  { href: "/contacts", label: "Contatti", icon: Users, badge: null },
  { href: "/deals", label: "Trattative", icon: Briefcase, badge: null },
  { href: "/opportunita", label: "Opportunità", icon: Target, badge: null },
  { href: "/activities", label: "Attività", icon: Activity, badge: "activities" as const },
  { href: "/calendar", label: "Calendario", icon: CalendarDays, badge: null },
  { href: "/timeline", label: "Timeline", icon: GitBranch, badge: "timeline" as const },
  { href: "/messages", label: "Chat Team", icon: MessageSquare, badge: null },
  { href: "/preventivi", label: "Preventivi", icon: FileText, badge: null },
  { href: "/finance", label: "Finance", icon: TrendingUp, badge: null },
  { href: "/settings", label: "Impostazioni", icon: Settings, badge: null },
];

export function MobileNav() {
  const pathname = usePathname();
  const { counts } = useNotifications();

  return (
    <div className="flex flex-col h-full bg-[var(--sidebar)] text-[var(--sidebar-foreground)]">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-[var(--sidebar-border)]">
        <Briefcase className="h-6 w-6 text-[var(--sidebar-primary)]" />
        <span className="text-lg font-bold tracking-tight whitespace-nowrap">SarconX CRM</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const badgeCount = item.badge ? counts[item.badge] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                isActive
                  ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]"
                  : "text-[var(--sidebar-foreground)]/70 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {badgeCount > 0 && (
                <span className="ml-auto h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
