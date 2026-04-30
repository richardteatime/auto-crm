import { NextRequest, NextResponse } from "next/server";
import { getContact, updateContact } from "@/lib/db/contacts";
import { listActivities } from "@/lib/db/activities";
import { classifyLead, isAIEnabled } from "@/lib/claude";
import { suggestTemperature } from "@/lib/scoring";

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

  // Rule-based fallback
  const lastActivity = contactActivities.sort((a, b) => {
    const aTime =
      typeof a.createdAt === "number"
        ? a.createdAt
        : a.createdAt?.getTime() || 0;
    const bTime =
      typeof b.createdAt === "number"
        ? b.createdAt
        : b.createdAt?.getTime() || 0;
    return bTime - aTime;
  })[0];

  const daysSinceLastActivity = lastActivity
    ? Math.floor(
        (Date.now() -
          (typeof lastActivity.createdAt === "number"
            ? lastActivity.createdAt * 1000
            : lastActivity.createdAt?.getTime() || Date.now())) /
          (1000 * 60 * 60 * 24)
      )
    : 999;

  const temperature = suggestTemperature(
    contact.temperature === "hot" ? 80 : contact.temperature === "warm" ? 50 : 20
  );

  await updateContact(contactId, { temperature });

  return NextResponse.json({
    temperature,
    nextAction: "Rivedere manualmente e fare follow-up",
    reasoning: "Classificazione basata su regole (senza API key)",
    mode: "rules",
  });
}
