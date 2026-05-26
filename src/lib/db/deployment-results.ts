import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { DeploymentResult } from "@/lib/orchestrator/types";

function fromDoc(doc: Models.Document): DeploymentResult {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    runId: rest.runId as string,
    projectId: rest.projectId as string | null,
    environment: rest.environment as DeploymentResult["environment"],
    status: rest.status as string,
    url: rest.url as string | null,
    provider: rest.provider as string,
    healthcheckStatus: rest.healthcheckStatus as string | null,
    rollbackAvailable: rest.rollbackAvailable as boolean,
    logs: rest.logs as string | null,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
  };
}

export async function listDeploymentResults(filters?: {
  runId?: string;
  projectId?: string;
  environment?: DeploymentResult["environment"];
}): Promise<DeploymentResult[]> {
  const queries: string[] = [Query.limit(200), Query.orderDesc("$createdAt")];

  if (filters?.runId) {
    queries.push(Query.equal("runId", filters.runId));
  }
  if (filters?.projectId) {
    queries.push(Query.equal("projectId", filters.projectId));
  }
  if (filters?.environment) {
    queries.push(Query.equal("environment", filters.environment));
  }

  const res = await databases.listDocuments(DB_ID, COLLECTIONS.deploymentResults, queries);
  return res.documents.map((d) => fromDoc(d));
}

export async function getDeploymentResult(id: string): Promise<DeploymentResult | null> {
  try {
    const doc = await databases.getDocument(DB_ID, COLLECTIONS.deploymentResults, id);
    return fromDoc(doc);
  } catch {
    return null;
  }
}

export async function createDeploymentResult(data: {
  runId: string;
  projectId?: string | null;
  environment?: DeploymentResult["environment"];
  status: string;
  url?: string | null;
  provider?: string;
  healthcheckStatus?: string | null;
  rollbackAvailable?: boolean;
  logs?: string | null;
}): Promise<DeploymentResult> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.deploymentResults,
    ID.unique(),
    {
      runId: data.runId,
      projectId: data.projectId ?? null,
      environment: data.environment ?? "preview",
      status: data.status,
      url: data.url ?? null,
      provider: data.provider ?? "unknown",
      healthcheckStatus: data.healthcheckStatus ?? null,
      rollbackAvailable: data.rollbackAvailable ?? false,
      logs: data.logs ?? null,
      createdAt: now,
      updatedAt: now,
    },
  );
  return fromDoc(doc);
}

export async function updateDeploymentResult(
  id: string,
  data: Partial<{
    status: string;
    url: string | null;
    provider: string;
    healthcheckStatus: string | null;
    rollbackAvailable: boolean;
    logs: string | null;
  }>,
): Promise<DeploymentResult> {
  const payload: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() };
  const doc = await databases.updateDocument(DB_ID, COLLECTIONS.deploymentResults, id, payload);
  return fromDoc(doc);
}

export async function deleteDeploymentResult(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.deploymentResults, id);
}
