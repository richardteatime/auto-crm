import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyFinanceToken } from "@/lib/finance-auth";

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("finance-session")?.value;
  if (!token || !verifyFinanceToken(token)) {
    redirect("/finance/login");
  }
  return <>{children}</>;
}
