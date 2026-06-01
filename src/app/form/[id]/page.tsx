import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getForm } from "@/lib/db";
import { track, clientIp } from "@/lib/capture/analytics";
import { PublicFormRenderer } from "@/components/capture/PublicFormRenderer";
import { defaultFormStyle } from "@/lib/capture/defaults";
import type { FormField, FormStyle } from "@/lib/capture/types";

export const dynamic = "force-dynamic";

function parseFields(raw: string): FormField[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FormField[]) : [];
  } catch {
    return [];
  }
}

function parseStyle(raw: string): FormStyle {
  try {
    return { ...defaultFormStyle(), ...(JSON.parse(raw) as Partial<FormStyle>) };
  } catch {
    return defaultFormStyle();
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const form = await getForm(id);
  if (!form || form.status !== "active") {
    return { title: "Form non trovato" };
  }
  return { title: form.name, description: form.description ?? undefined };
}

export default async function PublicFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const { id } = await params;
  const { embed } = await searchParams;
  const form = await getForm(id);

  if (!form || form.status !== "active") {
    notFound();
  }

  const h = await headers();
  await track("form_view", "form", form.id, {
    ip: clientIp(h),
    userAgent: h.get("user-agent"),
    referrer: h.get("referer"),
  });

  const fields = parseFields(form.fields);
  const style = parseStyle(form.style);
  const dark = style.theme === "dark";

  const renderer = (
    <PublicFormRenderer
      formId={form.id}
      fields={fields}
      style={style}
      successMessage={form.successMessage}
    />
  );

  if (embed === "1") {
    return (
      <div className="p-4">
        {renderer}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function post(){try{parent.postMessage({type:'sarconx-form-height',id:${JSON.stringify(
              form.id,
            )},height:document.documentElement.scrollHeight},'*');}catch(e){}}window.addEventListener('load',post);window.addEventListener('resize',post);try{new ResizeObserver(post).observe(document.documentElement);}catch(e){}post();})();`,
          }}
        />
      </div>
    );
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: dark ? "#0f172a" : "#f8fafc" }}
    >
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold" style={{ color: dark ? "#f1f5f9" : "#0f172a" }}>
            {form.name}
          </h1>
          {form.description && (
            <p className="mt-1 text-sm" style={{ color: dark ? "#94a3b8" : "#64748b" }}>
              {form.description}
            </p>
          )}
        </div>
        {renderer}
      </div>
    </main>
  );
}
