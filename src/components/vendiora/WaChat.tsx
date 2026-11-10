"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bot, Hand, Loader2, Play, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BOT_STATE_LABELS, type Conversation, type WaMessage } from "@/lib/vendiora/types";
import { api, fmtDate } from "./ui";

/** WhatsApp thread of one lead: history (bot, team, phone, lead), reply box, bot start/stop */
export function WaChat({ leadId, height = "h-[420px]" }: { leadId: string; height?: string }) {
  const [msgs, setMsgs] = useState<WaMessage[] | null>(null);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(() => api<{ messages: WaMessage[]; conversation: Conversation | null }>(`/api/vendiora/chat?leadId=${leadId}`)
    .then((r) => { setMsgs(r.messages); setConv(r.conversation); })
    .catch(() => setMsgs((m) => m ?? [])), [leadId]);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs?.length]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try { await api("/api/vendiora/wa/send", { json: { leadId, text } }); setText(""); await load(); } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }
  async function bot(action: "start" | "stop") {
    if (action === "start" && conv && !confirm("Far ripartire il bot da capo con questo lead?")) return;
    try { await api("/api/vendiora/wa/bot", { json: { leadId, action } }); toast.success(action === "start" ? "Bot avviato" : "Bot fermato"); load(); } catch (err) { toast.error((err as Error).message); }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
        <span className="flex items-center gap-1.5 text-muted-foreground"><Bot className="size-3.5" />{conv ? BOT_STATE_LABELS[conv.state] : "Il bot non ha ancora scritto"}</span>
        <span className="flex gap-1">
          {conv && (conv.state === "attivo" || conv.state === "in_attesa") && <Button size="xs" variant="outline" onClick={() => bot("stop")}><Hand /> Prendo io</Button>}
          <Button size="xs" variant="ghost" onClick={() => bot("start")}><Play /> {conv ? "Riavvia bot" : "Avvia bot"}</Button>
        </span>
      </div>
      <div ref={box} className={cn("space-y-1.5 overflow-y-auto rounded-lg bg-[#efeae2] p-3 dark:bg-[#0b141a]", height)}>
        {!msgs && <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>}
        {msgs && msgs.length === 0 && <p className="pt-16 text-center text-[13px] text-[#54656f] dark:text-[#8696a0]">Nessun messaggio. Scrivi tu o avvia il bot.</p>}
        {msgs?.map((m) => (
          <div key={m.id} className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-lg px-2.5 py-1.5 text-[13px] leading-snug shadow-sm", m.direction === "out" ? "rounded-tr-none bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]" : "rounded-tl-none bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]")}>
              {m.direction === "out" && m.author && <span className="mb-0.5 block text-[10.5px] font-semibold opacity-60">{m.author === "bot" ? "🤖 Bot" : m.author === "telefono" ? "📱 dal telefono" : m.author}</span>}
              <span className="whitespace-pre-wrap break-words">{m.text}</span>
              <span className="ml-2 float-right mt-1 text-[10px] opacity-50">{fmtDate(m.at, true)}</span>
            </div>
          </div>
        ))}
      </div>
      {conv && conv.answers.length > 0 && (
        <details className="rounded-lg border bg-muted/30 px-3 py-2 text-[13px]">
          <summary className="cursor-pointer font-semibold">Risposte alla qualifica ({conv.answers.length})</summary>
          <dl className="mt-2 space-y-2">{conv.answers.map((a, i) => <div key={i}><dt className="text-muted-foreground">{a.q}</dt><dd className="whitespace-pre-wrap font-medium">{a.a}</dd></div>)}</dl>
        </details>
      )}
      <form onSubmit={send} className="flex items-end gap-2">
        <textarea
          rows={1}
          className="max-h-32 min-h-9 flex-1 resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          placeholder="Scrivi su WhatsApp…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Invia">{busy ? <Loader2 className="animate-spin" /> : <Send />}</Button>
      </form>
    </div>
  );
}
