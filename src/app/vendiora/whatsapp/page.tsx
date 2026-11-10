import type { Metadata } from "next";
import { WaInbox } from "@/components/vendiora/WaInbox";

export const metadata: Metadata = { title: "WhatsApp · Vendiora" };
export default function Page() { return <WaInbox />; }
