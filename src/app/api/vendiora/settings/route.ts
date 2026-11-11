import { isBlockedUser, roleFromLabels } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings, saveSettings } from "@/lib/vendiora/db";
import { mergeSettings, DEFAULT_SETTINGS, AUTO_KEYS, TASK_ROLES, type PlaybookSettings } from "@/lib/vendiora/types";
import { PB_BY_ID } from "@/lib/vendiora/playbook-messages";
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
    // Vendiora is for the founders only: no salespeople, no blocked accounts (e.g. Matteo)
    team: list.users
      .filter((u) => !isBlockedUser(u.$id) && roleFromLabels((u as { labels?: string[] }).labels) === "admin")
      .map((u) => ({ id: u.$id, name: u.name || u.email })),
  });
}

function cleanPlaybook(cur: PlaybookSettings, b: Record<string, unknown>): PlaybookSettings {
  const out: PlaybookSettings = { ...cur };
  if ("enabled" in b) out.enabled = b.enabled === true;
  for (const k of ["brand", "commerciale", "fathomSecret"] as const) if (k in b) out[k] = String(b[k] ?? "").slice(0, 200);
  if (b.links && typeof b.links === "object") {
    out.links = { ...cur.links };
    for (const k of Object.keys(cur.links) as (keyof PlaybookSettings["links"])[]) {
      const v = (b.links as Record<string, unknown>)[k];
      if (typeof v === "string") out.links[k] = v.trim().slice(0, 1000);
    }
  }
  if (b.contract && typeof b.contract === "object") {
    const c = b.contract as Record<string, unknown>;
    out.contract = { ...cur.contract };
    if (c.vat === "inclusa" || c.vat === "esclusa") out.contract.vat = c.vat;
    for (const k of ["place", "court", "pec", "taxCode"] as const) if (typeof c[k] === "string") out.contract[k] = (c[k] as string).trim().slice(0, 300);
  }
  if (b.team && typeof b.team === "object") {
    out.team = { ...cur.team };
    for (const k of TASK_ROLES) {
      const v = (b.team as Record<string, unknown>)[k];
      if (Array.isArray(v)) out.team[k] = v.map(String).slice(0, 20);
    }
  }
  if (b.messages && typeof b.messages === "object") {
    const m: PlaybookSettings["messages"] = {};
    for (const [id, v] of Object.entries(b.messages as Record<string, unknown>)) {
      if (!PB_BY_ID.has(id) || !v || typeof v !== "object") continue;
      const x = v as Record<string, unknown>;
      const def = PB_BY_ID.get(id)!;
      const e: { enabled?: boolean; text?: string } = {};
      if (x.enabled === false) e.enabled = false;
      if (typeof x.text === "string" && x.text.trim() && x.text.trim() !== def.text) e.text = x.text.slice(0, 3000);
      if (Object.keys(e).length) m[id] = e;
    }
    out.messages = m;
  }
  return out;
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
    automations: { ...cur.automations, ...((body.automations as object) ?? {}) },
    playbook: body.playbook && typeof body.playbook === "object" ? cleanPlaybook(cur.playbook, body.playbook as Record<string, unknown>) : cur.playbook,
  });
  for (const k of AUTO_KEYS) next.automations[k] = { enabled: next.automations[k].enabled === true, text: String(next.automations[k].text ?? "").slice(0, 1500) };
  next.automations.offerValidDays = Math.min(90, Math.max(1, Math.round(Number(next.automations.offerValidDays) || 7)));
  next.bot.questions = (Array.isArray(next.bot.questions) ? next.bot.questions : [])
    .map((q) => String(q).trim()).filter(Boolean).slice(0, 10);
  next.bot.handoffUserIds = (Array.isArray(next.bot.handoffUserIds) ? next.bot.handoffUserIds : []).map(String).slice(0, 10);
  next.bot.enabled = next.bot.enabled === true;
  for (const k of ["greeting", "closing", "calendlyUrl", "coachingBookingUrl", "handoffName"] as const) next.bot[k] = String(next.bot[k] ?? "").slice(0, 3000);
  for (const k of Object.keys(next.company) as Array<keyof typeof next.company>) next.company[k] = String(next.company[k] ?? "").slice(0, 500);
  try { return NextResponse.json({ settings: await saveSettings(next) }); } catch (e) { return fail(e); }
}
