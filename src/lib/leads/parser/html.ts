// Convert an HTML email body to plain text, preserving line breaks so the
// key-value parser can run on the result.
export function htmlToText(html: string): string {
  if (!html) return "";

  let text = html;

  // Drop script/style blocks entirely.
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");

  // Block-level tags → newlines.
  text = text.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  text = text.replace(/<\/\s*(p|div|tr|li|h[1-6]|table)\s*>/gi, "\n");
  text = text.replace(/<\s*(p|div|tr|li|h[1-6])[^>]*>/gi, "\n");

  // Table cells → separator so "Label</td><td>Value" stays parseable.
  text = text.replace(/<\/\s*td\s*>/gi, ": ");

  // Strip all remaining tags.
  text = text.replace(/<[^>]+>/g, " ");

  // Decode common HTML entities.
  text = decodeEntities(text);

  // Collapse whitespace within lines, trim each line, drop empties.
  text = text
    .split(/\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  return text;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function isHtml(text: string): boolean {
  if (!text) return false;
  return /<\s*(html|body|p|div|br|table|td|span|a)\b/i.test(text);
}
