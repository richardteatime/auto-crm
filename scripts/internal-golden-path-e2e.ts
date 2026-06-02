#!/usr/bin/env node
import { config } from "dotenv";
import { NextResponse } from "next/server";

config({ path: ".env.local" });

const BASE_URL = process.env.CAPTURE_E2E_BASE_URL || "http://localhost:3000";
const FORM_NAME = "Richiedi una consulenza SarconX";
const BOOKING_NAME = "Call conoscitiva con Leonardo";
const FORM_WORKFLOW_NAME = "Lead dal form: notifica team";
const BOOKING_WORKFLOW_NAME = "Prenotazione Leonardo: notifica team";
const stamp = Date.now();
const marker = `golden-e2e-${stamp}`;
const email = `${marker}@example.com`;
const fullName = `[E2E] Golden Path ${stamp}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function json(url: string, init?: RequestInit) {
  const response = await fetch(`${BASE_URL}${url}`, init);
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function waitFor<T>(
  fn: () => Promise<T | null | undefined | false>,
  label: string,
  timeoutMs = 8_000,
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await fn();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timeout: ${label}`);
}

function futureDate(offset: number): string {
  return new Date(Date.now() + offset * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

async function main() {
  const db = await import("@/lib/db");
  const { users } = await import("@/lib/appwrite");
  const { setSessionCookie } = await import("@/lib/auth");

  console.log("\n=== Internal Golden Path E2E ===\n");

  const form = (await db.listForms()).find((item) => item.name === FORM_NAME);
  const booking = (await db.listBookingLinks()).find((item) => item.name === BOOKING_NAME);
  const workflows = await db.listWorkflows();
  const formWorkflow = workflows.find((item) => item.name === FORM_WORKFLOW_NAME);
  const bookingWorkflow = workflows.find((item) => item.name === BOOKING_WORKFLOW_NAME);
  assert(form?.status === "active", "form golden path non attivo");
  assert(booking?.status === "active", "booking Leonardo non attivo");
  assert(booking.assignedTo === (process.env.LEO_USER_ID || "leo"), "host booking inatteso");
  assert(formWorkflow?.status === "active", "workflow form non attivo");
  assert(bookingWorkflow?.status === "active", "workflow booking non attivo");
  console.log("✅ Configurazione persistente attiva");

  const [formPage, bookingPage] = await Promise.all([
    fetch(`${BASE_URL}/form/${form.id}`),
    fetch(`${BASE_URL}/book/${booking.slug}`),
  ]);
  assert(formPage.status === 200, `pagina form status ${formPage.status}`);
  assert(bookingPage.status === 200, `pagina booking status ${bookingPage.status}`);
  console.log("✅ Pagine pubbliche raggiungibili");

  const fields = JSON.parse(form.fields) as Array<{ id: string; crmField: string }>;
  const values = Object.fromEntries(fields.map((field) => {
    if (field.crmField === "name") return [field.id, fullName];
    if (field.crmField === "email") return [field.id, email];
    if (field.crmField === "phone") return [field.id, `+3900${stamp}`];
    if (field.crmField === "message") return [field.id, "Mi serve un sito statico per il mio ristorante. Budget 1500 euro."];
    if (field.crmField === "company") return [field.id, `Trattoria Rossi [E2E] ${stamp}`];
    if (field.crmField === "budget") return [field.id, "1500"];
    return [field.id, marker];
  }));
  const submitted = await json(`/api/public/forms/${form.id}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values, sessionId: marker }),
  });
  assert(submitted.response.status === 201, `form submit status ${submitted.response.status}`);
  assert(submitted.body?.redirectUrl === `${BASE_URL}/book/${booking.slug}`, "redirect al booking mancante");

  const lead = await waitFor(
    async () => (await db.listLeads()).find((item) => item.email === email),
    "lead creato dal form",
  );
  assert(lead.contactId, "lead senza contactId");
  assert(lead.category === "static_website", `categoria Capture inattesa: ${lead.category}`);
  assert(lead.leadScore === 100, `lead score Capture inatteso: ${lead.leadScore}`);
  assert(JSON.parse(lead.customFields ?? "{}").budget === "1500", "budget Capture non persistito");
  const callTask = await waitFor(
    () => db.getOpenCallTaskForLead(lead.id),
    "call task Leo",
  );
  assert(callTask.assignedTo === (process.env.LEO_USER_ID || "leo"), "call task non assegnata a Leo");
  console.log("✅ Form → lead deduplicabile → contatto CRM → task Leo → redirect booking");

  const authUsers = await users.list();
  const internalUserId = process.env.INTERNAL_NOTIFY_USER_ID || authUsers.users[0]?.$id;
  assert(internalUserId, "utente notifiche interne non trovato");
  await waitFor(
    async () => (await db.listNotifications(internalUserId)).find((item) => item.body.includes(email)),
    "notifica visual workflow form",
  );
  console.log("✅ Workflow visuale form_submitted → notifica interna");

  let slot: { start: string } | null = null;
  for (let offset = 1; offset <= 21 && !slot; offset += 1) {
    const availability = await json(`/api/public/booking/${booking.slug}/availability?date=${futureDate(offset)}`);
    if (availability.response.ok && Array.isArray(availability.body?.slots)) {
      slot = availability.body.slots[0] ?? null;
    }
  }
  assert(slot, "nessuno slot booking disponibile nei prossimi 21 giorni");
  const booked = await json(`/api/public/booking/${booking.slug}/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start: slot.start,
      guestName: fullName,
      guestEmail: email,
      guestPhone: `+3900${stamp}`,
      notes: marker,
      sessionId: marker,
    }),
  });
  assert(booked.response.status === 201, `booking status ${booked.response.status}`);
  const appointment = await waitFor(
    async () => (await db.listBookingAppointments({ bookingLinkId: booking.id }))
      .find((item) => item.guestEmail === email),
    "booking appointment",
  );
  assert(appointment.calendarEventId, "booking senza calendarEventId");
  const calendarEvent = await db.getCalendarEvent(appointment.calendarEventId);
  assert(calendarEvent?.assignedTo.includes(process.env.LEO_USER_ID || "leo"), "evento calendario non assegnato a Leo");
  const bookedLead = await db.getLead(lead.id);
  assert(bookedLead?.leadScore === 100, `lead score degradato dopo booking: ${bookedLead?.leadScore}`);
  await waitFor(
    async () => (await db.listNotifications(internalUserId))
      .find((item) => item.body.includes(email) && item.body.includes("prenotazione")),
    "notifica visual workflow booking",
  );
  console.log("✅ Booking Leonardo-only → appointment → calendario → notifica interna");

  const sessionResponse = NextResponse.json({});
  setSessionCookie(sessionResponse, internalUserId, `golden-e2e-session-${stamp}`);
  const token = sessionResponse.cookies.get("appwrite-session")?.value;
  assert(token, "cookie autenticato di test non generato");
  const authHeaders = {
    "Content-Type": "application/json",
    Cookie: `appwrite-session=${token}`,
  };

  const outcome = await json(`/api/leads/${lead.id}/call-outcome`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      outcome: "needs_quote",
      notes: "Cliente interessato: sito ristorante, budget 1500 euro, richiede proposta definitiva.",
    }),
  });
  assert(outcome.response.status === 200, `call outcome status ${outcome.response.status}`);
  const routedLead = await db.getLead(lead.id);
  assert(routedLead?.pipelineStage === "proposal", "lead non spostato a proposal");
  assert(routedLead.status === "qualified", "lead non qualificato dopo call");
  console.log("✅ Note call → outcome needs_quote → proposta");

  const draft = await json(`/api/leads/${lead.id}/generate-quote`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({}),
  });
  assert([200, 201].includes(draft.response.status), `draft quote status ${draft.response.status}`);
  assert(draft.body?.quote?.category === "static_website", "categoria bozza preventivo inattesa");
  assert(draft.body?.quote?.amountSuggested === 120000, "prezzo bozza preventivo inatteso");
  assert(draft.body?.quote?.generatedText?.includes("Budget cliente: € 1500"), "budget cliente assente dalla bozza");
  const converted = await json(`/api/leads/${lead.id}/convert-to-quote`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({}),
  });
  assert(converted.response.status === 201, `convert quote status ${converted.response.status}: ${converted.body?.error ?? ""}`);
  assert(converted.body?.pdfUrl, "pdfUrl preventivo mancante");
  const pdf = await fetch(`${BASE_URL}${converted.body.pdfUrl}`, {
    headers: { Cookie: `appwrite-session=${token}` },
  });
  assert(pdf.status === 200, `PDF status ${pdf.status}`);
  assert((pdf.headers.get("content-type") ?? "").includes("text/html"), "documento A4 content-type inatteso");
  const printableQuote = await pdf.text();
  assert(printableQuote.includes("PREVENTIVO"), "documento A4 senza intestazione preventivo");
  assert(printableQuote.includes("Stampa / Salva PDF"), "documento A4 senza comando stampa PDF");
  console.log("✅ Bozza → preventivo definitivo → documento A4 stampabile PDF");

  console.log(`\nGolden path verificato con artefatti temporanei marcati: ${marker}`);
  console.log("Esegui `npx tsx scripts/cleanup-test-artifacts.ts --apply` per ripulirli.");
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
