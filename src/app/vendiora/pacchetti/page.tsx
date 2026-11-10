import type { Metadata } from "next";
import { PackagesManager } from "@/components/vendiora/PackagesManager";

export const metadata: Metadata = { title: "Pacchetti · Vendiora" };
export default function Page() { return <PackagesManager />; }
