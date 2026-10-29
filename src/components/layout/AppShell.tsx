"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/MobileNav";
import { NotificationProvider } from "@/components/shared/NotificationContext";
import { CurrentUserProvider } from "@/components/shared/CurrentUserContext";
import { QuickCreateProvider } from "@/components/shared/QuickCreate";
import { CommandPaletteProvider } from "@/components/shared/CommandPalette";

const AUTH_ROUTES = ["/login", "/register"];

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // On desktop the page scrolls inside the panel, which survives navigation: start each page at the top
  useEffect(() => {
    const panel = document.getElementById("main-scroll");
    if (panel) panel.scrollTop = 0;
  }, [pathname]);

  // Sign-in pages draw their own full-screen layout
  if (isAuthRoute(pathname)) return <>{children}</>;

  return (
    <NotificationProvider>
      <CurrentUserProvider>
        <QuickCreateProvider>
          <CommandPaletteProvider>
            <div className="flex min-h-dvh w-full md:h-dvh md:overflow-hidden">
              <Sidebar />
              {/* The page sits on an inset panel; on desktop it scrolls on its own */}
              <div className="flex min-w-0 flex-1 flex-col md:py-2 md:pr-2">
                <div
                  id="main-scroll"
                  className="flex min-h-0 flex-1 flex-col bg-background md:overflow-y-auto md:rounded-xl md:border md:shadow-panel md:scrollbar-thin"
                >
                  <Header />
                  <main className="flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-7">
                    <div key={pathname} className="mx-auto w-full max-w-[1440px] scroll-mt-20 animate-fade-up">
                      {children}
                    </div>
                  </main>
                </div>
              </div>
              <BottomNav />
            </div>
          </CommandPaletteProvider>
        </QuickCreateProvider>
      </CurrentUserProvider>
    </NotificationProvider>
  );
}
