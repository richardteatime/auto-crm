import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { waAction } from "@/lib/vendiora/wa";
import { fail } from "@/lib/vendiora/http";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  try { return NextResponse.json(await waAction("logout")); } catch (e) { return fail(e, "Servizio WhatsApp non raggiungibile"); }
}
