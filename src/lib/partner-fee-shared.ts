// Partner fee: share of a deal's price (VAT excluded) that goes to a partner,
// e.g. Matteo gets 30% of each site he sells in his CRM. Pure helpers, usable
// on client and server. Configuration lives in src/lib/partner-fee.ts (server).

export type PartnerFeeConfig = {
  /** Feature on in this CRM instance */
  enabled: boolean;
  /** Who gets the fee, e.g. "Matteo" */
  name: string;
  /** Percentage used when a deal has none set */
  defaultPct: number;
  /** Current user may change the percentage */
  canEdit: boolean;
};

export const PARTNER_FEE_OFF: PartnerFeeConfig = { enabled: false, name: "", defaultPct: 0, canEdit: false };

export function clampPct(n: unknown): number | null {
  const v = typeof n === "string" ? Number(n.replace(",", ".")) : Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.min(100, Math.max(0, Math.round(v * 100) / 100));
}

/** Percentage that applies to a deal (its own, or the default) */
export function dealFeePct(deal: { partnerFeePct?: number | null }, cfg: Pick<PartnerFeeConfig, "enabled" | "defaultPct">): number {
  if (!cfg.enabled) return 0;
  return typeof deal.partnerFeePct === "number" ? deal.partnerFeePct : cfg.defaultPct;
}

/** Fee in cents on an amount in cents (VAT excluded) */
export function feeOf(amountCents: number, pct: number): number {
  return Math.round((amountCents * pct) / 100);
}
