import { NextRequest, NextResponse } from "next/server";
import { verifyChatwootWebhook } from "@/lib/chatwoot/verify";
import { normalizeChatwootMessage } from "@/lib/chatwoot/normalize-message";
import { createChatwootMessage } from "@/lib/db/chatwoot-messages";
import { sendChatwootMessage } from "@/lib/chatwoot/client";
import { checkInternalCommandPermission } from "@/lib/orchestrator/permissions";
import { logWorkflowEvent } from "@/lib/orchestrator/logger";
import { createRun, updateRun } from "@/lib/orchestrator/runs";
import { callHermes } from "@/lib/hermes/client";
import { buildHermesContextPrompt } from "@/lib/hermes/context";
import type { ChatwootMessagePayload } from "@/lib/chatwoot/types";

/**
 * Chatwoot webhook endpoint — Hermes integration.
 *
 * Handles:
 * - message_created events
 * - Ignores outbound messages (avoid loops)
 * - Validates webhook secret if configured
 * - Normalizes and saves inbound messages
 * - Permission check: allows active CRM operators, with legacy admin fallback
 * - Forwards to Hermes Agent for natural-language CRM interaction
 */

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const WEBHOOK_RATE_LIMIT = 60;
const WEBHOOK_WINDOW_MS = 60_000;

// In-memory session cache: conversationId -> Hermes sessionId
// Persists as long as the Next.js server process is alive.
const hermesSessionMap = new Map<number, string>();

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

  // Ignore bot/CRM messages to avoid loops
  const senderName = payload.sender?.name?.toLowerCase() || "";
  if (senderName.includes("bot") || senderName.includes("crm") || senderName.includes("automation")) {
    return NextResponse.json({ ignored: true, reason: "bot_message" });
  }

  // Ignore empty content
  if (!payload.content?.trim()) {
    return NextResponse.json({ ignored: true, reason: "empty_content" });
  }

  try {
    const normalized = normalizeChatwootMessage(payload);

    // Save to chatwoot_messages collection
    let saved: unknown = null;
    try {
      saved = await createChatwootMessage(normalized);
    } catch (dbErr) {
      console.error(
        "[chatwoot/webhook] Failed to save message (collection may not exist yet):",
        dbErr instanceof Error ? dbErr.message : dbErr,
      );
    }

    // Permission check
    const permission = await checkInternalCommandPermission({
      phone: normalized.senderPhone,
      telegramId: normalized.senderTelegramId,
      chatwootContactId: normalized.chatwootContactId,
    });

    if (!permission.allowed) {
      await sendChatwootMessage(
        normalized.conversationId,
        permission.reason ?? "Questo canale al momento è riservato ai comandi interni SarconX.",
      );

      await logWorkflowEvent({
        eventType: "unauthorized",
        message: `Bloccato messaggio da ${normalized.senderPhone || normalized.senderTelegramId || "mittente sconosciuto"} (${permission.role})`,
        metadata: {
          senderPhone: normalized.senderPhone,
          senderTelegramId: normalized.senderTelegramId,
          senderName: normalized.senderName,
          role: permission.role,
          operatorId: permission.operator?.id ?? null,
          operatorRole: permission.operator?.role ?? null,
          conversationId: normalized.conversationId,
          messageText: normalized.messageText,
        },
      });

      return NextResponse.json({
      blocked: true,
      reason: permission.reason,
      role: permission.role,
      operatorId: permission.operator?.id ?? null,
      });
    }

    // Create audit run
    const run = await createRun({
      source: "chatwoot",
      senderPhone: normalized.senderPhone,
      senderRole: permission.role,
      commandText: normalized.messageText,
      status: "running",
      conversationId: String(normalized.conversationId),
    });
    const runId = run?.id ?? null;

    await logWorkflowEvent({
      runId: runId ?? undefined,
      eventType: "message_received",
      message: `Messaggio ricevuto da ${normalized.senderPhone || "sconosciuto"}`,
      metadata: {
        senderPhone: normalized.senderPhone,
        senderTelegramId: normalized.senderTelegramId,
        senderName: normalized.senderName,
        role: permission.role,
        operatorId: permission.operator?.id ?? null,
        operatorRole: permission.operator?.role ?? null,
        conversationId: normalized.conversationId,
        messageText: normalized.messageText,
      },
    });

    // Forward to Hermes Agent (with CRM context injection)
    let hermesReply: string;
    let hermesSessionId: string | undefined;
    const existingSessionId = hermesSessionMap.get(normalized.conversationId);

    try {
      const promptWithContext = await buildHermesContextPrompt(
        normalized.messageText,
        normalized.conversationId,
      );
      const result = await callHermes(
        promptWithContext,
        normalized.conversationId,
        existingSessionId,
      );
      hermesReply = result.reply;
      hermesSessionId = result.sessionId;

      // Persist sessionId for follow-up messages in this conversation
      if (hermesSessionId) {
        hermesSessionMap.set(normalized.conversationId, hermesSessionId);
      }
    } catch (hermesErr) {
      const errorMsg = hermesErr instanceof Error ? hermesErr.message : String(hermesErr);
      console.error("[chatwoot/webhook] Hermes error:", errorMsg);

      await logWorkflowEvent({
        runId: runId ?? undefined,
        eventType: "error",
        message: `Hermes error: ${errorMsg}`,
        metadata: { conversationId: normalized.conversationId, error: errorMsg },
      });

      if (runId) {
        await updateRun(runId, { status: "failed", error: errorMsg });
      }

      await sendChatwootMessage(
        normalized.conversationId,
        "Si è verificato un errore nel processare la richiesta. Riprova più tardi.",
      );

      return NextResponse.json({
        success: false,
        messageId: payload.id,
        conversationId: payload.conversation.id,
      role: permission.role,
      operatorId: permission.operator?.id ?? null,
      error: errorMsg,
        saved: !!saved,
      });
    }

    // Send Hermes reply to Chatwoot
    if (hermesReply) {
      await sendChatwootMessage(normalized.conversationId, hermesReply);
    }

    // Update run
    if (runId) {
      await updateRun(runId, {
        status: "completed",
        resultSummary: hermesReply.slice(0, 500),
        error: null,
      });
    }

    await logWorkflowEvent({
      runId: runId ?? undefined,
      eventType: "reply_sent",
      message: "Risposta inviata su Chatwoot",
      metadata: {
        conversationId: normalized.conversationId,
        hermesSessionId,
        replyLength: hermesReply.length,
      },
    });

    return NextResponse.json({
      success: true,
      messageId: payload.id,
      conversationId: payload.conversation.id,
      role: permission.role,
      operatorId: permission.operator?.id ?? null,
      runId,
      hermesSessionId,
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
