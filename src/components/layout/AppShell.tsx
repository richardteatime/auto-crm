"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { NotificationProvider } from "@/components/shared/NotificationContext";
import { CommandPalette } from "@/components/shared/CommandPalette";

const AUTH_ROUTES = ["/login", "/register"];

// Public capture surfaces render full-bleed, with no dashboard chrome.
const STANDALONE_PREFIXES = ["/l/", "/form/", "/book/", "/f/"];

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

function isStandaloneRoute(pathname: string): boolean {
  return STANDALONE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [commandOpen, setCommandOpen] = useState(false);

  if (isStandaloneRoute(pathname)) {
    return <div className="w-full min-h-screen">{children}</div>;
  }

  if (isAuthRoute(pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        {children}
      </div>
    );
  }

  return (
    <NotificationProvider>
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <Header onOpenCommandPalette={() => setCommandOpen(true)} />
        <main className="flex-1 p-4 md:p-5 bg-background overflow-y-auto overflow-x-hidden pb-20 md:pb-5">
          {children}
        </main>
      </div>
      <BottomNav />
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </NotificationProvider>
  );
}
