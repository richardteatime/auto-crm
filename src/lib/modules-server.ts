import { NextRequest, NextResponse } from "next/server";
import { getModulesConfig } from "@/lib/db/modules";
import type { ModuleId } from "@/lib/modules";

/**
 * Check if a module is enabled. Returns a 403 NextResponse if disabled.
 * Use at the top of optional API routes:
 *
 *   const modCheck = await requireModule("finance", request);
 *   if (modCheck) return modCheck;
 */
export async function requireModule(
  moduleId: ModuleId,
  _request: NextRequest
): Promise<NextResponse | null> {
  const enabled = await getModulesConfig();
  if (!enabled.includes(moduleId)) {
    return NextResponse.json(
      { error: "Modulo disabilitato" },
      { status: 403 }
    );
  }
  return null;
}
