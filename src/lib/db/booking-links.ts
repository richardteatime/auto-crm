import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { BookingLink, BookingLinkStatus } from "@/lib/capture/types";
import { defaultAvailability } from "@/lib/capture/defaults";
import { uniqueSlug } from "@/lib/capture/slug";

function fromDoc(doc: Models.Document): BookingLink {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    name: rest.name ?? "",
    slug: rest.slug ?? "",
    assignedTo: rest.assignedTo ?? "",
    durationMinutes: rest.durationMinutes ?? 30,
    availability: rest.availability ?? "{}",
    successMessage: rest.successMessage ?? "Prenotazione confermata!",
    redirectUrl: rest.redirectUrl ?? null,
    status: (rest.status ?? "active") as BookingLinkStatus,
    bookingsCount: rest.bookingsCount ?? 0,
    createdBy: rest.createdBy ?? null,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
  };
}

export async function bookingSlugExists(slug: string): Promise<boolean> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.bookingLinks, [
    Query.equal("slug", slug),
    Query.limit(1),
  ]);
  return res.documents.length > 0;
}

export async function listBookingLinks(): Promise<BookingLink[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.bookingLinks, [
    Query.limit(500),
    Query.orderDesc("$createdAt"),
  ]);
  return res.documents.map(fromDoc);
}

export async function getBookingLink(id: string): Promise<BookingLink | null> {
  try {
    return fromDoc(await databases.getDocument(DB_ID, COLLECTIONS.bookingLinks, id));
  } catch {
    return null;
  }
}

export async function getBookingLinkBySlug(slug: string): Promise<BookingLink | null> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.bookingLinks, [
    Query.equal("slug", slug),
    Query.limit(1),
  ]);
  return res.documents.length ? fromDoc(res.documents[0]) : null;
}

export async function createBookingLink(data: {
  name: string;
  assignedTo: string;
  durationMinutes?: number;
  availability?: string;
  successMessage?: string;
  createdBy?: string | null;
}): Promise<BookingLink> {
  const now = new Date().toISOString();
  const slug = await uniqueSlug(data.name, bookingSlugExists);
  const doc = await databases.createDocument(DB_ID, COLLECTIONS.bookingLinks, ID.unique(), {
    name: data.name,
    slug,
    assignedTo: data.assignedTo,
    durationMinutes: data.durationMinutes ?? 30,
    availability: data.availability ?? JSON.stringify(defaultAvailability()),
    successMessage: data.successMessage ?? "Prenotazione confermata! Ti abbiamo inviato una email.",
    redirectUrl: null,
    status: "active",
    bookingsCount: 0,
    createdBy: data.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return fromDoc(doc);
}

export async function updateBookingLink(
  id: string,
  data: Partial<{
    name: string;
    assignedTo: string;
    durationMinutes: number;
    availability: string;
    successMessage: string;
    redirectUrl: string | null;
    status: BookingLinkStatus;
  }>,
): Promise<BookingLink> {
  const payload: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() };
  const doc = await databases.updateDocument(DB_ID, COLLECTIONS.bookingLinks, id, payload);
  return fromDoc(doc);
}

export async function deleteBookingLink(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.bookingLinks, id);
}

export async function incrementBookingCount(id: string): Promise<void> {
  const link = await getBookingLink(id);
  if (!link) return;
  await databases.updateDocument(DB_ID, COLLECTIONS.bookingLinks, id, {
    bookingsCount: (link.bookingsCount ?? 0) + 1,
  });
}
