import { NextRequest, NextResponse } from "next/server";
import { getForm } from "@/lib/db";
import { clientIp, track } from "@/lib/capture/analytics";
import { corsHeaders } from "@/lib/cors";

// Public read of an active form's definition. Used by headless/SPA embeds.
// Draft and archived forms are treated as not found.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const form = await getForm(id);

  if (!form || form.status !== "active") {
    return NextResponse.json({ error: "Form non trovato" }, { status: 404 });
  }
  await track("form_view", "form", form.id, {
    ip: clientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    referrer: request.headers.get("referer"),
  });

  return NextResponse.json(
    {
      id: form.id,
      name: form.name,
      description: form.description,
      fields: form.fields,
      style: form.style,
      successMessage: form.successMessage,
      redirectUrl: form.redirectUrl,
    },
    {
      headers: corsHeaders(request, "GET, OPTIONS"),
    },
  );
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    headers: corsHeaders(request, "GET, OPTIONS"),
  });
}
