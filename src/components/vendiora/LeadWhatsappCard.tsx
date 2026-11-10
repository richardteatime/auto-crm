"use client";

import { MessageCircle } from "lucide-react";
import { WaChat } from "./WaChat";

export function LeadWhatsappCard({ leadId }: { leadId: string }) {
  return (
    <section className="rounded-xl border bg-card shadow-card">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <MessageCircle className="size-4 text-emerald-600" />
        <h2 className="text-sm font-semibold">WhatsApp</h2>
      </header>
      <div className="p-4"><WaChat leadId={leadId} height="h-[340px]" /></div>
    </section>
  );
}
