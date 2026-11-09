// ---------------------------------------------------------------------------
// CRM instances. The same code runs the SarconX CRM and separate CRMs for
// single people (e.g. Matteo's). A separate instance has its own database for
// pipeline, deals, quotes, contacts…; only the Lead section is shared with the
// SarconX CRM (LEADS_DATABASE_ID), filtered to the lead sources it may see.
//
//   CRM_INSTANCE_ID     short id, e.g. "matteo" ("" = SarconX CRM)
//   CRM_INSTANCE_NAME   shown in the UI, e.g. "CRM Matteo"
//   CRM_ACCESS_LABEL    Appwrite user label allowed in, e.g. "crmmatteo" (letters/digits only)
//   LEADS_DATABASE_ID   database holding leads, lead_events, push_subscriptions
//   LEADS_SOURCES       comma list of lead sources visible here, e.g. "meta_form"
//                       (leads created by hand in this instance are always visible)
// ---------------------------------------------------------------------------

export const CRM_INSTANCE_ID = (process.env.CRM_INSTANCE_ID || "").trim();
export const CRM_INSTANCE_NAME = (process.env.CRM_INSTANCE_NAME || "").trim();
export const CRM_ACCESS_LABEL = (process.env.CRM_ACCESS_LABEL || "").trim();
export const IS_SEPARATE_INSTANCE = Boolean(CRM_ACCESS_LABEL);

export const LEAD_SOURCE_SCOPE: string[] = (process.env.LEADS_SOURCES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Label of the CRM where a deal lives, as seen from this instance. */
export function crmLabel(instanceId: string | null | undefined): string {
  const id = (instanceId || "").trim();
  if (!id) return "CRM SarconX";
  if (id === CRM_INSTANCE_ID && CRM_INSTANCE_NAME) return CRM_INSTANCE_NAME;
  return `CRM ${id.charAt(0).toUpperCase()}${id.slice(1)}`;
}
