import { getContactWithRelations, listDeals, getStages } from "@/lib/db";
import { notFound } from "next/navigation";
import { ContactDetailClient } from "@/components/contacts/ContactDetail";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const contact = await getContactWithRelations(id);
  if (!contact) notFound();

  // Fetch deals with stage info for the contact detail view
  const [contactDeals, stages] = await Promise.all([
    listDeals({ contactId: id }),
    getStages(),
  ]);

  const dealsWithStage = contactDeals.map((d) => {
    const stage = stages.find((s) => s.id === d.stageId);
    return {
      id: d.id,
      title: d.title,
      value: d.value,
      probability: d.probability,
      stageName: stage?.name ?? null,
      stageColor: stage?.color ?? null,
      createdAt: d.createdAt,
    };
  });

  const activities = (contact.activities ?? []).map((a) => ({
    id: a.id,
    type: a.type,
    description: a.description,
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
        source: contact.source,
        temperature: contact.temperature,
        notes: contact.notes,
        createdAt: contact.createdAt,
      }}
      deals={dealsWithStage}
      activities={activities}
    />
  );
}
