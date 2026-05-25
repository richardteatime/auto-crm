"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useModules } from "@/lib/hooks/useModules";

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { enabled, loading } = useModules();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  if (!enabled?.includes("finance")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h2 className="text-xl font-semibold">Modulo disabilitato</h2>
        <p className="text-muted-foreground mt-2">
          Il modulo Finance non è attivo per questo cliente.
        </p>
      </div>
    );
  }

  useEffect(() => {
    let mounted = true;

    // Verify finance session on mount
    fetch("/api/finance/auth")
      .then((res) => {
        if (!res.ok && mounted) {
          router.push("/finance-login");
        }
      })
      .catch(() => {
        if (mounted) router.push("/finance-login");
      });

    // Clear finance session when leaving /finance/*
    return () => {
      mounted = false;
      fetch("/api/finance/auth", { method: "DELETE", keepalive: true });
    };
  }, [router]);

  return <>{children}</>;
}
