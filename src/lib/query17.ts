/**
 * Query wrapper that generates Appwrite 1.7.4-compatible string queries.
 *
 * SDK v24 produces JSON objects like {"method":"limit","values":[10]}
 * but Appwrite 1.7.4 REST API expects strings like "limit(10)".
 * This module bridges that gap.
 */

function v(value: unknown): string {
  if (typeof value === "string") return `"${value.replace(/"/g, '\\"')}"`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (value === null) return "null";
  return JSON.stringify(value);
}

export const Query = {
  limit(n: number): string {
    return `limit(${n})`;
  },

  offset(n: number): string {
    return `offset(${n})`;
  },

  orderDesc(attribute: string): string {
    return `orderDesc("${attribute}")`;
  },

  orderAsc(attribute: string): string {
    return `orderAsc("${attribute}")`;
  },

  equal(attribute: string, value: string | number | boolean | string[]): string {
    if (Array.isArray(value)) {
      const items = value.map(v).join(",");
      return `equal("${attribute}", [${items}])`;
    }
    return `equal("${attribute}", [${v(value)}])`;
  },

  notEqual(attribute: string, value: string | number | boolean): string {
    return `notEqual("${attribute}", [${v(value)}])`;
  },

  greaterThan(attribute: string, value: number | string): string {
    return `greaterThan("${attribute}", [${v(value)}])`;
  },

  greaterThanEqual(attribute: string, value: number | string): string {
    return `greaterThanEqual("${attribute}", [${v(value)}])`;
  },

  lessThan(attribute: string, value: number | string): string {
    return `lessThan("${attribute}", [${v(value)}])`;
  },

  lessThanEqual(attribute: string, value: number | string): string {
    return `lessThanEqual("${attribute}", [${v(value)}])`;
  },

  isNotNull(attribute: string): string {
    return `isNotNull("${attribute}")`;
  },

  isNull(attribute: string): string {
    return `isNull("${attribute}")`;
  },

  startsWith(attribute: string, value: string): string {
    return `startsWith("${attribute}", "${value.replace(/"/g, '\\"')}")`;
  },

  search(attribute: string, value: string): string {
    return `search("${attribute}", "${value.replace(/"/g, '\\"')}")`;
  },

  cursorAfter(id: string): string {
    return `cursorAfter("${id}")`;
  },
};
