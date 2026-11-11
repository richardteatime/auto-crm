import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  const { CRM_INSTANCE_NAME } = await import("@/lib/instance");
  const { vendioraEnabled } = await import("@/lib/roles");
  return NextResponse.json({ ...user, crm: CRM_INSTANCE_NAME || undefined, vendiora: vendioraEnabled() && user.role === "admin", leadBrand: vendioraEnabled() ? "VendiOra" : undefined });
}
