import { NextRequest, NextResponse } from "next/server";
import { users } from "@/lib/appwrite";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const res = await users.list();
    const list = res.users.map((u) => ({
      id: u.$id,
      name: u.name,
      email: u.email,
    }));
    return NextResponse.json(list);
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero degli utenti" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e password sono obbligatori" },
        { status: 400 }
      );
    }

    const user = await users.create("unique()", email, undefined, password, name || email);
    return NextResponse.json({
      id: user.$id,
      name: user.name,
      email: user.email,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Errore nella creazione utente" },
      { status: 500 }
    );
  }
}
