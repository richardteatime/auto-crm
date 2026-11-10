import type { Metadata } from "next";
import { VendioraSettingsPanel } from "@/components/vendiora/VendioraSettingsPanel";

export const metadata: Metadata = { title: "Bot e azienda · Vendiora" };
export default function Page() { return <VendioraSettingsPanel />; }
