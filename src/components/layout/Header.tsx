"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, LogOut, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MobileNav } from "./MobileNav";
import { WHITE_LABEL } from "@/lib/white-label";
import { useRouter } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/pipeline": "Pipeline",
  "/contacts": "Contatti",
  "/deals": "Trattative",
  "/opportunita": "Opportunità",
  "/activities": "Attività",
  "/calendar": "Calendario",
  "/timeline": "Timeline",
  "/preventivi": "Preventivi",
  "/finance": "Finance",
  "/finance/fatturato": "Fatturato",
  "/finance/mrr": "MRR",
  "/finance/spese": "Spese",
  "/notifications": "Notifiche",
  "/messages": "Chat Team",
  "/users": "Team",
  "/settings": "Impostazioni",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Fallback for nested routes like /contacts/[id]
  const base = "/" + pathname.split("/")[1];
  return PAGE_TITLES[base] || WHITE_LABEL.productName;
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUser({ name: data.name || data.email.split("@")[0], email: data.email });
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-[4.5rem] items-center gap-4 border-b bg-card px-4 md:px-6">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          render={<Button variant="ghost" size="icon" className="md:hidden cursor-pointer" aria-label="Apri menu navigazione" />}
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <MobileNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-2 md:hidden">
        <Briefcase className="h-5 w-5 text-primary" />
        <span className="font-bold tracking-tight">{WHITE_LABEL.productName}</span>
      </div>

      <h1 className="hidden md:block text-lg font-semibold">{getPageTitle(pathname)}</h1>

      <div className="flex-1" />

      {user && (
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-medium leading-none">{user.name}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[180px]">{user.email}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="cursor-pointer"
            onClick={handleLogout}
            title="Esci"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      )}
    </header>
  );
}
