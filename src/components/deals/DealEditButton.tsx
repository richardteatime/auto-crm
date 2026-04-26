"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { DealForm, type DealInitialData } from "./DealForm";

interface DealEditButtonProps {
  deal: DealInitialData;
}

export function DealEditButton({ deal }: DealEditButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        className="cursor-pointer gap-2"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-4 w-4" />
        Modifica
      </Button>
      <DealForm open={open} onClose={() => setOpen(false)} initialData={deal} />
    </>
  );
}
