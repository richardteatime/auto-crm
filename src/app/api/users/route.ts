import { NextResponse } from "next/server";
import { users } from "@/lib/appwrite";

export const dynamic = "force-dynamic";

export async function GET() {
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
