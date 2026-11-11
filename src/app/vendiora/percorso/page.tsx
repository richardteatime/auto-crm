import type { Metadata } from "next";
import { JourneyBoard } from "@/components/vendiora/JourneyBoard";

export const metadata: Metadata = { title: "Pipeline · VendiOra" };
export default function Page() { return <JourneyBoard />; }
