import type { Metadata } from "next";
import { getContactWithRelations, listDeals, getStages, getContact } from "@/lib/db";
import { notFound } from "next/navigation";
import { ContactDetailClient } from "@/components/contacts/ContactDetail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const contact = await getContact(id);
  return { title: contact?.name ?? "Contatto" };
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const now = new Date();

  const contact = await getContactWithRelations(id);
  if (!contact) notFound();

  const [contactDeals, stages] = await Promise.all([listDeals({ contactId: id }), getStages()]);

  const dealsWithStage = contactDeals.map((d) => {
    const stage = stages.find((s) => s.id === d.stageId);
    return {
      id: d.id,
      title: d.title,
      value: d.value ?? 0,
      probability: d.probability ?? 0,
      stageName: stage?.name ?? null,
      stageColor: stage?.color ?? null,
      isWon: stage?.isWon ?? false,
      isLost: stage?.isLost ?? false,
      createdAt: d.createdAt,
    };
  });

  const activities = (contact.activities ?? []).map((a) => ({
    id: a.id,
    type: a.type,
    description: a.description,
    dealId: a.dealId ?? null,
    startAt: a.startAt ?? null,
    endAt: a.endAt ?? null,
    notes: a.notes ?? null,
    attachments: a.attachments ?? null,
    scheduledAt: a.scheduledAt,
    completedAt: a.completedAt,
    createdAt: a.createdAt,
  }));

  return (
    <ContactDetailClient
      contact={{
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        vatNumber: contact.vatNumber ?? null,
        address: contact.address ?? null,
        source: contact.source,
        temperature: contact.temperature,
        notes: contact.notes,
        createdAt: contact.createdAt,
      }}
      deals={dealsWithStage}
      activities={activities}
      nowMs={now.getTime()}
    />
  );
}
