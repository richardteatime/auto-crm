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
  ClipboardList,
  FileText,
  TrendingUp,
  Target,
  LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/contacts", label: "Contatti", icon: Users },
  { href: "/deals", label: "Trattative", icon: Briefcase },
  { href: "/opportunita", label: "Opportunità", icon: Target },
  { href: "/activities", label: "Attività", icon: Activity },
  { href: "/messages", label: "Chat Team", icon: MessageSquare },
  { href: "/tasks", label: "Task", icon: ClipboardList },
  { href: "/preventivi", label: "Preventivi", icon: FileText },
  { href: "/finance", label: "Finance", icon: TrendingUp },
  { href: "/settings", label: "Impostazioni", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] min-h-screen">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-[var(--sidebar-border)]">
        <Briefcase className="h-6 w-6 text-[var(--sidebar-primary)]" />
        <span className="text-lg font-bold tracking-tight whitespace-nowrap">SarconX CRM</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
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
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-[var(--sidebar-border)] space-y-1">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--sidebar-foreground)]/70 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] transition-colors cursor-pointer"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Esci
        </button>
        <p className="text-xs text-[var(--sidebar-foreground)]/50 px-3 pt-2">
          SarconX CRM v1.0
        </p>
      </div>
    </aside>
  );
}
