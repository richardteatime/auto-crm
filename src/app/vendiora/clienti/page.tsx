import type { Metadata } from "next";
import { ClientsList } from "@/components/vendiora/ClientsList";

export const metadata: Metadata = { title: "Clienti · Vendiora" };
export default function Page() { return <ClientsList />; }
