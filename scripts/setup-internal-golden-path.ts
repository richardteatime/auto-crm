#!/usr/bin/env node
import { config } from "dotenv";

config({ path: ".env.local" });

const FORM_NAME = "Richiedi una consulenza SarconX";
const BOOKING_NAME = "Call conoscitiva con Leonardo";
const FORM_WORKFLOW_NAME = "Lead dal form: notifica team";
const BOOKING_WORKFLOW_NAME = "Prenotazione Leonardo: notifica team";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

async function main() {
  const db = await import("@/lib/db");
  const { users } = await import("@/lib/appwrite");
  const { createFormField, defaultFormFields } = await import("@/lib/capture/defaults");

  const authUsers = await users.list();
  const notifyUserId =
    process.env.INTERNAL_NOTIFY_USER_ID ||
    authUsers.users[0]?.$id ||
    "";
  if (!notifyUserId) {
    throw new Error("Nessun utente Auth disponibile per le notifiche interne.");
  }

  // Leonardo has no Auth account in the current internal alpha. Keep the
  // logical identity already used by lead automations until LEO_USER_ID is
  // configured with a real Appwrite Auth user.
  const leoUserId = process.env.LEO_USER_ID || "leo";
  const createdBy = authUsers.users[0]?.$id ?? notifyUserId;

  const existingBooking = (await db.listBookingLinks()).find(
    (item) => item.name === BOOKING_NAME,
  );
  const booking = existingBooking
    ? await db.updateBookingLink(existingBooking.id, {
        assignedTo: leoUserId,
        durationMinutes: 30,
        status: "active",
        successMessage: "Prenotazione confermata! Ti ricontatteremo a breve.",
      })
    : await db.createBookingLink({
        name: BOOKING_NAME,
        assignedTo: leoUserId,
        durationMinutes: 30,
        createdBy,
        successMessage: "Prenotazione confermata! Ti ricontatteremo a breve.",
      });

  const bookingUrl = `${appUrl()}/book/${booking.slug}`;
  const existingForm = (await db.listForms()).find((item) => item.name === FORM_NAME);
  const fields = existingForm
    ? JSON.parse(existingForm.fields)
    : defaultFormFields();
  if (!fields.some((field: { crmField: string }) => field.crmField === "company")) {
    fields.push({
      ...createFormField("text"),
      label: "Azienda",
      placeholder: "La tua azienda",
      crmField: "company",
    });
  }
  if (!fields.some((field: { crmField: string }) => field.crmField === "budget")) {
    fields.push({
      ...createFormField("number"),
      label: "Budget indicativo (€)",
      placeholder: "1500",
      crmField: "budget",
    });
  }
  const form = existingForm
    ? await db.updateForm(existingForm.id, {
        description: "Raccoglie i dati del prospect e lo accompagna alla prenotazione della call.",
        fields: JSON.stringify(fields),
        redirectUrl: bookingUrl,
        status: "active",
        successMessage: "Richiesta ricevuta. Ora scegli l'orario della call.",
      })
    : await db.createForm({
        name: FORM_NAME,
        description: "Raccoglie i dati del prospect e lo accompagna alla prenotazione della call.",
        fields: JSON.stringify(fields),
        successMessage: "Richiesta ricevuta. Ora scegli l'orario della call.",
        createdBy,
      });
  if (!existingForm) {
    await db.updateForm(form.id, { redirectUrl: bookingUrl, status: "active" });
  }

  const formNodes = JSON.stringify([
    {
      id: "trigger_form_submitted",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: { nodeType: "form_submitted", label: "Form Inviato", config: {} },
    },
    {
      id: "notify_team_new_lead",
      type: "action",
      position: { x: 0, y: 180 },
      data: {
        nodeType: "send_internal_message",
        label: "Notifica team",
        config: {
          userId: notifyUserId,
          message:
            "Nuovo lead dal form: {{trigger.payload.name}} · {{trigger.payload.email}} · lead {{trigger.payload.leadId}}",
        },
      },
    },
  ]);
  const formEdges = JSON.stringify([
    { id: "form_to_notification", source: "trigger_form_submitted", target: "notify_team_new_lead" },
  ]);

  const bookingNodes = JSON.stringify([
    {
      id: "trigger_booking_created",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: { nodeType: "booking_created", label: "Prenotazione Creata", config: {} },
    },
    {
      id: "notify_team_booking",
      type: "action",
      position: { x: 0, y: 180 },
      data: {
        nodeType: "send_internal_message",
        label: "Notifica team",
        config: {
          userId: notifyUserId,
          message:
            "Nuova prenotazione per Leonardo: {{trigger.payload.guestName}} · {{trigger.payload.guestEmail}} · {{trigger.payload.startAt}}",
        },
      },
    },
  ]);
  const bookingEdges = JSON.stringify([
    { id: "booking_to_notification", source: "trigger_booking_created", target: "notify_team_booking" },
  ]);

  async function upsertWorkflow(input: {
    name: string;
    description: string;
    triggerType: string;
    nodes: string;
    edges: string;
  }) {
    const existing = (await db.listWorkflows()).find((item) => item.name === input.name);
    if (existing) {
      return db.updateWorkflow(existing.id, {
        description: input.description,
        triggerType: input.triggerType,
        nodes: input.nodes,
        edges: input.edges,
        status: "active",
      });
    }
    const workflow = await db.createWorkflow({ ...input, createdBy });
    return db.updateWorkflow(workflow.id, { status: "active" });
  }

  const formWorkflow = await upsertWorkflow({
    name: FORM_WORKFLOW_NAME,
    description: "Notifica il team interno quando un prospect invia il form pubblico.",
    triggerType: "form_submitted",
    nodes: formNodes,
    edges: formEdges,
  });
  const bookingWorkflow = await upsertWorkflow({
    name: BOOKING_WORKFLOW_NAME,
    description: "Notifica il team interno quando un prospect prenota una call con Leonardo.",
    triggerType: "booking_created",
    nodes: bookingNodes,
    edges: bookingEdges,
  });

  console.log("Golden path interno configurato.");
  console.log(`Form pubblico: ${appUrl()}/form/${form.id}`);
  console.log(`Booking pubblico: ${bookingUrl}`);
  console.log(`Host booking: ${leoUserId}`);
  console.log(`Notifiche interne: ${notifyUserId}`);
  console.log(`Workflow form: ${formWorkflow.id}`);
  console.log(`Workflow booking: ${bookingWorkflow.id}`);
  console.log(
    process.env.RESEND_API_KEY
      ? "Email outbound: configurata"
      : "Email outbound: non configurata (skip sicuro; redirect booking attivo)",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
