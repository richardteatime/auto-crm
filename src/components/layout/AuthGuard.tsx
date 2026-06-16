"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const AUTH_ROUTES = ["/login", "/register"];

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    fetch("/api/auth/me")
      .then((res) => {
        if (!mounted) return;
        const authenticated = res.ok;

        if (!authenticated && !isAuthRoute(pathname)) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        } else if (authenticated && isAuthRoute(pathname)) {
          router.replace("/");
        }
      })
      .catch(() => {
        if (!mounted && !isAuthRoute(pathname)) return;
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      })
      .finally(() => {
        if (mounted) setChecked(true);
      });

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (!checked) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
