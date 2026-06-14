import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { PipelineStage, PipelineColumn, DealWithContact } from "@/types";
import { parseDoc } from "./parse-doc";
import { PipelineStageSchema, DealSchema } from "./schemas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// getStages
// ---------------------------------------------------------------------------

export async function getStages(): Promise<PipelineStage[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.pipelineStages, [
    Query.orderAsc("order"),
    Query.limit(100),
  ]);
  return res.documents.map((d) => parseDoc(PipelineStageSchema,d));
}

// ---------------------------------------------------------------------------
// getStage
// ---------------------------------------------------------------------------

export async function getStage(id: string): Promise<PipelineStage | null> {
  try {
    const doc = await databases.getDocument(
      DB_ID,
      COLLECTIONS.pipelineStages,
      id,
    );
    return parseDoc(PipelineStageSchema,doc);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// replaceStages
// ---------------------------------------------------------------------------

export async function replaceStages(
  stages: Array<{
    name: string;
    order: number;
    color: string;
    isWon: boolean;
    isLost: boolean;
  }>,
): Promise<PipelineStage[]> {
  // Check no deals exist — safe-guard to prevent data orphans
  const dealsRes = await databases.listDocuments(DB_ID, COLLECTIONS.deals, [
    Query.limit(1),
  ]);
  if (dealsRes.total > 0) {
    throw new Error(
      "Cannot replace stages when deals exist. Remove all deals first.",
    );
  }

  // List existing stages
  const existing = await databases.listDocuments(
    DB_ID,
    COLLECTIONS.pipelineStages,
    [Query.limit(100)],
  );

  // Create new stages FIRST (so if anything crashes, old stages are still there)
  const created = await Promise.all(
    stages.map((s) =>
      databases.createDocument(
        DB_ID,
        COLLECTIONS.pipelineStages,
        ID.unique(),
        {
          name: s.name,
          order: s.order,
          color: s.color,
          isWon: s.isWon,
          isLost: s.isLost,
        },
      ),
    ),
  );

  // Only after successful creation, delete old stages
  await Promise.all(
    existing.documents.map((doc) =>
      databases.deleteDocument(DB_ID, COLLECTIONS.pipelineStages, doc.$id).catch(() => undefined),
    ),
  );

  return created.map((d) => parseDoc(PipelineStageSchema,d));
}

// ---------------------------------------------------------------------------
// getFullPipeline
// ---------------------------------------------------------------------------

export async function getFullPipeline(
  pagination?: { offset?: number; limit?: number },
): Promise<PipelineColumn[]> {
  const [stages, dealsRes] = await Promise.all([
    getStages(),
    databases.listDocuments(DB_ID, COLLECTIONS.deals, [
      Query.limit(pagination?.limit ?? 500),
      Query.offset(pagination?.offset ?? 0),
    ]),
  ]);

  const allDeals = dealsRes.documents.map((d) => parseDoc(DealSchema, d) as unknown as DealWithContact);

  return stages.map((stage) => ({
    ...stage,
    deals: allDeals.filter((deal) => deal.stageId === stage.id),
  }));
}
