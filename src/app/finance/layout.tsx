"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

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
