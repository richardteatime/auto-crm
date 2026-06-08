import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getLead, createContact, updateLead } from "@/lib/db";
import { listDeals, createDeal } from "@/lib/db/deals";
import { createQuote } from "@/lib/db/quotes";
import { buildQuoteDraft } from "@/lib/leads/quotes";
import { CATEGORY_LABELS } from "@/lib/leads/types";

// POST /api/leads/[id]/convert-to-quote
// Converte la bozza preventivo del lead in un PREVENTIVO vero (collection quotes),
// collegato a un deal del contatto del lead, così è esportabile col PDF A4.
// Riusa il deal esistente del contatto se presente, altrimenti ne crea uno.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  const lead = await getLead(id);
  if (!lead) {
    return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  }

  try {
    console.log("[convert-to-quote] START leadId=", id);

    // 1. Contatto: usa quello collegato, o creane uno dai dati del lead.
    let contactId: string;
    if (lead.contactId) {
      contactId = lead.contactId;
      console.log("[convert-to-quote] Step 1: riuso contatto esistente", contactId);
    } else {
      console.log("[convert-to-quote] Step 1: creo contatto da lead...");
      const contact = await createContact({
        name: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        company: lead.company ?? lead.businessName,
        source: lead.source || "lead",
        temperature: "warm",
        notes: "",
      });
      contactId = contact.id;
      console.log("[convert-to-quote] Step 1: contatto creato", contactId);

      // Collega il contatto al lead per le prossime conversioni
      await updateLead(id, { contactId });
      console.log("[convert-to-quote] Step 1: lead aggiornato con contactId");
    }

    // 2. Deal: riusa il più recente del contatto, altrimenti creane uno.
    const draft = buildQuoteDraft(lead);
    console.log("[convert-to-quote] Step 2: bozza importo=", draft.amountSuggested);
    const existingDeals = await listDeals({ contactId });
    let dealId: string;
    if (existingDeals[0]) {
      dealId = existingDeals[0].id;
      console.log("[convert-to-quote] Step 2: riuso deal esistente", dealId);
    } else {
      console.log("[convert-to-quote] Step 2: creo deal...");
      const deal = await createDeal({
        title: lead.projectType?.trim() || `Trattativa — ${lead.fullName}`,
        contactId,
        value: draft.amountSuggested,
      });
      dealId = deal.id;
      console.log("[convert-to-quote] Step 2: deal creato", dealId);
    }

    // 3. Mappa le righe della bozza nel formato del preventivo vero.
    const dbItems = draft.items.map((it, i) => ({
      id: `it_${Date.now()}_${i}`,
      description: it.label,
      quantity: 1,
      unitPrice: it.amount, // cents
      discount: 0,
      billingType: "una_tantum" as const,
    }));
    console.log("[convert-to-quote] Step 3: righe preventivo", dbItems.length);

    // 4. Crea il preventivo vero (status "bozza"), esportabile col PDF A4.
    // TODO: rimetti generatedText dopo aver eseguito `npm run setup`
    // (Appwrite rifiuta l'attributo se non esiste nella collection quotes)
    console.log("[convert-to-quote] Step 4: creo quote...");
    const quote = await createQuote({
      dealId,
      title:
        lead.projectType?.trim() ||
        `Preventivo ${CATEGORY_LABELS[draft.category] ?? draft.category}`,
      items: JSON.stringify(dbItems),
      notes: lead.message?.trim() ? `Richiesta cliente: ${lead.message.trim()}` : null,
      vatRate: 22,
    });
    console.log("[convert-to-quote] Step 4: quote creato", quote.id);

    return NextResponse.json(
      {
        success: true,
        quoteId: quote.id,
        dealId,
        pdfUrl: `/api/quotes/${quote.id}/pdf`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[convert-to-quote] ERROR:", error);
    return NextResponse.json(
      {
        error: `Errore nella conversione in preventivo: ${
          error instanceof Error ? error.message : "sconosciuto"
        }`,
      },
      { status: 500 },
    );
  }
}
