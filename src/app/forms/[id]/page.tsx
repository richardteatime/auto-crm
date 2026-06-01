import { notFound } from "next/navigation";
import { getForm } from "@/lib/db";
import { FormBuilder } from "@/components/capture/FormBuilder";

export const dynamic = "force-dynamic";

export default async function FormBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const form = await getForm(id);
  if (!form) notFound();

  return <FormBuilder form={form} />;
}
