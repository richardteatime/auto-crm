"use client";

import { useEffect, useState } from "react";
import { PARTNER_FEE_OFF, type PartnerFeeConfig } from "@/lib/partner-fee-shared";

let cache: Promise<PartnerFeeConfig> | null = null;

/** Partner fee settings of this CRM (off everywhere except e.g. CRM Matteo) */
export function usePartnerFee(): PartnerFeeConfig {
  const [cfg, setCfg] = useState<PartnerFeeConfig>(PARTNER_FEE_OFF);
  useEffect(() => {
    cache ??= fetch("/api/partner-fee")
      .then((r) => (r.ok ? r.json() : PARTNER_FEE_OFF))
      .catch(() => PARTNER_FEE_OFF);
    let alive = true;
    cache.then((c) => alive && setCfg(c));
    return () => {
      alive = false;
    };
  }, []);
  return cfg;
}
