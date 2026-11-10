import { NextResponse } from "next/server";

export async function readBody(request: Request): Promise<Record<string, unknown> | NextResponse> {
  try {
    const b = await request.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
}

export const str = (v: unknown, max = 2000): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

export const int = (v: unknown, min = 0, max = 1e9): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null;
};

export const iso = (v: unknown): string | null => {
  if (typeof v !== "string" || !v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

export function fail(e: unknown, fallback = "Errore") {
  const msg = e instanceof Error ? e.message : fallback;
  console.error("[vendiora]", msg);
  return NextResponse.json({ error: msg }, { status: 500 });
}
