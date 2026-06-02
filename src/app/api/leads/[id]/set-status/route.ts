import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getLead, updateLead, updateContact } from "@/lib/db";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leads/types";

// POST /api/leads/[id]/set-status  { status }
// Manual status change from the lead UI — powers the quick "Vinto" / "Perso"
// buttons (e.g. Cugina closing a deal on the first call). Also nudges the linked
// contact's temperature: won → hot, lost → cold.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const status = body.status;
  if (!status || !LEAD_STATUSES.includes(status as LeadStatus)) {
    return NextResponse.json(
      { error: "Stato non valido", validStatuses: LEAD_STATUSES },
      { status: 400 },
    );
  }

  const lead = await getLead(id);
  if (!lead) {
    return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  }

  try {
    const updated = await updateLead(id, { status: status as LeadStatus });

    if (lead.contactId && (status === "won" || status === "lost")) {
      try {
        await updateContact(lead.contactId, {
          temperature: status === "won" ? "hot" : "cold",
        });
      } catch {
        // non-blocking
      }
    }

    return NextResponse.json({
      success: true,
      leadId: id,
      status: updated.status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Errore nel cambio stato: ${
          error instanceof Error ? error.message : "sconosciuto"
        }`,
      },
      { status: 500 },
    );
  }
}
