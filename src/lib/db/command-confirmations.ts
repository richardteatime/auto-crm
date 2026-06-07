import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { RiskLevel } from "@/lib/orchestrator/types";

export type CommandConfirmationStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "expired"
  | "executed";

export interface CommandConfirmation {
  id: string;
  source: string;
  conversationId: string;
  senderTelegramId: string | null;
  operatorId: string | null;
  operatorRole: string | null;
  senderRole: string;
  commandText: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  riskLevel: RiskLevel;
  status: CommandConfirmationStatus;
  confirmationCode: string;
  requestedRunId: string | null;
  executedRunId: string | null;
  resultSummary: string | null;
  expiresAt: Date;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function fromDoc(doc: Models.Document): CommandConfirmation {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    source: rest.source as string,
    conversationId: rest.conversationId as string,
    senderTelegramId: (rest.senderTelegramId as string | null) ?? null,
    operatorId: (rest.operatorId as string | null) ?? null,
    operatorRole: (rest.operatorRole as string | null) ?? null,
    senderRole: rest.senderRole as string,
    commandText: rest.commandText as string,
    toolName: rest.toolName as string,
    toolArgs: JSON.parse((rest.toolArgs as string) || "{}") as Record<string, unknown>,
    riskLevel: rest.riskLevel as RiskLevel,
    status: rest.status as CommandConfirmationStatus,
    confirmationCode: rest.confirmationCode as string,
    requestedRunId: (rest.requestedRunId as string | null) ?? null,
    executedRunId: (rest.executedRunId as string | null) ?? null,
    resultSummary: (rest.resultSummary as string | null) ?? null,
    expiresAt: new Date(rest.expiresAt as string),
    respondedAt: rest.respondedAt ? new Date(rest.respondedAt as string) : null,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
  };
}

function confirmationTtlMinutes(): number {
  const value = Number(process.env.CRM_CONFIRMATION_TTL_MINUTES ?? "10");
  if (!Number.isFinite(value) || value <= 0) return 10;
  return Math.min(value, 60);
}

function generateConfirmationCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function sameRequester(
  confirmation: CommandConfirmation,
  params: { operatorId?: string | null; senderTelegramId?: string | null },
): boolean {
  if (confirmation.operatorId) {
    return confirmation.operatorId === (params.operatorId ?? null);
  }
  if (confirmation.senderTelegramId) {
    return confirmation.senderTelegramId === (params.senderTelegramId ?? null);
  }
  return false;
}

export async function createCommandConfirmation(data: {
  source: string;
  conversationId: string;
  senderTelegramId?: string | null;
  operatorId?: string | null;
  operatorRole?: string | null;
  senderRole: string;
  commandText: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  riskLevel: RiskLevel;
  requestedRunId?: string | null;
}): Promise<CommandConfirmation> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + confirmationTtlMinutes() * 60_000);
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.commandConfirmations,
    ID.unique(),
    {
      source: data.source,
      conversationId: data.conversationId,
      senderTelegramId: data.senderTelegramId ?? null,
      operatorId: data.operatorId ?? null,
      operatorRole: data.operatorRole ?? null,
      senderRole: data.senderRole,
      commandText: data.commandText,
      toolName: data.toolName,
      toolArgs: JSON.stringify(data.toolArgs),
      riskLevel: data.riskLevel,
      status: "pending",
      confirmationCode: generateConfirmationCode(),
      requestedRunId: data.requestedRunId ?? null,
      executedRunId: null,
      resultSummary: null,
      expiresAt: expiresAt.toISOString(),
      respondedAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  );
  return fromDoc(doc);
}

export async function listPendingCommandConfirmations(
  params: {
    source: string;
    conversationId: string;
    operatorId?: string | null;
    senderTelegramId?: string | null;
    limit?: number;
  },
  pagination?: { offset?: number; limit?: number },
): Promise<CommandConfirmation[]> {
  const res = await databases.listDocuments(
    DB_ID,
    COLLECTIONS.commandConfirmations,
    [
      Query.equal("status", "pending"),
      Query.equal("source", params.source),
      Query.equal("conversationId", params.conversationId),
      Query.orderDesc("$createdAt"),
      Query.limit(pagination?.limit ?? params.limit ?? 10),
      Query.offset(pagination?.offset ?? 0),
    ],
  );

  const now = Date.now();
  const confirmations = res.documents.map((doc) => fromDoc(doc));
  const active: CommandConfirmation[] = [];

  for (const confirmation of confirmations) {
    if (!sameRequester(confirmation, params)) continue;
    if (confirmation.expiresAt.getTime() <= now) {
      await markCommandConfirmationExpired(confirmation.id);
      continue;
    }
    active.push(confirmation);
  }

  return active;
}

export async function getPendingCommandConfirmationByCode(params: {
  source: string;
  conversationId: string;
  confirmationCode: string;
  operatorId?: string | null;
  senderTelegramId?: string | null;
}): Promise<CommandConfirmation | null> {
  const pending = await listPendingCommandConfirmations(params);
  const code = params.confirmationCode.trim().toUpperCase();
  return pending.find((confirmation) => confirmation.confirmationCode === code) ?? null;
}

async function updateCommandConfirmation(
  id: string,
  data: Partial<{
    status: CommandConfirmationStatus;
    executedRunId: string | null;
    resultSummary: string | null;
    respondedAt: string | null;
  }>,
): Promise<void> {
  await databases.updateDocument(
    DB_ID,
    COLLECTIONS.commandConfirmations,
    id,
    {
      ...data,
      updatedAt: new Date().toISOString(),
    },
  );
}

export async function markCommandConfirmationCancelled(id: string): Promise<void> {
  await updateCommandConfirmation(id, {
    status: "cancelled",
    respondedAt: new Date().toISOString(),
  });
}

export async function markCommandConfirmationExpired(id: string): Promise<void> {
  await updateCommandConfirmation(id, {
    status: "expired",
    respondedAt: new Date().toISOString(),
  });
}

export async function markCommandConfirmationExecuted(
  id: string,
  data: { executedRunId: string | null; resultSummary: string | null },
): Promise<void> {
  await updateCommandConfirmation(id, {
    status: "executed",
    executedRunId: data.executedRunId,
    resultSummary: data.resultSummary,
    respondedAt: new Date().toISOString(),
  });
}
