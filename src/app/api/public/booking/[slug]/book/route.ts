import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import {
  getBookingLinkBySlug,
  createCalendarEvent,
  createBookingAppointment,
  updateBookingAppointment,
  incrementBookingCount,
} from "@/lib/db";
import { users } from "@/lib/appwrite";
import { availableSlotsForDate } from "@/lib/capture/booking-slots";
import { firstFreeBookingAssignee, parseBookingAssignees } from "@/lib/capture/booking-assignees";
import { ingestLead } from "@/lib/capture/ingest";
import { clientIp, track } from "@/lib/capture/analytics";
import { rateLimit } from "@/lib/capture/rate-limit";
import { sendEmail } from "@/lib/leads/automation/adapters/email";
import { triggerWorkflows } from "@/lib/workflows/trigger";

const CORS = { "Access-Control-Allow-Origin": "*" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function str(body: Record<string, unknown>, key: string): string | null {
  const v = body[key];
  return typeof v === "string" && v.trim().length ? v.trim() : null;
}

function reservationId(bookingLinkId: string, startIso: string): string {
  const hash = createHash("sha256")
    .update(`${bookingLinkId}:${startIso}`)
    .digest("hex")
    .slice(0, 28);
  return `slot_${hash}`;
}

async function assignedUserEmail(userId: string): Promise<string | null> {
  if (!userId) return null;
  try {
    const user = await users.get(userId);
    return user.email || null;
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ip = clientIp(request.headers) ?? "unknown";
  if (!rateLimit(`booking:${ip}`)) {
    return NextResponse.json(
      { success: false, error: "Troppe richieste. Riprova più tardi." },
      { status: 429, headers: CORS },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON invalido" },
      { status: 400, headers: CORS },
    );
  }

  const link = await getBookingLinkBySlug(slug);
  if (!link || link.status !== "active") {
    return NextResponse.json(
      { success: false, error: "Link non trovato" },
      { status: 404, headers: CORS },
    );
  }

  const guestName = str(body, "guestName") ?? str(body, "name");
  const guestEmail = str(body, "guestEmail") ?? str(body, "email");
  const guestPhone = str(body, "guestPhone") ?? str(body, "phone");
  const notes = str(body, "notes") ?? str(body, "message");
  const startRaw = str(body, "start");

  if (!guestName) {
    return NextResponse.json(
      { success: false, error: "Il nome è obbligatorio" },
      { status: 400, headers: CORS },
    );
  }
  if (!guestEmail || !EMAIL_RE.test(guestEmail)) {
    return NextResponse.json(
      { success: false, error: "Email non valida" },
      { status: 400, headers: CORS },
    );
  }
  if (!startRaw) {
    return NextResponse.json(
      { success: false, error: "Orario non selezionato" },
      { status: 400, headers: CORS },
    );
  }

  const startMs = Date.parse(startRaw);
  if (Number.isNaN(startMs)) {
    return NextResponse.json(
      { success: false, error: "Orario non valido" },
      { status: 400, headers: CORS },
    );
  }
  const startIso = new Date(startMs).toISOString();
  const date = startIso.slice(0, 10);

  // Re-validate the slot server-side: it must still be one of the free slots
  // for that day. This is the double-booking guard — never trust the client.
  const slots = await availableSlotsForDate(link, date);
  if (!slots.some((s) => s.start === startIso)) {
    return NextResponse.json(
      { success: false, error: "Questo orario non è più disponibile. Scegline un altro." },
      { status: 409, headers: CORS },
    );
  }

  const endIso = new Date(startMs + link.durationMinutes * 60_000).toISOString();
  const selectedAssignee = await firstFreeBookingAssignee(
    link.assignedTo,
    new Date(startIso),
    new Date(endIso),
  );
  if (parseBookingAssignees(link.assignedTo).length > 0 && !selectedAssignee) {
    return NextResponse.json(
      { success: false, error: "Questo orario non è più disponibile. Scegline un altro." },
      { status: 409, headers: CORS },
    );
  }

  try {
    // Lead capture is the source of truth and carries booking attribution.
    const { lead, duplicate } = await ingestLead(
      {
        name: guestName,
        email: guestEmail,
        phone: guestPhone,
        message: notes,
        source: "booking",
        bookingLinkId: link.id,
        landingPageId: str(body, "landingPageId"),
        funnelId: str(body, "funnelId"),
      },
      {
        ip,
        userAgent: request.headers.get("user-agent"),
        referrer: request.headers.get("referer"),
        sessionId: str(body, "sessionId"),
      },
    );

    const appointmentId = reservationId(link.id, startIso);
    try {
      await createBookingAppointment({
        id: appointmentId,
        bookingLinkId: link.id,
        calendarEventId: null,
        contactId: lead.contactId ?? null,
        guestName,
        guestEmail,
        guestPhone,
        guestNotes: notes,
        startAt: startIso,
        endAt: endIso,
        status: "confirmed",
      });
    } catch (error) {
      if (
        error instanceof Error &&
        /already exists|duplicate/i.test(error.message)
      ) {
        return NextResponse.json(
          { success: false, error: "Questo orario non Ã¨ piÃ¹ disponibile. Scegline un altro." },
          { status: 409, headers: CORS },
        );
      }
      throw error;
    }

    // Best-effort calendar event so the appointment shows on the assignee's
    // calendar; the reserved booking still stands if this fails.
    let calendarEventId: string | null = null;
    try {
      const event = await createCalendarEvent({
        title: `Prenotazione: ${guestName}`,
        description: notes,
        startAt: startIso,
        endAt: endIso,
        type: "meeting",
        assignedTo: selectedAssignee ? [selectedAssignee] : [],
        createdBy: link.createdBy ?? selectedAssignee ?? "system",
        contactId: lead.contactId ?? null,
      });
      calendarEventId = event.id;
      await updateBookingAppointment(appointmentId, { calendarEventId });
    } catch {
      calendarEventId = null;
    }

    // Best-effort side effects — never block the confirmation.
    const when = `${date} alle ${startIso.slice(11, 16)} (UTC)`;
    const assigneeEmail = await assignedUserEmail(selectedAssignee ?? "");
    await Promise.allSettled([
      incrementBookingCount(link.id),
      track("booking_confirm", "booking", link.id, {
        ip,
        userAgent: request.headers.get("user-agent"),
        referrer: request.headers.get("referer"),
        sessionId: str(body, "sessionId"),
      }),
      sendEmail({
        to: guestEmail,
        subject: `Prenotazione confermata — ${link.name}`,
        text: `Ciao ${guestName},\n\nLa tua prenotazione per "${link.name}" è confermata per il ${when}.\n\nA presto!`,
      }),
      ...(assigneeEmail && assigneeEmail !== guestEmail
        ? [
            sendEmail({
              to: assigneeEmail,
              subject: `Nuova prenotazione â€” ${link.name}`,
              text: `${guestName} (${guestEmail}) ha prenotato "${link.name}" per il ${when}.`,
            }),
          ]
        : []),
    ]);

    triggerWorkflows("booking_created", {
      bookingLinkId: link.id,
      appointmentId,
      contactId: lead.contactId,
      guestEmail,
      guestName,
      startAt: startIso,
      endAt: endIso,
    });

    return NextResponse.json(
      {
        success: true,
        duplicate,
        successMessage: link.successMessage,
        redirectUrl: link.redirectUrl,
      },
      { status: 201, headers: CORS },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Errore durante la prenotazione. Riprova." },
      { status: 500, headers: CORS },
    );
  }
}
