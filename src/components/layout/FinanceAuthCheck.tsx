"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FinanceAuthCheck({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    fetch("/api/finance/auth")
      .then((res) => {
        if (!res.ok && mounted) {
          router.push("/finance-login");
        }
      })
      .catch(() => {
        if (mounted) router.push("/finance-login");
      });

    return () => {
      mounted = false;
    };
  }, [router]);

  return <>{children}</>;
}
