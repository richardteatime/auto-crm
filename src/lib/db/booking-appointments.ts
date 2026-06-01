import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";
import type { BookingAppointment, BookingAppointmentStatus } from "@/lib/capture/types";

function toIso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function fromDoc(doc: Models.Document): BookingAppointment {
  const { $id, $createdAt, ...rest } = doc;
  return {
    id: $id,
    bookingLinkId: rest.bookingLinkId ?? "",
    calendarEventId: rest.calendarEventId ?? null,
    contactId: rest.contactId ?? null,
    guestName: rest.guestName ?? "",
    guestEmail: rest.guestEmail ?? "",
    guestPhone: rest.guestPhone ?? null,
    guestNotes: rest.guestNotes ?? null,
    startAt: rest.startAt ? new Date(rest.startAt) : new Date(),
    endAt: rest.endAt ? new Date(rest.endAt) : new Date(),
    status: (rest.status ?? "confirmed") as BookingAppointmentStatus,
    createdAt: new Date($createdAt),
  };
}

export async function listBookingAppointments(filters?: {
  bookingLinkId?: string;
}): Promise<BookingAppointment[]> {
  const queries: string[] = [Query.limit(500), Query.orderDesc("startAt")];
  if (filters?.bookingLinkId) queries.push(Query.equal("bookingLinkId", filters.bookingLinkId));
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.bookingAppointments, queries);
  return res.documents.map(fromDoc);
}

export async function listAppointmentsInRange(
  startAfter: Date | string,
  endBefore: Date | string,
): Promise<BookingAppointment[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.bookingAppointments, [
    Query.greaterThanEqual("startAt", toIso(startAfter)),
    Query.lessThanEqual("startAt", toIso(endBefore)),
    Query.limit(1000),
  ]);
  return res.documents.map(fromDoc);
}

export async function createBookingAppointment(data: {
  id?: string;
  bookingLinkId: string;
  calendarEventId?: string | null;
  contactId?: string | null;
  guestName: string;
  guestEmail: string;
  guestPhone?: string | null;
  guestNotes?: string | null;
  startAt: Date | string;
  endAt: Date | string;
  status?: BookingAppointmentStatus;
}): Promise<BookingAppointment> {
  const doc = await databases.createDocument(DB_ID, COLLECTIONS.bookingAppointments, data.id ?? ID.unique(), {
    bookingLinkId: data.bookingLinkId,
    calendarEventId: data.calendarEventId ?? null,
    contactId: data.contactId ?? null,
    guestName: data.guestName,
    guestEmail: data.guestEmail,
    guestPhone: data.guestPhone ?? null,
    guestNotes: data.guestNotes ?? null,
    startAt: toIso(data.startAt),
    endAt: toIso(data.endAt),
    status: data.status ?? "confirmed",
    createdAt: new Date().toISOString(),
  });
  return fromDoc(doc);
}

export async function updateBookingAppointment(
  id: string,
  data: Partial<{
    calendarEventId: string | null;
    contactId: string | null;
    status: BookingAppointmentStatus;
  }>,
): Promise<BookingAppointment> {
  const doc = await databases.updateDocument(
    DB_ID,
    COLLECTIONS.bookingAppointments,
    id,
    data,
  );
  return fromDoc(doc);
}
