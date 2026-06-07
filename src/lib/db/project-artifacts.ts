import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { ProjectArtifact } from "@/lib/orchestrator/types";

function fromDoc(doc: Models.Document): ProjectArtifact {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    runId: rest.runId as string,
    projectId: rest.projectId as string | null,
    artifactType: rest.artifactType as ProjectArtifact["artifactType"],
    name: rest.name as string,
    url: rest.url as string | null,
    content: rest.content as string | null,
    metadata: rest.metadata as string | null,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
  };
}

export async function listProjectArtifacts(
  filters?: {
    runId?: string;
    projectId?: string;
    artifactType?: ProjectArtifact["artifactType"];
  },
  pagination?: { offset?: number; limit?: number },
): Promise<ProjectArtifact[]> {
  const queries: string[] = [
    Query.limit(pagination?.limit ?? 200),
    Query.offset(pagination?.offset ?? 0),
    Query.orderDesc("$createdAt"),
  ];

  if (filters?.runId) {
    queries.push(Query.equal("runId", filters.runId));
  }
  if (filters?.projectId) {
    queries.push(Query.equal("projectId", filters.projectId));
  }
  if (filters?.artifactType) {
    queries.push(Query.equal("artifactType", filters.artifactType));
  }

  const res = await databases.listDocuments(DB_ID, COLLECTIONS.projectArtifacts, queries);
  return res.documents.map((d) => fromDoc(d));
}

export async function getProjectArtifact(id: string): Promise<ProjectArtifact | null> {
  try {
    const doc = await databases.getDocument(DB_ID, COLLECTIONS.projectArtifacts, id);
    return fromDoc(doc);
  } catch {
    return null;
  }
}

export async function createProjectArtifact(data: {
  runId: string;
  projectId?: string | null;
  artifactType: ProjectArtifact["artifactType"];
  name: string;
  url?: string | null;
  content?: string | null;
  metadata?: string | null;
}): Promise<ProjectArtifact> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.projectArtifacts,
    ID.unique(),
    {
      runId: data.runId,
      projectId: data.projectId ?? null,
      artifactType: data.artifactType,
      name: data.name,
      url: data.url ?? null,
      content: data.content ?? null,
      metadata: data.metadata ?? null,
      createdAt: now,
      updatedAt: now,
    },
  );
  return fromDoc(doc);
}

export async function updateProjectArtifact(
  id: string,
  data: Partial<{
    artifactType: ProjectArtifact["artifactType"];
    name: string;
    url: string | null;
    content: string | null;
    metadata: string | null;
  }>,
): Promise<ProjectArtifact> {
  const payload: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() };
  const doc = await databases.updateDocument(DB_ID, COLLECTIONS.projectArtifacts, id, payload);
  return fromDoc(doc);
}

export async function deleteProjectArtifact(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.projectArtifacts, id);
}
