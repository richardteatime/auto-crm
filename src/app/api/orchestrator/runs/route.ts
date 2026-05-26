import { NextRequest, NextResponse } from "next/server";
import { listRuns } from "@/lib/orchestrator/runs";

export const dynamic = "force-dynamic";

/**
 * List orchestrator runs.
 *
 * Query params:
 * - status: filter by status
 * - phone: filter by sender phone
 * - limit: max results (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const phone = searchParams.get("phone") ?? undefined;
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const runs = await listRuns({
      status: status as import("@/lib/orchestrator/types").RunStatus | undefined,
      senderPhone: phone,
      limit: Number.isNaN(limit) ? 50 : limit,
    });

    return NextResponse.json(runs);
  } catch (err) {
    console.error("[orchestrator/runs] error:", err);
    return NextResponse.json(
      { error: "Errore nel caricamento runs" },
      { status: 500 },
    );
  }
}
