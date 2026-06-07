import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { PipelineMovement } from "@/lib/leads/types";

function fromDoc<T>(doc: Models.Document): T {
  const { $id, $createdAt, $updatedAt, createdAt, ...rest } = doc;
  void $updatedAt;
  void createdAt;
  return {
    id: $id,
    createdAt: new Date($createdAt),
    ...rest,
  } as T;
}

export async function listPipelineMovements(
  leadId: string,
  pagination?: { offset?: number; limit?: number },
): Promise<PipelineMovement[]> {
  try {
    const res = await databases.listDocuments(
      DB_ID,
      COLLECTIONS.pipelineMovements,
      [
        Query.equal("leadId", leadId),
        Query.orderDesc("$createdAt"),
        Query.limit(pagination?.limit ?? 200),
        Query.offset(pagination?.offset ?? 0),
      ],
    );
    return res.documents.map((d) => fromDoc<PipelineMovement>(d));
  } catch {
    return [];
  }
}

export async function createPipelineMovement(data: {
  leadId: string;
  fromStage?: string | null;
  toStage: string;
  reason?: string | null;
  triggeredBy?: string;
  metadata?: Record<string, unknown> | null;
}): Promise<PipelineMovement | null> {
  try {
    const doc = await databases.createDocument(
      DB_ID,
      COLLECTIONS.pipelineMovements,
      ID.unique(),
      {
        leadId: data.leadId,
        fromStage: data.fromStage ?? null,
        toStage: data.toStage,
        reason: data.reason ?? null,
        triggeredBy: data.triggeredBy ?? "system",
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        createdAt: new Date().toISOString(),
      },
    );
    return fromDoc<PipelineMovement>(doc);
  } catch (e) {
    console.error("[pipeline-movements] create failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
