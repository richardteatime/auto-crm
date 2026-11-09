// Server-side partner fee configuration (env, per CRM instance):
//   PARTNER_FEE_NAME         who gets the fee, e.g. "Matteo" (unset = feature off)
//   PARTNER_FEE_DEFAULT_PCT  default percentage for every deal, e.g. 30
//   PARTNER_FEE_EDITORS      comma list of Appwrite user ids allowed to change it (e.g. Leo)

import { PARTNER_FEE_OFF, type PartnerFeeConfig } from "@/lib/partner-fee-shared";

const NAME = (process.env.PARTNER_FEE_NAME || "").trim();
const DEFAULT_PCT = Number(process.env.PARTNER_FEE_DEFAULT_PCT || 30);
const EDITORS = (process.env.PARTNER_FEE_EDITORS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const PARTNER_FEE_ENABLED = Boolean(NAME);

export function canEditPartnerFee(userId: string | null | undefined): boolean {
  return PARTNER_FEE_ENABLED && !!userId && EDITORS.includes(userId);
}

export function partnerFeeConfig(userId?: string | null): PartnerFeeConfig {
  if (!PARTNER_FEE_ENABLED) return PARTNER_FEE_OFF;
  return {
    enabled: true,
    name: NAME,
    defaultPct: Number.isFinite(DEFAULT_PCT) ? DEFAULT_PCT : 30,
    canEdit: canEditPartnerFee(userId),
  };
}
