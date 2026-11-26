import type { CloseOutcome, DealWithContact, Opportunity } from "@/types";
import { getDeal, updateDeal } from "./deals";
import { getOpportunity, updateOpportunity } from "./opportunities";
import { getStage, getStages } from "./pipeline";

/**
 * Deals and opportunities are never deleted: "removing" one means closing it as lost,
 * with a reason, so it stays in the customer history.
 */

export class CloseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Close a deal as lost (what the trash icon does). It is NOT deleted: the deal and the
 * opportunity it came from stay in the customer history as "persa", with the reason.
 */
export async function closeDeal(id: string, reason: string, by: string | null): Promise<DealWithContact> {
  const deal = await getDeal(id);
  if (!deal) throw new CloseError("Trattativa non trovata", 404);
  const current = await getStage(deal.stageId);
  if (current?.isLost) throw new CloseError("Trattativa già chiusa", 400);
  const lost = (await getStages()).find((st) => st.isLost);
  if (!lost) throw new CloseError("Nel pipeline manca la fase «Persa»", 400);
  // moving to the lost stage also closes the linked opportunity (same outcome, reason, author)
  return updateDeal(id, { stageId: lost.id, closedReason: reason, closedBy: by });
}

/**
 * Close an opportunity with a reason. It is NOT deleted: it stays in the customer
 * history as "chiusa". With an open deal, the deal is closed too (moved to the "lost"
 * stage with the same reason). If its deal is already won or lost, the opportunity
 * simply follows that outcome.
 */
export async function closeOpportunity(id: string, reason: string, by: string | null): Promise<Opportunity> {
  const opp = await getOpportunity(id);
  if (!opp) throw new CloseError("Opportunità non trovata", 404);
  if (opp.status === "chiusa") throw new CloseError("Opportunità già chiusa", 400);

  let outcome: CloseOutcome = "persa";
  if (opp.dealId) {
    const deal = await getDeal(opp.dealId);
    if (deal) {
      const current = await getStage(deal.stageId);
      if (current?.isWon) {
        outcome = "vinta";
      } else if (!current?.isLost) {
        await closeDeal(deal.id, reason, by); // closes every opportunity linked to the deal
      }
    }
  }

  return updateOpportunity(id, {
    status: "chiusa",
    closedOutcome: outcome,
    closedReason: reason,
    closedBy: by,
    closedAt: new Date().toISOString(),
  });
}

/** Reopen a closed opportunity that has no deal (with a deal, the deal is reopened from the pipeline) */
export async function reopenOpportunity(id: string): Promise<Opportunity> {
  const opp = await getOpportunity(id);
  if (!opp) throw new CloseError("Opportunità non trovata", 404);
  if (opp.status !== "chiusa") throw new CloseError("L'opportunità non è chiusa", 400);
  if (opp.dealId && (await getDeal(opp.dealId))) {
    throw new CloseError("Riapri la trattativa spostandola fuori dalla fase «Persa»", 400);
  }
  return updateOpportunity(id, { status: "aperta", dealId: null, closedOutcome: null, closedReason: null, closedBy: null, closedAt: null });
}
