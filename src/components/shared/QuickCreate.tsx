"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { UserPlus, Handshake, ListPlus, type LucideIcon } from "lucide-react";
import { ContactForm } from "@/components/contacts/ContactForm";
import { DealForm } from "@/components/deals/DealForm";
import { ActivityForm } from "@/components/activities/ActivityForm";

export type QuickCreateKind = "contact" | "deal" | "activity";

export const QUICK_CREATE_ITEMS: Array<{
  kind: QuickCreateKind;
  label: string;
  hint: string;
  icon: LucideIcon;
}> = [
  { kind: "contact", label: "Nuovo contatto", hint: "Lead, cliente o azienda", icon: UserPlus },
  { kind: "deal", label: "Nuova trattativa", hint: "Un'opportunità di vendita", icon: Handshake },
  { kind: "activity", label: "Nuova attività", hint: "Chiamata, email, follow-up", icon: ListPlus },
];

/** Fired on window after a quick-create dialog closes, so client-fetched lists can reload */
export const CRM_REFRESH_EVENT = "crm:refresh";

const QuickCreateContext = createContext<(kind: QuickCreateKind) => void>(() => {});

export function QuickCreateProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<QuickCreateKind | null>(null);

  const close = useCallback(() => {
    setOpen(null);
    window.dispatchEvent(new CustomEvent(CRM_REFRESH_EVENT, { detail: { kind: open } }));
  }, [open]);

  return (
    <QuickCreateContext.Provider value={setOpen}>
      {children}
      {open === "contact" && <ContactForm open onClose={close} />}
      {open === "deal" && <DealForm open onClose={close} />}
      {open === "activity" && <ActivityForm open onClose={close} />}
    </QuickCreateContext.Provider>
  );
}

export function useQuickCreate() {
  return useContext(QuickCreateContext);
}
