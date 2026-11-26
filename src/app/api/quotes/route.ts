import { NextRequest, NextResponse } from "next/server";
import { listQuotes } from "@/lib/db/quotes";
import { requireAuth } from "@/lib/auth";
import { getDeal } from "@/lib/db/deals";
import { listOpportunities } from "@/lib/db/opportunities";
import { getContact } from "@/lib/db/contacts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const quotes = await listQuotes();
  // opportunity each deal came from, so a quote can link back to it
  const dealIds = [...new Set(quotes.map((q) => q.dealId).filter(Boolean))];
  const oppByDeal = new Map(
    (await listOpportunities({ dealIds }).catch(() => []))
      .filter((o) => o.dealId)
      .map((o) => [o.dealId as string, o])
  );

  // Enrich each quote with deal title and contact info
  const result = await Promise.all(
    quotes.map(async (q) => {
      let dealTitle: string | null = null;
      let contactName: string | null = null;
      let contactCompany: string | null = null;
      let dealIsPaid = false;
      let contactId: string | null = null;

      if (q.dealId) {
        const deal = await getDeal(q.dealId);
        if (deal) {
          dealTitle = deal.title;
          dealIsPaid = !!deal.isPaid;
          contactId = deal.contactId ?? null;
          if (deal.contactId) {
            const contact = await getContact(deal.contactId);
            if (contact) {
              contactName = contact.name;
              contactCompany = contact.company;
            }
          }
        }
      }

      return {
        id: q.id,
        number: q.number,
        title: q.title,
        items: q.items,
        notes: q.notes,
        internalNotes: q.internalNotes ?? null,
        isPaid: q.isPaid ?? false,
        paymentTerms: q.paymentTerms ?? null,
        clauses: q.clauses ?? null,
        status: q.status,
        vatRate: q.vatRate,
        validUntil: q.validUntil,
        createdAt: q.createdAt,
        dealId: q.dealId,
        dealTitle,
        dealIsPaid,
        contactId,
        opportunityId: oppByDeal.get(q.dealId)?.id ?? null,
        opportunityTitle: oppByDeal.get(q.dealId)?.title ?? null,
        contactName,
        contactCompany,
      };
    })
  );

  return NextResponse.json(result);
}
