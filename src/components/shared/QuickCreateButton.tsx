"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuickCreate, type QuickCreateKind } from "./QuickCreate";

export function QuickCreateButton({ kind, label }: { kind: QuickCreateKind; label: string }) {
  const quickCreate = useQuickCreate();
  return (
    <Button onClick={() => quickCreate(kind)} className="gap-1.5 shadow-card">
      <Plus className="size-4" />
      {label}
    </Button>
  );
}
