// ---------------------------------------------------------------------------
// EmailAdapter — thin wrapper over Resend (same pattern as /api/digest).
// Graceful: if RESEND_API_KEY is missing, it logs and skips — never throws,
// never blocks an automation. Used for internal notifications (Leo, founder).
// ---------------------------------------------------------------------------

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.LEAD_FROM_EMAIL || process.env.DIGEST_FROM || "SarconX CRM <onboarding@resend.dev>";

// Internal recipients (all optional — fall back down the chain).
const NOTIFY_EMAIL = process.env.LEAD_NOTIFY_EMAIL || process.env.DIGEST_EMAIL || "";
const LEO_EMAIL = process.env.LEO_EMAIL || NOTIFY_EMAIL;
const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || NOTIFY_EMAIL;

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY;
}

export interface SendEmailResult {
  ok: boolean;
  skipped?: boolean;
  id?: string;
  error?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!RESEND_API_KEY) {
    console.info(`[email] not configured; skipped message to ${input.to}`);
    return { ok: false, skipped: true };
  }
  if (!input.to) {
    console.info("[email] no recipient; skipped");
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: [input.to],
        subject: input.subject,
        html: input.html ?? undefined,
        text: input.text ?? undefined,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[email] send failed (${res.status})`);
      return { ok: false, error: detail.slice(0, 300) };
    }
    const data = await res.json();
    return { ok: true, id: data.id };
  } catch (e) {
    console.error("[email] send error:", e instanceof Error ? e.message : e);
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

// Convenience wrappers for the internal recipients used by automations.
export function sendToLeo(subject: string, html: string): Promise<SendEmailResult> {
  return sendEmail({ to: LEO_EMAIL, subject, html });
}

export function sendToFounder(subject: string, html: string): Promise<SendEmailResult> {
  return sendEmail({ to: FOUNDER_EMAIL, subject, html });
}

export function sendToInternalTeam(subject: string, html: string): Promise<SendEmailResult> {
  return sendEmail({ to: NOTIFY_EMAIL, subject, html });
}

export const internalRecipients = {
  team: NOTIFY_EMAIL,
  leo: LEO_EMAIL,
  founder: FOUNDER_EMAIL,
};
