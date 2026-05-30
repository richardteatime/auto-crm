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
          "flex items-center gap-2 px-3 py-2 rounded-md border",
          isPaid
            ? "bg-success/10 border-success/20"
            : "bg-warning/10 border-warning/20"
        )}
      >
        {isPaid ? (
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
        ) : (
          <Circle className="h-4 w-4 text-warning shrink-0" />
        )}
        <span
          className={cn(
            "text-sm font-medium",
            isPaid ? "text-success" : "text-warning"
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
