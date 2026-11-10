import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings, saveSettings } from "@/lib/vendiora/db";
import { mergeSettings, DEFAULT_SETTINGS } from "@/lib/vendiora/types";
import { users } from "@/lib/appwrite";
import { Query } from "@/lib/query17";
import { readBody, fail } from "@/lib/vendiora/http";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const settings = await getSettings();
  const list = await users.list([Query.limit(100)]).catch(() => ({ users: [] as Array<{ $id: string; name: string; email: string }> }));
  return NextResponse.json({
    settings,
    defaults: DEFAULT_SETTINGS,
    team: list.users.map((u) => ({ id: u.$id, name: u.name || u.email })),
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const body = await readBody(request);
  if (body instanceof NextResponse) return body;
  const cur = await getSettings();
  const next = mergeSettings({
    bot: { ...cur.bot, ...((body.bot as object) ?? {}) },
    company: { ...cur.company, ...((body.company as object) ?? {}) },
  });
  next.bot.questions = (Array.isArray(next.bot.questions) ? next.bot.questions : [])
    .map((q) => String(q).trim()).filter(Boolean).slice(0, 10);
  next.bot.handoffUserIds = (Array.isArray(next.bot.handoffUserIds) ? next.bot.handoffUserIds : []).map(String).slice(0, 10);
  next.bot.enabled = next.bot.enabled === true;
  for (const k of ["greeting", "closing", "calendlyUrl", "coachingBookingUrl", "handoffName"] as const) next.bot[k] = String(next.bot[k] ?? "").slice(0, 3000);
  for (const k of Object.keys(next.company) as Array<keyof typeof next.company>) next.company[k] = String(next.company[k] ?? "").slice(0, 500);
  try { return NextResponse.json({ settings: await saveSettings(next) }); } catch (e) { return fail(e); }
}
