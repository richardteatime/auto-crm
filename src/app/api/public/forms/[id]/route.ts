import { NextRequest, NextResponse } from "next/server";
import { getForm } from "@/lib/db";
import { clientIp, track } from "@/lib/capture/analytics";

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
      headers: {
        // Allow cross-origin fetch for embeds on customer sites.
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    },
  );
}

export function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
