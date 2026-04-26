import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, Query, type Models } from "node-appwrite";
import type { Expense } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toIsoDate(
  d: Date | string | number | null | undefined,
): string | undefined {
  if (!d) return undefined;
  if (d instanceof Date) return d.toISOString();
  if (typeof d === "number")
    return new Date(d < 1e12 ? d * 1000 : d).toISOString();
  return new Date(d).toISOString();
}

function fromDoc<T>(doc: Models.Document): T {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
    ...rest,
  } as T;
}

function normalizeExpense(expense: Expense): Expense {
  // Appwrite stores dates as ISO strings; convert back
  if (typeof expense.date === "string") {
    expense.date = new Date(expense.date);
  }
  return expense;
}

// ---------------------------------------------------------------------------
// listExpenses
// ---------------------------------------------------------------------------

export async function listExpenses(filters?: {
  startDate?: Date | string | number;
  endDate?: Date | string | number;
  type?: string;
  category?: string;
}): Promise<Expense[]> {
  const queries: string[] = [Query.orderDesc("date"), Query.limit(500)];

  if (filters?.startDate) {
    queries.push(Query.greaterThanEqual("date", toIsoDate(filters.startDate)!));
  }
  if (filters?.endDate) {
    queries.push(Query.lessThanEqual("date", toIsoDate(filters.endDate)!));
  }
  if (filters?.type) {
    queries.push(Query.equal("type", filters.type));
  }
  if (filters?.category) {
    queries.push(Query.equal("category", filters.category));
  }

  const res = await databases.listDocuments(
    DB_ID,
    COLLECTIONS.expenses,
    queries,
  );
  return res.documents.map((d) => normalizeExpense(fromDoc<Expense>(d)));
}

// ---------------------------------------------------------------------------
// createExpense
// ---------------------------------------------------------------------------

export async function createExpense(data: {
  type: string;
  category: string;
  description: string;
  amount: number;
  date: Date | string | number;
  createdBy: string;
}): Promise<Expense> {
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.expenses,
    ID.unique(),
    {
      type: data.type,
      category: data.category,
      description: data.description,
      amount: data.amount,
      date: toIsoDate(data.date),
      createdBy: data.createdBy,
    },
  );
  return normalizeExpense(fromDoc<Expense>(doc));
}

// ---------------------------------------------------------------------------
// updateExpense
// ---------------------------------------------------------------------------

export async function updateExpense(
  id: string,
  data: Partial<{
    type: string;
    category: string;
    description: string;
    amount: number;
    date: Date | string | number;
  }>,
): Promise<Expense> {
  const payload: Record<string, unknown> = { ...data };

  if (data.date !== undefined) {
    payload.date = toIsoDate(data.date);
  }

  const doc = await databases.updateDocument(
    DB_ID,
    COLLECTIONS.expenses,
    id,
    payload,
  );
  return normalizeExpense(fromDoc<Expense>(doc));
}

// ---------------------------------------------------------------------------
// deleteExpense
// ---------------------------------------------------------------------------

export async function deleteExpense(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.expenses, id);
}
