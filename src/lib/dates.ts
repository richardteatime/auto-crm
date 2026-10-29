// Date helpers pinned to Europe/Rome, so server-rendered labels match the team's
// clock (the container runs in UTC) and hydrate identically in the browser.

export const TIME_ZONE = "Europe/Rome";
export const DAY_MS = 86_400_000;

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function romeParts(ms: number) {
  const p: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(ms)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute, s: p.second };
}

/** Milliseconds between Rome wall-clock time and UTC at `ms` */
function romeOffset(ms: number): number {
  const p = romeParts(ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(ms / 1000) * 1000;
}

export function romeHour(ms: number): number {
  return romeParts(ms).h;
}

export function startOfRomeDay(ms: number): number {
  const p = romeParts(ms);
  return Date.UTC(p.y, p.m - 1, p.d) - romeOffset(ms);
}

export function startOfRomeMonth(ms: number, monthOffset = 0): number {
  const p = romeParts(ms);
  const utc = Date.UTC(p.y, p.m - 1 + monthOffset, 1);
  return utc - romeOffset(utc);
}

/** Whole calendar days from `fromMs` to `toMs` in Rome (0 = same day, 1 = tomorrow) */
export function romeDayDiff(fromMs: number, toMs: number): number {
  const a = romeParts(fromMs);
  const b = romeParts(toMs);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY_MS);
}

const timeFmt = new Intl.DateTimeFormat("it-IT", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("it-IT", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" });
const dateFmt = new Intl.DateTimeFormat("it-IT", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
const longDayFmt = new Intl.DateTimeFormat("it-IT", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });

export const formatTime = (ms: number) => timeFmt.format(ms);
export const formatDayShort = (ms: number) => dayFmt.format(ms);
export const formatDayMonth = (ms: number) => dateFmt.format(ms);
export const formatLongDay = (ms: number) => longDayFmt.format(ms);

/** "Oggi", "Domani", "Ieri", "gio 31 ott" */
export function dayLabel(ms: number, nowMs: number): string {
  const diff = romeDayDiff(nowMs, ms);
  if (diff === 0) return "Oggi";
  if (diff === 1) return "Domani";
  if (diff === -1) return "Ieri";
  return formatDayShort(ms);
}

/** Due-date wording for a task: "Scaduta da 3 giorni", "Oggi alle 15:00", "Domani" */
export function dueLabel(ms: number, nowMs: number): string {
  const diff = romeDayDiff(nowMs, ms);
  if (diff < -1) return `Scaduta da ${-diff} giorni`;
  if (diff === -1) return "Scaduta ieri";
  const time = formatTime(ms);
  const hasTime = time !== "00:00";
  if (diff === 0) return hasTime ? (ms < nowMs ? `Scaduta alle ${time}` : `Oggi alle ${time}`) : "Oggi";
  if (diff === 1) return hasTime ? `Domani alle ${time}` : "Domani";
  return formatDayShort(ms);
}

/** "3 giorni fa", "2 settimane fa", "4 mesi fa" */
export function agoLabel(ms: number, nowMs: number): string {
  const days = romeDayDiff(ms, nowMs);
  if (days <= 0) return "oggi";
  if (days === 1) return "ieri";
  if (days < 14) return `${days} giorni fa`;
  if (days < 60) return `${Math.round(days / 7)} settimane fa`;
  return `${Math.round(days / 30)} mesi fa`;
}
