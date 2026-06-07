import { z } from "zod";
import type { Models } from "node-appwrite";

export function docSchema<T extends z.ZodRawShape>(shape: T) {
  return z.object({
    $id: z.string(),
    $createdAt: z.string(),
    $updatedAt: z.string(),
    ...shape,
  });
}

/**
 * Validate an Appwrite document against a Zod schema, then map
 * `$id/$createdAt/$updatedAt` → `id/createdAt/updatedAt`.
 *
 * Returns `any` so callers can cast to their TypeScript interface.
 * The important part is the **runtime validation** that was missing
 * with the old `fromDoc<T>` blind cast.
 */
export function parseDoc(
  schema: z.ZodTypeAny,
  doc: Models.Document,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const parsed = schema.parse(doc) as Record<string, unknown>;
  const { $id, $createdAt, $updatedAt, ...rest } = parsed;
  return {
    id: $id as string,
    createdAt: new Date($createdAt as string),
    updatedAt: new Date($updatedAt as string),
    ...rest,
  };
}
