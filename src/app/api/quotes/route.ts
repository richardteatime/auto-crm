import { NextResponse } from "next/server";
import { listQuotes } from "@/lib/db/quotes";
import { getDeal } from "@/lib/db/deals";
import { getContact } from "@/lib/db/contacts";

export const dynamic = "force-dynamic";

export async function GET() {
  const quotes = await listQuotes();

  // Enrich each quote with deal title and contact info
  const result = await Promise.all(
    quotes.map(async (q) => {
      let dealTitle: string | null = null;
      let contactName: string | null = null;
      let contactCompany: string | null = null;

      if (q.dealId) {
        const deal = await getDeal(q.dealId);
        if (deal) {
          dealTitle = deal.title;
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
        status: q.status,
        vatRate: q.vatRate,
        validUntil: q.validUntil,
        createdAt: q.createdAt,
        dealId: q.dealId,
        dealTitle,
        contactName,
        contactCompany,
      };
    })
  );

  return NextResponse.json(result);
}
