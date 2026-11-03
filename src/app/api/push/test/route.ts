import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sendPush, pushConfigured } from "@/lib/leads/notify";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  if (!pushConfigured()) return NextResponse.json({ error: "Notifiche non configurate sul server" }, { status: 503 });
  const sent = await sendPush(
    { title: "Notifiche attive ✅", body: "Così ti arriverà ogni nuovo lead.", url: "/leads", tag: "test" },
    [auth.user.id]
  );
  return NextResponse.json({ sent });
}
