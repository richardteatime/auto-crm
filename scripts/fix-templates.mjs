import { readFileSync, writeFileSync } from "fs";

const file = "src/lib/orchestrator/command-tools.ts";
let content = readFileSync(file, "utf-8");

// Replace template literals with string concatenation
// This is a best-effort regex for simple cases in this file
const templateRegex = /`((?:[^`]|\\`)*?)`/g;

content = content.replace(templateRegex, (match, inner) => {
  // If no interpolation, just convert to double-quoted string
  if (!inner.includes("${")) {
    // Escape double quotes and backslashes, preserve newlines as \n
    const escaped = inner
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n");
    return `"${escaped}"`;
  }

  // Split by interpolations
  const parts = [];
  let remaining = inner;
  const interpRegex = /\$\{([^}]+)\}/g;
  let lastIndex = 0;
  let m;

  while ((m = interpRegex.exec(remaining)) !== null) {
    const before = remaining.slice(lastIndex, m.index);
    if (before) {
      const escaped = before
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n");
      parts.push(`"${escaped}"`);
    }
    parts.push(m[1].trim());
    lastIndex = interpRegex.lastIndex;
  }

  const after = remaining.slice(lastIndex);
  if (after) {
    const escaped = after
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n");
    parts.push(`"${escaped}"`);
  }

  return parts.join(" + ");
});

writeFileSync(file, content, "utf-8");
console.log("Template literals replaced in", file);
