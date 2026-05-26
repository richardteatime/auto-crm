import { NextRequest, NextResponse } from "next/server";
import { getOrchestratorRun } from "@/lib/db/orchestrator-runs";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const run = await getOrchestratorRun(id);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    return NextResponse.json(run);
  } catch (err) {
    console.error("[orchestrator/runs/[id]] error:", err);
    return NextResponse.json({ error: "Errore nel caricamento run" }, { status: 500 });
  }
}
