// Slug generation + uniqueness helpers (no external dependency).

// Combining diacritical marks (U+0300–U+036F). Built from a string so the
// escapes stay literal ASCII in source regardless of editor normalization.
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(COMBINING_MARKS, "") // strip accents: "señor" -> "senor"
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "pagina"
  );
}

/**
 * Ensure a slug is unique given an async existence check.
 * Appends -2, -3, ... until a free slug is found.
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base);
  if (!(await exists(root))) return root;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${root}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  // Extremely unlikely fallback
  return `${root}-${Date.now()}`;
}
