import type { Opportunity } from "@/types";
import { quoteTotalCents } from "@/lib/quote-items";
import { listDeals } from "./deals";
import { getStages } from "./pipeline";
import { listQuotes, type Quote } from "./quotes";

/**
 * Cross references between opportunity, deal and quote, so the UI can make them all clickable:
 * opportunity → deal / quotes, deal → opportunity / quotes, quote → deal / opportunity.
 * (A quote belongs to a deal; a deal came from at most one opportunity.)
 */

/** Opportunities, each with the deal it became (and its stage) and that deal's quotes */
export async function opportunitiesWithLinks(opps: Opportunity[], contactId?: string) {
  const dealIds = [...new Set(opps.map((o) => o.dealId).filter((d): d is string => !!d))];
  if (dealIds.length === 0) return opps.map((o) => ({ ...o, deal: null, quotes: [] as QuoteRef[] }));

  const [allDeals, stages, quotes] = await Promise.all([
    listDeals(contactId ? { contactId } : undefined),
    getStages(),
    listQuotes({ dealIds }),
  ]);
  const stageName = new Map(stages.map((s) => [s.id, s.name]));
  const dealById = new Map(allDeals.map((d) => [d.id, d]));
  return opps.map((o) => {
    const d = o.dealId ? dealById.get(o.dealId) : undefined;
    return {
      ...o,
      deal: d ? { id: d.id, title: d.title, stageName: stageName.get(d.stageId) ?? null } : null,
      quotes: quotes
        .filter((q) => q.dealId === o.dealId)
        .map((q): QuoteRef => ({ id: q.id, number: q.number, status: q.status })),
    };
  });
}

export interface QuoteRef {
  id: string;
  number: string;
  status: string;
}

/** The quotes of a contact's deals, each with its deal and opportunity (title + id) for the links */
export function buildContactQuotes(
  deals: Array<{ id: string; title: string; isPaid?: boolean | null }>,
  opps: Array<{ id: string; title: string; dealId: string | null }>,
  quotes: Quote[],
) {
  const dealById = new Map(deals.map((d) => [d.id, d]));
  const oppByDeal = new Map(opps.filter((o) => o.dealId).map((o) => [o.dealId as string, o]));
  return quotes
    .filter((q) => dealById.has(q.dealId))
    .map((q) => {
      const deal = dealById.get(q.dealId);
      const opp = oppByDeal.get(q.dealId);
      return {
        id: q.id,
        number: q.number,
        title: q.title,
        status: q.status,
        dealId: q.dealId,
        dealTitle: deal?.title ?? null,
        opportunityId: opp?.id ?? null,
        opportunityTitle: opp?.title ?? null,
        total: quoteTotalCents(q.items, q.vatRate),
        validUntil: q.validUntil,
        isPaid: !!q.isPaid,
        dealIsPaid: !!deal?.isPaid,
        createdAt: q.createdAt,
      };
    });
}
