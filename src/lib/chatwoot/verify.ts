import { createHmac, timingSafeEqual } from "crypto";

const CHATWOOT_WEBHOOK_SECRET = process.env.CHATWOOT_WEBHOOK_SECRET || "";

/**
 * Verify Chatwoot webhook signature if a secret is configured.
 * Supports both HMAC-SHA256 signature and simple secret header.
 */
export function verifyChatwootWebhook(
  payload: string,
  signatureHeader?: string | null,
  secretHeader?: string | null,
): boolean {
  // If no secret is configured, allow all (warn in logs)
  if (!CHATWOOT_WEBHOOK_SECRET) {
    return true;
  }

  // Check HMAC signature if present
  if (signatureHeader) {
    const expected = createHmac("sha256", CHATWOOT_WEBHOOK_SECRET)
      .update(payload)
      .digest("hex");

    try {
      if (
        timingSafeEqual(
          Buffer.from(signatureHeader, "hex"),
          Buffer.from(expected, "hex"),
        )
      ) {
        return true;
      }
    } catch {
      // signature mismatch or invalid hex
      return false;
    }
  }

  // Fallback: simple secret header check
  if (secretHeader && secretHeader === CHATWOOT_WEBHOOK_SECRET) {
    return true;
  }

  return false;
}
