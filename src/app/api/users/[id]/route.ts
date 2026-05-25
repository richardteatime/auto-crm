import { NextRequest, NextResponse } from "next/server";
import { users } from "@/lib/appwrite";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    await users.delete(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Errore nell'eliminazione utente" },
      { status: 500 }
    );
  }
}
