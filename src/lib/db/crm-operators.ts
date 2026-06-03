import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { CrmOperator, CrmOperatorRole } from "@/lib/crm-operators/types";
import {
  parseOperatorScopes,
  serializeOperatorScopes,
} from "@/lib/crm-operators/types";

function fromDoc(doc: Models.Document): CrmOperator {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    name: rest.name as string,
    appwriteUserId: (rest.appwriteUserId as string | null) ?? null,
    telegramUserId: (rest.telegramUserId as string | null) ?? null,
    chatwootContactId: (rest.chatwootContactId as string | null) ?? null,
    chatwootAgentId: (rest.chatwootAgentId as string | null) ?? null,
    role: rest.role as CrmOperatorRole,
    scopes: parseOperatorScopes(rest.scopes),
    active: Boolean(rest.active),
    notes: (rest.notes as string | null) ?? null,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
  };
}

async function findFirstOperator(queries: string[]): Promise<CrmOperator | null> {
  try {
    const res = await databases.listDocuments(
      DB_ID,
      COLLECTIONS.crmOperators,
      [Query.limit(1), ...queries],
    );
    const [doc] = res.documents;
    return doc ? fromDoc(doc) : null;
  } catch (error) {
    console.warn(
      "[crm-operators] lookup skipped:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function getOperatorByTelegramUserId(
  telegramUserId: string | null | undefined,
): Promise<CrmOperator | null> {
  if (!telegramUserId) return null;
  return findFirstOperator([
    Query.equal("telegramUserId", String(telegramUserId)),
    Query.equal("active", true),
  ]);
}

export async function getOperatorByChatwootContactId(
  chatwootContactId: string | number | null | undefined,
): Promise<CrmOperator | null> {
  if (chatwootContactId === null || chatwootContactId === undefined) return null;
  return findFirstOperator([
    Query.equal("chatwootContactId", String(chatwootContactId)),
    Query.equal("active", true),
  ]);
}

export async function upsertCrmOperator(data: {
  id?: string;
  name: string;
  appwriteUserId?: string | null;
  telegramUserId?: string | null;
  chatwootContactId?: string | null;
  chatwootAgentId?: string | null;
  role: CrmOperatorRole;
  scopes: string[];
  active?: boolean;
  notes?: string | null;
}): Promise<CrmOperator> {
  const now = new Date().toISOString();
  const payload = {
    name: data.name,
    appwriteUserId: data.appwriteUserId ?? null,
    telegramUserId: data.telegramUserId ?? null,
    chatwootContactId: data.chatwootContactId ?? null,
    chatwootAgentId: data.chatwootAgentId ?? null,
    role: data.role,
    scopes: serializeOperatorScopes(data.scopes),
    active: data.active ?? true,
    notes: data.notes ?? null,
    updatedAt: now,
  };

  if (data.id) {
    const updated = await databases.updateDocument(
      DB_ID,
      COLLECTIONS.crmOperators,
      data.id,
      payload,
    );
    return fromDoc(updated);
  }

  const created = await databases.createDocument(
    DB_ID,
    COLLECTIONS.crmOperators,
    ID.unique(),
    {
      ...payload,
      createdAt: now,
    },
  );
  return fromDoc(created);
}
