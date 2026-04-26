"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, MessageSquare, User } from "lucide-react";
import { formatRelativeDate } from "@/lib/constants";
import { toast } from "sonner";

interface Message {
  id: string;
  author: string;
  content: string;
  createdAt: number | Date;
}

const AUTHOR_KEY = "crm-display-name";

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load display name from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(AUTHOR_KEY);
    if (saved) setAuthor(saved);
  }, []);

  const saveName = () => {
    const name = nameInput.trim();
    if (!name) return;
    localStorage.setItem(AUTHOR_KEY, name);
    setAuthor(name);
    setNameInput("");
  };

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadMessages = useCallback(async (isInitial = false) => {
    try {
      const url = isInitial
        ? "/api/messages"
        : `/api/messages?since=${lastTimestampRef.current}`;
      const res = await fetch(url);
      const data: Message[] = await res.json();

      if (isInitial) {
        setMessages(data);
        setLoading(false);
        if (data.length > 0) {
          lastTimestampRef.current = new Date(data[data.length - 1].createdAt).getTime();
        }
        setTimeout(scrollToBottom, 50);
      } else if (data.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = data.filter((m) => !existingIds.has(m.id));
          if (newMsgs.length === 0) return prev;
          lastTimestampRef.current = new Date(newMsgs[newMsgs.length - 1].createdAt).getTime();
          setTimeout(scrollToBottom, 50);
          return [...prev, ...newMsgs];
        });
      }
    } catch {
      if (isInitial) setLoading(false);
    }
  }, [scrollToBottom]);

  // Initial load + polling every 4 seconds
  useEffect(() => {
    loadMessages(true);
    const interval = setInterval(() => loadMessages(false), 4000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !author) return;

    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, content: content.trim() }),
      });
      if (!res.ok) throw new Error();
      const msg: Message = await res.json();
      setMessages((prev) => [...prev, msg]);
      lastTimestampRef.current = new Date(msg.createdAt).getTime();
      setContent("");
      setTimeout(scrollToBottom, 50);
      inputRef.current?.focus();
    } catch {
      toast.error("Errore nell'invio del messaggio");
    } finally {
      setSending(false);
    }
  };

  // Name setup screen
  if (!author) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5" />
              Come ti chiami?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Scegli un nome visualizzato per la chat del team. Sarà visibile a tutti i colleghi.
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); saveName(); }}
              className="flex gap-2"
            >
              <Input
                autoFocus
                placeholder="Es: Marco Rossi"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
              <Button type="submit" disabled={!nameInput.trim()} className="cursor-pointer">
                Entra
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chat Team</h1>
          <p className="text-muted-foreground">
            Comunica con i tuoi colleghi in tempo reale
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>{author}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs cursor-pointer h-7 px-2"
            onClick={() => {
              localStorage.removeItem(AUTHOR_KEY);
              setAuthor("");
            }}
          >
            Cambia
          </Button>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                Nessun messaggio ancora
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Inizia la conversazione con il tuo team!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.author === author;
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary"
                  >
                    {msg.author.charAt(0).toUpperCase()}
                  </div>
                  <div className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                    <div className={`flex items-center gap-1 mb-1 ${isMe ? "flex-row-reverse" : ""}`}>
                      <span className="text-xs font-medium">{isMe ? "Tu" : msg.author}</span>
                      <span className="text-xs text-muted-foreground">
                        · {formatRelativeDate(msg.createdAt)}
                      </span>
                    </div>
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted rounded-tl-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </CardContent>

        <div className="border-t p-3">
          <form onSubmit={sendMessage} className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="Scrivi un messaggio..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={sending}
              autoComplete="off"
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={sending || !content.trim()}
              className="cursor-pointer"
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
