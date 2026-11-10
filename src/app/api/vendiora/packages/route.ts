import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { listPackages, createPackage } from "@/lib/vendiora/db";
import { readBody, fail } from "@/lib/vendiora/http";
import { packageFromBody } from "./parse";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  return NextResponse.json({ packages: await listPackages() });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const body = await readBody(request);
  if (body instanceof NextResponse) return body;
  const p = packageFromBody(body, true);
  if ("error" in p) return NextResponse.json({ error: p.error }, { status: 400 });
  try {
    const all = await listPackages();
    return NextResponse.json({ package: await createPackage({ sortOrder: all.length, active: true, vatRate: 22, includedCalls: 0, buildDays: 7, coachingDays: 90, tagline: null, deliverables: null, price: null, guarantee: null, paymentTerms: null, ...p.data } as never) });
  } catch (e) { return fail(e); }
}
