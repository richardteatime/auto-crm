import { str, int } from "@/lib/vendiora/http";
import type { VdPackage } from "@/lib/vendiora/types";

export function packageFromBody(b: Record<string, unknown>, create: boolean): { data: Partial<VdPackage> } | { error: string } {
  const d: Partial<VdPackage> = {};
  if ("name" in b || create) {
    const name = str(b.name, 200);
    if (!name) return { error: "Il nome del pacchetto è obbligatorio" };
    d.name = name;
  }
  for (const k of ["tagline", "guarantee", "paymentTerms"] as const) if (k in b) d[k] = str(b[k], 2000);
  if ("deliverables" in b) d.deliverables = str(b.deliverables, 20000);
  if ("price" in b) d.price = b.price === null || b.price === "" ? null : int(b.price, 0, 1e9);
  if ("vatRate" in b) d.vatRate = int(b.vatRate, 0, 100) ?? 22;
  if ("includedCalls" in b) d.includedCalls = int(b.includedCalls, 0, 200) ?? 0;
  if ("buildDays" in b) d.buildDays = int(b.buildDays, 1, 365) ?? 7;
  if ("coachingDays" in b) d.coachingDays = int(b.coachingDays, 0, 1000) ?? 0;
  if ("active" in b) d.active = b.active !== false;
  if ("sortOrder" in b) d.sortOrder = int(b.sortOrder, 0, 1000) ?? 0;
  return { data: d };
}
