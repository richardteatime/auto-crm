import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { getLead, listLeadQuotes, createLeadQuote } from "@/lib/db";
import { buildQuoteDraft } from "@/lib/leads/quotes";

const BodySchema = z.object({
  regenerate: z.boolean().optional(),
});

// POST /api/leads/[id]/generate-quote  { regenerate?: boolean }
// Builds a DRAFT quote from the lead's category + collected data and persists
// it (status "draft"). NEVER sent to the client — manual approval is required
// before sending (PLAN security rule). Deterministic: no AI dependency, so it
// never blocks. Idempotent by default: returns the existing draft unless
// `regenerate: true` is passed.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  let body = {};
  try {
    body = await request.json();
  } catch {
    // empty/invalid body is fine — defaults apply
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const lead = await getLead(id);
  if (!lead) {
    return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  }

  try {
    if (!parsed.data.regenerate) {
      const existing = await listLeadQuotes(id);
      const current = existing.find((q) => q.status === "draft");
      if (current) {
        return NextResponse.json(
          {
            success: true,
            action: "existing",
            leadId: id,
            quoteId: current.id,
            quote: current,
          },
          { status: 200 },
        );
      }
    }

    const draft = buildQuoteDraft(lead);
    const quote = await createLeadQuote({
      leadId: id,
      category: draft.category,
      amountSuggested: draft.amountSuggested,
      items: draft.items,
      summary: draft.summary,
      generatedText: draft.generatedText,
      status: "draft",
    });

    return NextResponse.json(
      {
        success: true,
        action: "created",
        leadId: id,
        quoteId: quote.id,
        quote,
        draft: {
          category: draft.category,
          amountSuggested: draft.amountSuggested,
          summary: draft.summary,
          generatedText: draft.generatedText,
          clientBudget: draft.clientBudget,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: `Errore nella generazione del preventivo: ${
          error instanceof Error ? error.message : "sconosciuto"
        }`,
      },
      { status: 500 },
    );
  }
}
