import type { Metadata } from "next";
import { TasksBoard } from "@/components/vendiora/TasksBoard";

export const metadata: Metadata = { title: "Da fare · VendiOra" };
export default function Page() { return <TasksBoard />; }
