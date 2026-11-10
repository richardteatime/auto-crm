// Client for the WhatsApp gateway (wa-gateway/ in this repo, its own Coolify app).
const URL_ = (process.env.WA_GATEWAY_URL || "").replace(/\/$/, "");
const SECRET = process.env.WA_GATEWAY_SECRET || "";

export function waConfigured(): boolean {
  return !!(URL_ && SECRET);
}

export interface WaStatus {
  status: "disconnected" | "connecting" | "reconnecting" | "qr" | "connected" | "logged_out" | "not_configured" | "unreachable";
  reason: string | null;
  phone: string | null;
  qr: string | null;
}

async function call<T>(path: string, init?: RequestInit): Promise<{ status: number; data: T }> {
  const res = await fetch(`${URL_}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-WA-Secret": SECRET, ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(25_000),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}

export async function waStatus(): Promise<WaStatus> {
  if (!waConfigured()) return { status: "not_configured", reason: null, phone: null, qr: null };
  try {
    return (await call<WaStatus>("/status")).data;
  } catch {
    return { status: "unreachable", reason: "Il servizio WhatsApp non risponde", phone: null, qr: null };
  }
}

export async function waAction(action: "connect" | "logout"): Promise<WaStatus> {
  if (!waConfigured()) return { status: "not_configured", reason: null, phone: null, qr: null };
  return (await call<WaStatus>(`/${action}`, { method: "POST" })).data;
}

export class WaSendError extends Error {
  constructor(message: string, public code: number) { super(message); }
}

export async function waSend(phoneE164: string, text: string): Promise<{ chatId: string; lid: string | null; id: string | null }> {
  if (!waConfigured()) throw new WaSendError("WhatsApp non è configurato", 503);
  const r = await call<{ ok?: boolean; chatId?: string; lid?: string | null; id?: string | null; error?: string }>("/send", {
    method: "POST",
    body: JSON.stringify({ phone: phoneE164, text }),
  });
  if (r.status !== 200 || !r.data.ok) throw new WaSendError(r.data.error || `Invio fallito (${r.status})`, r.status);
  return { chatId: r.data.chatId!, lid: r.data.lid ?? null, id: r.data.id ?? null };
}

export function waInboundAuthorized(header: string | null): boolean {
  if (!SECRET || !header || header.length !== SECRET.length) return false;
  let diff = 0;
  for (let i = 0; i < SECRET.length; i++) diff |= SECRET.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}
