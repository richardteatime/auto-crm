import type { Metadata } from "next";
import { CallsBoard } from "@/components/vendiora/CallsBoard";

export const metadata: Metadata = { title: "Call · Vendiora" };
export default function Page() { return <CallsBoard />; }
