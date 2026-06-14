import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listRuns } from "@/lib/orchestrator/runs";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  status: z.string().optional(),
  phone: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/**
 * List orchestrator runs.
 *
 * Query params:
 * - status: filter by status
 * - phone: filter by sender phone
 * - limit: max results (default 50)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());
    const parsed = QuerySchema.safeParse(query);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parametri non validi", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const runs = await listRuns({
      status: parsed.data.status as import("@/lib/orchestrator/types").RunStatus | undefined,
      senderPhone: parsed.data.phone,
      limit: parsed.data.limit ?? 50,
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
