import type { Metadata } from "next";
import { VendioraHome } from "@/components/vendiora/VendioraHome";

export const metadata: Metadata = { title: "Vendiora" };

export default function Page() {
  return <VendioraHome />;
}
