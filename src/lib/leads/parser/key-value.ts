import type { ParsedLead } from "../types";
import { assignField, consolidateName, emptyParsed } from "./fields";

// Matches "Key: value" or "Key - value" lines.
const LINE_RE = /^\s*([\p{L}][\p{L}0-9 _'’.-]{0,60}?)\s*[:\-–]\s*(.+?)\s*$/u;

// Parse plain-text "key: value" bodies (one pair per line).
export function parseKeyValue(text: string): ParsedLead {
  const result = emptyParsed();
  if (!text) return result;

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(LINE_RE);
    if (!m) continue;
    const [, key, value] = m;
    assignField(result, key, value);
  }

  consolidateName(result);
  return result;
}

// Heuristic: does this text look like key-value pairs?
export function looksLikeKeyValue(text: string): boolean {
  if (!text) return false;
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return false;
  const matching = lines.filter((l) => LINE_RE.test(l)).length;
  return matching >= Math.max(2, Math.ceil(lines.length * 0.4));
}
