import { notFound } from "next/navigation";
import { getFunnelBySlug } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PublicFunnelComplete({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const funnel = await getFunnelBySlug(slug);
  if (!funnel || funnel.status !== "active") notFound();
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-lg rounded-2xl border bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Grazie!</h1>
        <p className="mt-3 text-sm text-slate-600">
          Abbiamo ricevuto i tuoi dati. Ti ricontatteremo presto.
        </p>
      </div>
    </main>
  );
}
