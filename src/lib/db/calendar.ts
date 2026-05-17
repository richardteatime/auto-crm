import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { CalendarEvent } from "@/types";

function parseAssignedTo(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
      return [value];
    } catch {
      return [value];
    }
  }
  return [];
}

function serializeAssignedTo(value: string[] | undefined | null): string | null {
  if (!value || value.length === 0) return null;
  return JSON.stringify(value);
}

function fromDoc(doc: Models.Document): CalendarEvent {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    title: rest.title ?? "",
    description: rest.description ?? null,
    startAt: rest.startAt ? new Date(rest.startAt) : new Date(),
    endAt: rest.endAt ? new Date(rest.endAt) : new Date(),
    allDay: rest.allDay ?? false,
    type: rest.type ?? "activity",
    assignedTo: parseAssignedTo(rest.assignedTo),
    createdBy: rest.createdBy ?? "",
    contactId: rest.contactId ?? null,
    dealId: rest.dealId ?? null,
    projectId: rest.projectId ?? null,
    location: rest.location ?? null,
    color: rest.color ?? null,
    isPrivate: rest.isPrivate ?? false,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
  };
}

function toIso(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  if (d instanceof Date) return d.toISOString();
  return new Date(d).toISOString();
}

export async function listCalendarEvents(options?: {
  startAfter?: Date | string;
  endBefore?: Date | string;
  assignedTo?: string;
}): Promise<CalendarEvent[]> {
  const queries: string[] = [Query.limit(1000), Query.orderDesc("startAt")];

  if (options?.startAfter) {
    queries.push(Query.greaterThan("startAt", toIso(options.startAfter) ?? new Date().toISOString()));
  }
  if (options?.endBefore) {
    queries.push(Query.lessThan("endAt", toIso(options.endBefore) ?? new Date().toISOString()));
  }
  if (options?.assignedTo) {
    queries.push(Query.search("assignedTo", options.assignedTo));
  }

  const res = await databases.listDocuments(DB_ID, COLLECTIONS.calendarEvents, queries);
  return res.documents.map((d) => fromDoc(d));
}

export async function getCalendarEvent(id: string): Promise<CalendarEvent | null> {
  try {
    const doc = await databases.getDocument(DB_ID, COLLECTIONS.calendarEvents, id);
    return fromDoc(doc);
  } catch {
    return null;
  }
}

export async function createCalendarEvent(data: {
  title: string;
  description?: string | null;
  startAt: Date | string;
  endAt: Date | string;
  allDay?: boolean;
  type?: CalendarEvent["type"];
  assignedTo?: string[];
  createdBy: string;
  contactId?: string | null;
  dealId?: string | null;
  projectId?: string | null;
  location?: string | null;
  color?: string | null;
  isPrivate?: boolean;
}): Promise<CalendarEvent> {
  const now = new Date().toISOString();
  const doc = await databases.createDocument(DB_ID, COLLECTIONS.calendarEvents, ID.unique(), {
    title: data.title,
    description: data.description ?? null,
    startAt: toIso(data.startAt) ?? now,
    endAt: toIso(data.endAt) ?? now,
    allDay: data.allDay ?? false,
    type: data.type ?? "activity",
    assignedTo: serializeAssignedTo(data.assignedTo),
    createdBy: data.createdBy,
    contactId: data.contactId ?? null,
    dealId: data.dealId ?? null,
    projectId: data.projectId ?? null,
    location: data.location ?? null,
    color: data.color ?? null,
    isPrivate: data.isPrivate ?? false,
    createdAt: now,
    updatedAt: now,
  });
  return fromDoc(doc);
}

export async function updateCalendarEvent(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    startAt: Date | string;
    endAt: Date | string;
    allDay: boolean;
    type: CalendarEvent["type"];
    assignedTo: string[];
    contactId: string | null;
    dealId: string | null;
    projectId: string | null;
    location: string | null;
    color: string | null;
    isPrivate: boolean;
  }>,
): Promise<CalendarEvent> {
  const payload: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() };
  if (data.startAt !== undefined) payload.startAt = toIso(data.startAt) ?? null;
  if (data.endAt !== undefined) payload.endAt = toIso(data.endAt) ?? null;
  if (data.assignedTo !== undefined) payload.assignedTo = serializeAssignedTo(data.assignedTo);
  const doc = await databases.updateDocument(DB_ID, COLLECTIONS.calendarEvents, id, payload);
  return fromDoc(doc);
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.calendarEvents, id);
}
