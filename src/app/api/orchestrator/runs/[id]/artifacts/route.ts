import { NextRequest, NextResponse } from "next/server";
import { listProjectArtifacts } from "@/lib/db/project-artifacts";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const artifacts = await listProjectArtifacts({ runId: id });
    return NextResponse.json(artifacts);
  } catch (err) {
    console.error("[orchestrator/runs/[id]/artifacts] error:", err);
    return NextResponse.json({ error: "Errore nel caricamento artifacts" }, { status: 500 });
  }
}
