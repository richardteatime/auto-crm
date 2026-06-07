import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { type Models } from "node-appwrite";
import { createHash } from "crypto";
import { Query } from "@/lib/query17";
import type { FunnelSession } from "@/lib/capture/types";
import { withAppwriteRetry } from "@/lib/db/retry";

function funnelSessionDocumentId(funnelId: string, sessionId: string): string {
  return `fs_${createHash("sha256").update(`${funnelId}:${sessionId}`).digest("hex").slice(0, 28)}`;
}

function isDuplicateDocument(error: unknown): boolean {
  if (!error) return false;
  const candidate = error as { code?: unknown; message?: unknown; type?: unknown };
  const description = `${String(candidate.message ?? "")} ${String(error)}`;
  return (
    String(candidate.code) === "409" ||
    candidate.type === "document_already_exists" ||
    /already exists|duplicate/i.test(description)
  );
}

function isMissingDocument(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; type?: unknown };
  return candidate.code === 404 || candidate.type === "document_not_found";
}

async function getDeterministicFunnelSession(
  funnelId: string,
  sessionId: string,
): Promise<FunnelSession | null> {
  try {
    const doc = await withAppwriteRetry(() =>
      databases.getDocument(
        DB_ID,
        COLLECTIONS.funnelSessions,
        funnelSessionDocumentId(funnelId, sessionId),
      )
    );
    return fromDoc(doc);
  } catch (error) {
    if (isMissingDocument(error)) return null;
    throw error;
  }
}

function fromDoc(doc: Models.Document): FunnelSession {
  const { $id, $createdAt, ...rest } = doc;
  return {
    id: $id,
    funnelId: rest.funnelId ?? "",
    sessionId: rest.sessionId ?? "",
    contactId: rest.contactId ?? null,
    currentStep: rest.currentStep ?? null,
    completed: rest.completed ?? false,
    abandoned: rest.abandoned ?? false,
    startedAt: rest.startedAt ? new Date(rest.startedAt) : new Date($createdAt),
    completedAt: rest.completedAt ? new Date(rest.completedAt) : null,
  };
}

export async function getFunnelSession(
  funnelId: string,
  sessionId: string,
): Promise<FunnelSession | null> {
  const deterministic = await getDeterministicFunnelSession(funnelId, sessionId);
  if (deterministic) return deterministic;
  const res = await withAppwriteRetry(() => databases.listDocuments(DB_ID, COLLECTIONS.funnelSessions, [
    Query.equal("funnelId", funnelId),
    Query.equal("sessionId", sessionId),
    Query.limit(1),
  ]));
  return res.documents.length ? fromDoc(res.documents[0]) : null;
}

export async function listFunnelSessions(
  funnelId: string,
  pagination?: { offset?: number; limit?: number },
): Promise<FunnelSession[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.funnelSessions, [
    Query.equal("funnelId", funnelId),
    Query.limit(pagination?.limit ?? 1000),
    Query.offset(pagination?.offset ?? 0),
  ]);
  return res.documents.map(fromDoc);
}

export async function createFunnelSession(data: {
  funnelId: string;
  sessionId: string;
  currentStep?: string | null;
}): Promise<FunnelSession> {
  const now = new Date().toISOString();
  const doc = await withAppwriteRetry(() => databases.createDocument(DB_ID, COLLECTIONS.funnelSessions, funnelSessionDocumentId(data.funnelId, data.sessionId), {
    funnelId: data.funnelId,
    sessionId: data.sessionId,
    contactId: null,
    currentStep: data.currentStep ?? null,
    completed: false,
    abandoned: false,
    startedAt: now,
    completedAt: null,
  }));
  return fromDoc(doc);
}

export async function updateFunnelSession(
  id: string,
  data: Partial<{
    contactId: string | null;
    currentStep: string | null;
    completed: boolean;
    abandoned: boolean;
    completedAt: string | null;
  }>,
): Promise<FunnelSession> {
  const doc = await withAppwriteRetry(() => databases.updateDocument(DB_ID, COLLECTIONS.funnelSessions, id, data));
  return fromDoc(doc);
}

export async function getOrCreateFunnelSession(
  funnelId: string,
  sessionId: string,
): Promise<FunnelSession> {
  const existing = await getFunnelSession(funnelId, sessionId);
  if (existing) return existing;
  try {
    return await createFunnelSession({ funnelId, sessionId });
  } catch (error) {
    if (isDuplicateDocument(error)) {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const raced = await getDeterministicFunnelSession(funnelId, sessionId);
        if (raced) return raced;
        await new Promise((resolve) => setTimeout(resolve, attempt * 100));
      }
      return {
        id: funnelSessionDocumentId(funnelId, sessionId),
        funnelId,
        sessionId,
        contactId: null,
        currentStep: null,
        completed: false,
        abandoned: false,
        startedAt: new Date(),
        completedAt: null,
      };
    }
    throw error;
  }
}
