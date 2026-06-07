import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getLead,
  updateLead,
  updateContact,
  listCallTasks,
  updateCallTask,
  createCallTask,
  getOpenCallTaskForLead,
  getBookingLinkBySlug,
  listBookingLinks,
} from "@/lib/db";
import { moveLeadStage } from "@/lib/leads/pipeline";
import { leoIdentity, setterIdentity } from "@/lib/leads/automation";
import { parseBookingAssignees } from "@/lib/capture/booking-assignees";

const LEO_BOOKING_SLUG = process.env.LEO_BOOKING_SLUG || "call-leo";

// POST /api/leads/[id]/escalate-to-leo
// Cugina (setter) passes a qualified lead to Leo (closer): closes her open call
// task, opens Leo's closing call task, qualifies the lead, moves it to
// "opportunity", warms the contact, and returns Leo's booking link PRE-FILLED so
// she can book the closing call on his calendar in one click.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) {
    return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
  }

  try {
    const tasks = await listCallTasks({ leadId: id });

    // 1) Close the setter's open call task (records that call 1 qualified).
    const setterOpen = tasks.find(
      (t) =>
        t.assignedTo === setterIdentity.id &&
        (t.status === "pending" || t.status === "scheduled"),
    );
    if (setterOpen) {
      await updateCallTask(setterOpen.id, {
        status: "completed",
        callOutcome: "qualified",
        completedAt: new Date(),
      });
    }

    // 2) Open Leo's closing call task (idempotent — skip if one is already open).
    let leoOpen = tasks.find(
      (t) =>
        t.assignedTo === leoIdentity.id &&
        (t.status === "pending" || t.status === "scheduled"),
    );
    if (!leoOpen) {
      try {
        leoOpen = await createCallTask({
          leadId: id,
          assignedTo: leoIdentity.id,
          assigneeName: leoIdentity.name,
          status: "pending",
          notes: `Call di chiusura — lead scremato da ${setterIdentity.name}`,
        });
      } catch (error: unknown) {
        // Race condition: another request created the task concurrently.
        // Fetch the existing open task and continue.
        const existing = await getOpenCallTaskForLead(id, leoIdentity.id);
        if (!existing) throw error;
        leoOpen = existing;
      }
    }

    // 3) Qualify + advance the lead, warm the linked contact.
    await updateLead(id, { status: "qualified" });
    await moveLeadStage({
      leadId: id,
      toStage: "opportunity",
      reason: "passaggio a Leo (call di chiusura)",
      triggeredBy: auth.user?.email ?? "user",
    });
    if (lead.contactId) {
      try {
        await updateContact(lead.contactId, { temperature: "warm" });
      } catch {
        // non-blocking
      }
    }

    // 4) Resolve Leo's booking link and build a PRE-FILLED URL.
    let link = await getBookingLinkBySlug(LEO_BOOKING_SLUG);
    if (!link) {
      const all = await listBookingLinks();
      link =
        all.find(
          (l) =>
            l.status === "active" &&
            parseBookingAssignees(l.assignedTo).includes(leoIdentity.id),
        ) ??
        all.find((l) => l.status === "active") ??
        null;
    }

    let bookingUrl: string | null = null;
    if (link) {
      const qs = new URLSearchParams();
      if (lead.fullName) qs.set("name", lead.fullName);
      if (lead.email) qs.set("email", lead.email);
      if (lead.phone) qs.set("phone", lead.phone);
      qs.set("leadId", lead.id);
      bookingUrl = `/book/${link.slug}?${qs.toString()}`;
    }

    return NextResponse.json({
      success: true,
      leadId: id,
      escalatedTo: leoIdentity.name,
      bookingUrl,
      bookingSlug: link?.slug ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Errore nel passaggio a ${leoIdentity.name}: ${
          error instanceof Error ? error.message : "sconosciuto"
        }`,
      },
      { status: 500 },
    );
  }
}
