"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MobileNav } from "./MobileNav";
import {
  LayoutDashboard,
  Users,
  Activity,
  CalendarDays,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const items: BottomNavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contacts", label: "Contatti", icon: Users },
  { href: "/activities", label: "Attività", icon: Activity },
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}

        <Sheet>
          <SheetTrigger
            render={<button className="flex flex-col items-center justify-center gap-0.5 w-16 h-full text-muted-foreground hover:text-foreground transition-colors" />}
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] font-medium">Altro</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-72 p-0">
            <MobileNav />
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
