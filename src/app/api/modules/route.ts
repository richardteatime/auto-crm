import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getModulesConfig, setModulesConfig } from "@/lib/db/modules";
import type { ModuleId } from "@/lib/modules";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const enabled = await getModulesConfig();
  return NextResponse.json({ enabled });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = (await request.json()) as { enabled: ModuleId[] };
    if (!Array.isArray(body.enabled)) {
      return NextResponse.json(
        { error: "Formato non valido. Atteso: { enabled: ModuleId[] }" },
        { status: 400 }
      );
    }
    await setModulesConfig(body.enabled);
    return NextResponse.json({ success: true, enabled: body.enabled });
  } catch {
    return NextResponse.json(
      { error: "Richiesta non valida" },
      { status: 400 }
    );
  }
}
