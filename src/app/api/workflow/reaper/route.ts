import { NextRequest, NextResponse } from "next/server";
import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { Query } from "@/lib/query17";

export const dynamic = "force-dynamic";

const STALE_MINUTES = 10;
const PAGE_LIMIT = 500;

async function listAllStale(
  collectionId: string,
  statusField: string,
  statusValue: string,
  cutoff: string,
): Promise<unknown[]> {
  const all: unknown[] = [];
  let offset = 0;
  while (true) {
    const page = await databases.listDocuments(DB_ID, collectionId, [
      Query.equal(statusField, statusValue),
      Query.lessThanEqual("startedAt", cutoff),
      Query.limit(PAGE_LIMIT),
      Query.offset(offset),
    ]);
    all.push(...page.documents);
    if (page.documents.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
  }
  return all;
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-worker-secret");
  const expected = process.env.WORKFLOW_WORKER_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
  const results = { runs: 0, scheduled: 0 };

  // 1. Reap stale workflow runs (running for too long)
  try {
    const staleRuns = await listAllStale(
      COLLECTIONS.workflowRuns,
      "status",
      "running",
      cutoff,
    );
    for (const doc of staleRuns) {
      const d = doc as { $id: string; status?: string };
      if (d.status !== "running") continue;
      await databases.updateDocument(
        DB_ID,
        COLLECTIONS.workflowRuns,
        d.$id,
        {
          status: "failed",
          error: `Stale run: exceeded ${STALE_MINUTES} minutes without completion`,
          completedAt: new Date().toISOString(),
        },
      );
      results.runs += 1;
    }
  } catch (e) {
    console.error("[reaper] Failed to reap runs:", e);
  }

  // 2. Reap stale scheduled items (processing for too long)
  try {
    const staleScheduled = await listAllStale(
      COLLECTIONS.workflowScheduled,
      "status",
      "processing",
      cutoff,
    );
    for (const doc of staleScheduled) {
      const d = doc as { $id: string; status?: string };
      if (d.status !== "processing") continue;
      await databases.updateDocument(
        DB_ID,
        COLLECTIONS.workflowScheduled,
        d.$id,
        {
          status: "pending",
          workerId: "",
          startedAt: null,
        },
      );
      results.scheduled += 1;
    }
  } catch (e) {
    console.error("[reaper] Failed to reap scheduled:", e);
  }

  return NextResponse.json({ success: true, reaped: results });
}
