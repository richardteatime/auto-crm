import { NextRequest, NextResponse } from "next/server";
import { verifyChatwootWebhook } from "@/lib/chatwoot/verify";
import { normalizeChatwootMessage } from "@/lib/chatwoot/normalize-message";
import { createChatwootMessage } from "@/lib/db/chatwoot-messages";
import { sendChatwootMessage } from "@/lib/chatwoot/client";
import { checkMessagePermission } from "@/lib/orchestrator/permissions";
import { logWorkflowEvent } from "@/lib/orchestrator/logger";
import { handleCommand } from "@/lib/orchestrator/router";
import type { ChatwootMessagePayload } from "@/lib/chatwoot/types";

/**
 * Chatwoot webhook endpoint.
 *
 * Handles:
 * - message_created events
 * - Ignores outbound messages (avoid loops)
 * - Validates webhook secret if configured
 * - Normalizes and saves inbound messages
 * - Permission check (Phase 2): blocks non-admin senders
 * - Orchestrator routing (Phase 3): classifies intent and executes
 */

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const WEBHOOK_RATE_LIMIT = 60;
const WEBHOOK_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WEBHOOK_WINDOW_MS });
    return true;
  }
  if (entry.count >= WEBHOOK_RATE_LIMIT) {
    return false;
  }
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Troppe richieste. Riprova più tardi." },
      { status: 429 },
    );
  }

  const rawBody = await request.text();

  // Verify webhook signature/secret
  const signatureHeader = request.headers.get("x-chatwoot-signature");
  const secretHeader = request.headers.get("x-webhook-secret");

  if (!verifyChatwootWebhook(rawBody, signatureHeader, secretHeader)) {
    return NextResponse.json(
      { error: "Secret non valido o mancante" },
      { status: 401 },
    );
  }

  let payload: ChatwootMessagePayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  // Only handle message_created events for now
  if (payload.event !== "message_created") {
    return NextResponse.json({ ignored: true, reason: "event_not_supported" });
  }

  // Ignore outbound messages to avoid loops
  if (payload.message_type === "outgoing") {
    return NextResponse.json({ ignored: true, reason: "outbound_message" });
  }

  // Ignore empty content
  if (!payload.content?.trim()) {
    return NextResponse.json({ ignored: true, reason: "empty_content" });
  }

  try {
    const normalized = normalizeChatwootMessage(payload);

    // Save to chatwoot_messages collection
    // If collection doesn't exist yet (Phase 4), log gracefully
    let saved: unknown = null;
    try {
      saved = await createChatwootMessage(normalized);
    } catch (dbErr) {
      console.error(
        "[chatwoot/webhook] Failed to save message (collection may not exist yet):",
        dbErr instanceof Error ? dbErr.message : dbErr,
      );
    }

    // Phase 2 — Permission check
    const permission = checkMessagePermission(normalized.senderPhone);

    if (!permission.allowed) {
      // Reply to Chatwoot with block message
      await sendChatwootMessage(
        normalized.conversationId,
        permission.reason ?? "Questo canale al momento è riservato ai comandi interni SarconX.",
      );

      await logWorkflowEvent({
        eventType: "unauthorized",
        message: `Bloccato messaggio da ${normalized.senderPhone || "numero sconosciuto"} (${permission.role})`,
        metadata: {
          senderPhone: normalized.senderPhone,
          senderName: normalized.senderName,
          role: permission.role,
          conversationId: normalized.conversationId,
          messageText: normalized.messageText,
        },
      });

      return NextResponse.json({
        blocked: true,
        reason: permission.reason,
        role: permission.role,
      });
    }

    // Phase 3 — Forward to orchestrator
    const result = await handleCommand({
      senderPhone: normalized.senderPhone,
      senderName: normalized.senderName,
      conversationId: normalized.conversationId,
      messageText: normalized.messageText,
      source: "chatwoot",
    });

    return NextResponse.json({
      success: result.success,
      messageId: payload.id,
      conversationId: payload.conversation.id,
      role: permission.role,
      intent: result.intent,
      runId: result.runId,
      saved: !!saved,
    });
  } catch (err) {
    console.error("[chatwoot/webhook] Error:", err);
    return NextResponse.json(
      { error: "Errore nel processare il messaggio" },
      { status: 500 },
    );
  }
}
