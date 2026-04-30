import { NextRequest, NextResponse } from "next/server";
import { getContact, updateContact } from "@/lib/db/contacts";
import { listActivities } from "@/lib/db/activities";
import { classifyLead, isAIEnabled } from "@/lib/claude";
import type { Temperature } from "@/types";

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  const { contactId } = body;

  if (!contactId) {
    return NextResponse.json(
      { error: "contactId è obbligatorio" },
      { status: 400 }
    );
  }

  const contact = await getContact(contactId);

  if (!contact) {
    return NextResponse.json(
      { error: "Contatto non trovato" },
      { status: 404 }
    );
  }

  const contactActivities = await listActivities({ contactId });

  if (isAIEnabled()) {
    try {
      const result = await classifyLead(
        {
          name: contact.name,
          company: contact.company || undefined,
          source: contact.source,
          notes: contact.notes || undefined,
        },
        contactActivities.map((a) => ({
          type: a.type as "call" | "email" | "meeting" | "note" | "follow_up",
          description: a.description,
          date: a.createdAt
            ? new Date(
                typeof a.createdAt === "number"
                  ? a.createdAt * 1000
                  : a.createdAt
              ).toISOString()
            : "unknown",
        }))
      );

      await updateContact(contactId, {
        temperature: result.temperature,
      });

      return NextResponse.json({
        ...result,
        mode: "ai",
      });
    } catch {
      // AI failed — fall through to rule-based scoring below
    }
  }

  // Rule-based fallback: keep existing temperature
  const temperature = contact.temperature as Temperature;

  await updateContact(contactId, { temperature });

  return NextResponse.json({
    temperature,
    nextAction: "Rivedere manualmente e fare follow-up",
    reasoning: "Classificazione basata su regole (senza API key)",
    mode: "rules",
  });
}
