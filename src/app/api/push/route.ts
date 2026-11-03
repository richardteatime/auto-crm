import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { savePushSubscription, deletePushSubscription, countPushSubscriptions } from "@/lib/db/leads";
import { pushConfigured } from "@/lib/leads/notify";

// GET → VAPID public key + how many devices this user has registered
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  return NextResponse.json({
    configured: pushConfigured(),
    publicKey: process.env.VAPID_PUBLIC_KEY || null,
    devices: await countPushSubscriptions(auth.user.id).catch(() => 0),
  });
}

// POST { endpoint, keys: { p256dh, auth } }
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint;
  const keys = body?.keys;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") {
    return NextResponse.json({ error: "Sottoscrizione non valida" }, { status: 400 });
  }
  await savePushSubscription({
    userId: auth.user.id,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    userAgent: request.headers.get("user-agent"),
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

// DELETE { endpoint }
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  if (typeof body?.endpoint !== "string") return NextResponse.json({ error: "endpoint mancante" }, { status: 400 });
  await deletePushSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
