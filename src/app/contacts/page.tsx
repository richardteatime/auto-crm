import type { Metadata } from "next";
import { listContacts, listDeals, getStages } from "@/lib/db";
import { ContactsTable, type ContactRow } from "@/components/contacts/ContactsTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { QuickCreateButton } from "@/components/shared/QuickCreateButton";
import { ReportDialog } from "@/components/shared/ReportDialog";
import { toMs } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contatti" };

export default async function ContactsPage() {
  const now = new Date();
  const [contacts, deals, stages] = await Promise.all([listContacts(), listDeals(), getStages()]);

  const closed = new Set(stages.filter((s) => s.isWon || s.isLost).map((s) => s.id));
  const won = new Set(stages.filter((s) => s.isWon).map((s) => s.id));

  const rows: ContactRow[] = contacts.map((c) => {
    const own = deals.filter((d) => d.contactId === c.id);
    const open = own.filter((d) => !closed.has(d.stageId));
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      company: c.company,
      source: c.source,
      temperature: c.temperature,
      createdMs: toMs(c.createdAt),
      openDeals: open.length,
      openValue: open.reduce((s, d) => s + (d.value ?? 0), 0),
      wonValue: own.filter((d) => won.has(d.stageId)).reduce((s, d) => s + (d.value ?? 0), 0),
    };
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contatti"
        description={`${contacts.length} contatti tra lead, clienti e aziende`}
        actions={
          <>
            <ReportDialog section="contacts" />
            <QuickCreateButton kind="contact" label="Nuovo contatto" />
          </>
        }
      />
      <ContactsTable contacts={rows} nowMs={now.getTime()} />
    </div>
  );
}
