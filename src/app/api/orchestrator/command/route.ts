import { NextRequest, NextResponse } from "next/server";
import { handleCommand } from "@/lib/orchestrator/router";

/**
 * Orchestrator command endpoint.
 *
 * Accepts a command payload and returns the result.
 * Used for testing or direct API integration.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { senderPhone, senderName, conversationId, messageText } = body;

    if (!messageText?.trim()) {
      return NextResponse.json(
        { error: "messageText obbligatorio" },
        { status: 400 },
      );
    }

    const result = await handleCommand({
      senderPhone: senderPhone ?? null,
      senderName: senderName ?? null,
      conversationId: conversationId ?? 0,
      messageText: messageText.trim(),
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[orchestrator/command] error:", err);
    return NextResponse.json(
      { error: "Errore nell'elaborazione del comando" },
      { status: 500 },
    );
  }
}
