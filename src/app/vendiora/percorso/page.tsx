import type { Metadata } from "next";
import { JourneyBoard } from "@/components/vendiora/JourneyBoard";

export const metadata: Metadata = { title: "Percorso clienti · Vendiora" };
export default function Page() { return <JourneyBoard />; }
