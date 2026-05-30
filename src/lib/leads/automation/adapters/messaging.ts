// ---------------------------------------------------------------------------
// MessagingAdapter — WhatsApp / internal messaging.
// MVP: NOT configured. Per PLAN security rule, never crash if no adapter —
// log the exact required line and continue. A real provider can be wired in
// later (e.g. WhatsApp Cloud API) behind the same interface.
// ---------------------------------------------------------------------------

const WHATSAPP_TOKEN = process.env.WHATSAPP_API_TOKEN || "";
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || "";

export function isMessagingConfigured(): boolean {
  return !!(WHATSAPP_TOKEN && WHATSAPP_PHONE_ID);
}

export interface SendMessageResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

export async function sendWhatsAppMessage(
  to: string,
  message: string,
): Promise<SendMessageResult> {
  if (!isMessagingConfigured()) {
    console.info("WhatsApp adapter not configured; skipped message.");
    return { ok: false, skipped: true };
  }
  // Real provider integration goes here. Kept as a no-op for the MVP so the
  // surrounding automation flow stays testable without a live WhatsApp account.
  void to;
  void message;
  console.info("WhatsApp adapter configured but no provider implementation; skipped message.");
  return { ok: false, skipped: true };
}

export function sendInternalMessage(
  to: string,
  message: string,
): Promise<SendMessageResult> {
  return sendWhatsAppMessage(to, message);
}
