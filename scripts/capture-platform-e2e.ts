#!/usr/bin/env node
import { config } from "dotenv";

config({ path: ".env.local" });

const BASE_URL = process.env.CAPTURE_E2E_BASE_URL || "http://localhost:3001";
const marker = `e2e-${Date.now()}`;
const email = `${marker}@example.com`;
const bookingEmail = `booking-${marker}@example.com`;
const results: Array<{ name: string; passed: boolean; error?: string }> = [];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: message });
    console.error(`❌ ${name}: ${message}`);
  }
}

async function json(url: string, init?: RequestInit) {
  const response = await fetch(`${BASE_URL}${url}`, init);
  const body = await response.json().catch(() => null);
  return { response, body };
}

function futureDate(offset: number): string {
  const date = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

async function main() {
  const db = await import("@/lib/db");
  const { users } = await import("@/lib/appwrite");
  const { createBlock, defaultFormFields, emptyLandingConfig } = await import("@/lib/capture/defaults");
  const { firstFreeBookingAssignee } = await import("@/lib/capture/booking-assignees");

  let formId = "";
  let landingId = "";
  let landingSlug = "";
  let bookingId = "";
  let bookingSlug = "";
  let bookedStart = "";
  let funnelId = "";
  let funnelSlug = "";
  let firstStepId = "";
  let secondStepId = "";
  let sessionId = "";

  await test("A1 Appwrite and Next dev server are reachable", async () => {
    await db.listLandingPages();
    const templates = await db.listLandingTemplates();
    assert(templates.length >= 3, `expected seeded landing templates, found ${templates.length}`);
    const response = await fetch(BASE_URL);
    assert(response.status < 500, `Next dev server returned ${response.status}`);
  });

  await test("A2 Form builder persistence creates an active custom form", async () => {
    const fields = defaultFormFields();
    const form = await db.createForm({
      name: `[E2E] Form ${marker}`,
      fields: JSON.stringify(fields),
    });
    formId = form.id;
    await db.updateForm(form.id, { status: "active" });
    const publicForm = await json(`/api/public/forms/${form.id}`);
    assert(publicForm.response.status === 200, `public form status ${publicForm.response.status}`);
    assert(publicForm.body.id === form.id, "public form id mismatch");
  });

  await test("A3 Landing SSR publishes selected form and advanced conversion blocks", async () => {
    const config = emptyLandingConfig();
    const formBlock = createBlock("form");
    if (formBlock.type !== "form") throw new Error("form block factory mismatch");
    formBlock.formId = formId;
    formBlock.heading = `Contatto ${marker}`;
    config.blocks.push(formBlock);
    for (const type of ["logos", "faq", "reviews", "offer", "comparison"] as const) {
      config.blocks.push(createBlock(type));
    }
    const landing = await db.createLandingPage({
      name: `[E2E] Landing ${marker}`,
      config: JSON.stringify(config),
      metaTitle: `Landing ${marker}`,
      metaDescription: "Capture E2E",
    });
    landingId = landing.id;
    landingSlug = landing.slug;
    await db.updateLandingPage(landing.id, {
      status: "published",
      faviconUrl: "https://example.com/favicon.ico",
    });
    const response = await fetch(`${BASE_URL}/l/${landing.slug}`);
    const html = await response.text();
    assert(response.status === 200, `landing SSR status ${response.status}`);
    assert(html.includes(`Landing ${marker}`), "dynamic landing metadata missing from SSR");
    assert(html.includes("https://example.com/favicon.ico"), "dynamic landing favicon missing from SSR");
    assert(html.includes("Come visto su"), "logos block missing from SSR");
    assert(html.includes("<details"), "native FAQ details missing from SSR");
    assert(html.includes("312 recensioni"), "reviews block missing from SSR");
    assert(html.includes("data-sx-cta"), "offer CTA tracking attribute missing from SSR");
    assert(html.includes('id="form"'), "landing form anchor target missing from SSR");
    assert(html.includes("PerchÃ© scegliere noi") || html.includes("Perché scegliere noi"), "comparison block missing from SSR");
  });

  await test("A4 Form submit creates attributed lead, CRM contact and submission", async () => {
    const form = await db.getForm(formId);
    assert(form, "form missing");
    const fields = JSON.parse(form.fields) as Array<{ id: string; crmField: string }>;
    const values = Object.fromEntries(fields.map((field) => {
      if (field.crmField === "name") return [field.id, `Lead ${marker}`];
      if (field.crmField === "email") return [field.id, email];
      if (field.crmField === "phone") return [field.id, `+3900${Date.now()}`];
      if (field.crmField === "message") return [field.id, "Richiesta E2E"];
      return [field.id, "E2E"];
    }));
    const submit = await json(`/api/public/forms/${formId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values, landingPageId: landingId, sessionId: marker }),
    });
    assert(submit.response.status === 201, `form submit status ${submit.response.status}`);
    const lead = (await db.listLeads()).find((item) => item.email === email);
    assert(lead, "attributed lead not created");
    assert(lead.formId === formId, "lead formId missing");
    assert(lead.landingPageId === landingId, "lead landingPageId missing");
    assert(lead.contactId, "lead contactId missing");
    const contact = (await db.listContacts()).find((item) => item.email === email);
    assert(contact?.id === lead.contactId, "CRM contact not linked to lead");
    const submissions = await db.listFormSubmissions({ formId });
    assert(submissions.some((item) => item.landingPageId === landingId), "form submission attribution missing");
  });

  await test("A5 Booking availability, reservation, event, contact and double-book guard work", async () => {
    const userList = await users.list();
    const primaryAssignee = userList.users[0]?.$id ?? "e2e-system";
    const assignedTo = `${primaryAssignee},e2e-backup-${marker}`;
    const link = await db.createBookingLink({ name: `[E2E] Booking ${marker}`, assignedTo });
    bookingId = link.id;
    bookingSlug = link.slug;

    let slot: { start: string } | null = null;
    for (let offset = 1; offset <= 21 && !slot; offset += 1) {
      const availability = await json(`/api/public/booking/${link.slug}/availability?date=${futureDate(offset)}`);
      if (availability.response.ok && Array.isArray(availability.body.slots) && availability.body.slots.length) {
        slot = availability.body.slots[0];
      }
    }
    assert(slot, "no future booking slot found");
    bookedStart = slot.start;
    const payload = {
      start: slot.start,
      guestName: `Booking ${marker}`,
      guestEmail: bookingEmail,
      guestPhone: `+3911${Date.now()}`,
      notes: "Booking E2E",
      sessionId: marker,
    };
    const booked = await json(`/api/public/booking/${link.slug}/book`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    assert(booked.response.status === 201, `booking status ${booked.response.status}`);
    const appointments = await db.listBookingAppointments({ bookingLinkId: link.id });
    const appointment = appointments.find((item) => item.startAt.toISOString() === slot?.start);
    assert(appointment, "booking appointment missing");
    assert(appointment.calendarEventId, "calendar event link missing");
    assert(appointment.contactId, "booking contact link missing");
    const calendarEvent = await db.getCalendarEvent(appointment.calendarEventId);
    assert(calendarEvent?.assignedTo.length === 1, "booking calendar event must select one assignee");
    assert(assignedTo.split(",").includes(calendarEvent.assignedTo[0]), "booking assignee not selected from configured pool");
    assert(
      await firstFreeBookingAssignee(calendarEvent.assignedTo[0], appointment.startAt, appointment.endAt) === null,
      "calendar overlap query did not mark the selected assignee busy",
    );
    const duplicate = await json(`/api/public/booking/${link.slug}/book`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    assert(duplicate.response.status === 409, `double booking returned ${duplicate.response.status}`);
  });

  await test("A6 Funnel public routing completes two steps and creates a deal", async () => {
    const secondLanding = await db.createLandingPage({
      name: `[E2E] Funnel second ${marker}`,
      config: JSON.stringify(emptyLandingConfig()),
    });
    await db.updateLandingPage(secondLanding.id, { status: "published" });
    firstStepId = `step-one-${marker}`;
    secondStepId = `step-two-${marker}`;
    const funnel = await db.createFunnel({
      name: `[E2E] Funnel ${marker}`,
      steps: JSON.stringify([
        { id: firstStepId, name: "Uno", landingPageId: landingId, nextStepId: secondStepId, conditions: [] },
        { id: secondStepId, name: "Due", landingPageId: secondLanding.id, nextStepId: null, conditions: [] },
      ]),
    });
    funnelId = funnel.id;
    funnelSlug = funnel.slug;
    await db.updateFunnel(funnel.id, { status: "active" });

    const entry = await fetch(`${BASE_URL}/f/${funnel.slug}`, { redirect: "manual" });
    assert(entry.status === 307 || entry.status === 308, `funnel entry status ${entry.status}`);
    const location = entry.headers.get("location");
    assert(location, "funnel entry redirect missing");
    sessionId = new URL(location, BASE_URL).searchParams.get("sid") ?? "";
    assert(sessionId, "funnel session id missing");
    const [firstPage, concurrentFirstPage] = await Promise.all([
      fetch(new URL(location, BASE_URL)),
      fetch(new URL(location, BASE_URL)),
    ]);
    assert(firstPage.status === 200, `first funnel step status ${firstPage.status}`);
    assert(concurrentFirstPage.status === 200, `concurrent first funnel step status ${concurrentFirstPage.status}`);
    const sessions = await db.listFunnelSessions(funnel.id);
    assert(sessions.filter((item) => item.sessionId === sessionId).length === 1, "concurrent funnel SSR created duplicate sessions");

    const first = await json(`/api/public/funnel/${funnel.slug}/step/${firstStepId}/submit`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Funnel ${marker}`, email: `funnel-${email}`, message: "Step 1", sessionId }),
    });
    assert(first.response.status === 200, `first funnel submit status ${first.response.status}`);
    assert(String(first.body.redirectUrl).includes(secondStepId), "funnel did not advance to second step");
    const secondPage = await fetch(new URL(first.body.redirectUrl, BASE_URL));
    assert(secondPage.status === 200, `second funnel step status ${secondPage.status}`);
    const second = await json(`/api/public/funnel/${funnel.slug}/step/${secondStepId}/submit`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Funnel ${marker}`, email: `funnel-${email}`, message: "Step 2", sessionId }),
    });
    assert(second.response.status === 200, `second funnel submit status ${second.response.status}`);
    assert(second.body.dealId, "funnel completion did not create deal");
    const session = await db.getFunnelSession(funnel.id, sessionId);
    assert(session?.completed, "funnel session not marked complete");
    const events = await db.listFunnelEvents(funnel.id);
    assert(events.some((event) => event.eventType === "funnel_complete"), "funnel_complete event missing");
  });

  await test("A7 Analytics events exist for landing, form, booking and funnel assets", async () => {
    const events = await db.listAnalyticsEvents();
    assert(events.some((event) => event.assetType === "landing" && event.assetId === landingId), "landing analytics missing");
    assert(events.some((event) => event.assetType === "form" && event.assetId === formId), "form analytics missing");
    assert(events.some((event) => event.assetType === "booking" && event.assetId === bookingId), "booking analytics missing");
    assert(events.some((event) => event.assetType === "funnel" && event.assetId === funnelId), "funnel analytics missing");
  });

  console.log("\n--- Capture Platform E2E summary ---");
  for (const result of results) console.log(`${result.passed ? "✅" : "❌"} ${result.name}`);
  console.log(`\nArtifacts: landing=/l/${landingSlug}, booking=/book/${bookingSlug} start=${bookedStart}, funnel=/f/${funnelSlug}, sid=${sessionId}`);
  const failed = results.filter((result) => !result.passed);
  if (failed.length) {
    console.error(`\nCapture Platform E2E: ${results.length - failed.length} passed, ${failed.length} failed`);
    process.exitCode = 1;
  } else {
    console.log(`\nCapture Platform E2E: ${results.length}/${results.length} passed`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
