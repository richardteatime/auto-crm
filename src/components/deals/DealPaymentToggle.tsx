"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface DealPaymentToggleProps {
  dealId: string;
  isPaid: boolean;
}

export function DealPaymentToggle({ dealId, isPaid: initial }: DealPaymentToggleProps) {
  const [isPaid, setIsPaid] = useState(initial);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaid: !isPaid }),
      });
      if (!res.ok) throw new Error();
      setIsPaid((p) => !p);
      toast.success(!isPaid ? "Trattativa segnata come pagata" : "Segnata come non pagata");
      router.refresh();
    } catch {
      toast.error("Errore durante l'aggiornamento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border",
          isPaid
            ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
            : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
        )}
      >
        {isPaid ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        ) : (
          <Circle className="h-4 w-4 text-amber-500 shrink-0" />
        )}
        <span
          className={cn(
            "text-sm font-medium",
            isPaid ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"
          )}
        >
          {isPaid ? "Pagato" : "Non pagato"}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full cursor-pointer"
        onClick={toggle}
        disabled={loading}
      >
        {loading ? "..." : isPaid ? "Segna come non pagato" : "Segna come pagato"}
      </Button>
    </div>
  );
}
