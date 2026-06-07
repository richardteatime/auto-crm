import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleCommand } from "@/lib/orchestrator/router";

const BodySchema = z.object({
  senderPhone: z.string().optional(),
  senderName: z.string().optional(),
  conversationId: z.coerce.number().optional(),
  messageText: z.string().min(1),
});

/**
 * Orchestrator command endpoint.
 *
 * Accepts a command payload and returns the result.
 * Used for testing or direct API integration.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const result = await handleCommand({
      senderPhone: parsed.data.senderPhone ?? null,
      senderTelegramId: null,
      senderName: parsed.data.senderName ?? null,
      conversationId: parsed.data.conversationId ?? 0,
      messageText: parsed.data.messageText.trim(),
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
