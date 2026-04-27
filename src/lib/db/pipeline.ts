import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { PipelineStage, PipelineColumn, DealWithContact } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fromDoc<T>(doc: Models.Document): T {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    ...(rest as Record<string, unknown>),
  } as T;
}

// ---------------------------------------------------------------------------
// getStages
// ---------------------------------------------------------------------------

export async function getStages(): Promise<PipelineStage[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.pipelineStages, [
    Query.orderAsc("order"),
    Query.limit(100),
  ]);
  return res.documents.map((d) => fromDoc<PipelineStage>(d));
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
    return fromDoc<PipelineStage>(doc);
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

  // Delete all existing stages
  const existing = await databases.listDocuments(
    DB_ID,
    COLLECTIONS.pipelineStages,
    [Query.limit(100)],
  );
  await Promise.all(
    existing.documents.map((doc) =>
      databases.deleteDocument(DB_ID, COLLECTIONS.pipelineStages, doc.$id),
    ),
  );

  // Create new stages
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

  return created.map((d) => fromDoc<PipelineStage>(d));
}

// ---------------------------------------------------------------------------
// getFullPipeline
// ---------------------------------------------------------------------------

export async function getFullPipeline(): Promise<PipelineColumn[]> {
  const [stages, dealsRes] = await Promise.all([
    getStages(),
    databases.listDocuments(DB_ID, COLLECTIONS.deals, [Query.limit(500)]),
  ]);

  const allDeals = dealsRes.documents.map((d) => fromDoc<DealWithContact>(d));

  return stages.map((stage) => ({
    ...stage,
    deals: allDeals.filter((deal) => deal.stageId === stage.id),
  }));
}
