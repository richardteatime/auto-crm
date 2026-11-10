import type { Metadata } from "next";
import { ClientDetail } from "@/components/vendiora/ClientDetail";

export const metadata: Metadata = { title: "Cliente · Vendiora" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientDetail id={id} />;
}
