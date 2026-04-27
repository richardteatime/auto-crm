/**
 * Query wrapper that generates Appwrite 1.7.4-compatible JSON queries.
 *
 * Appwrite 1.7.4 expects queries as JSON objects: {"method":"limit","values":[10]}
 * NOT as strings like "limit(10)".
 */

export const Query = {
  limit(n: number): string {
    return JSON.stringify({ method: "limit", values: [n] });
  },

  offset(n: number): string {
    return JSON.stringify({ method: "offset", values: [n] });
  },

  orderDesc(attribute: string): string {
    return JSON.stringify({ method: "orderDesc", values: [attribute] });
  },

  orderAsc(attribute: string): string {
    return JSON.stringify({ method: "orderAsc", values: [attribute] });
  },

  equal(attribute: string, value: string | number | boolean | string[]): string {
    const values = Array.isArray(value) ? value : [value];
    return JSON.stringify({ method: "equal", values: [attribute, values] });
  },

  notEqual(attribute: string, value: string | number | boolean): string {
    return JSON.stringify({ method: "notEqual", values: [attribute, [value]] });
  },

  greaterThan(attribute: string, value: number | string): string {
    return JSON.stringify({ method: "greaterThan", values: [attribute, [value]] });
  },

  greaterThanEqual(attribute: string, value: number | string): string {
    return JSON.stringify({ method: "greaterThanEqual", values: [attribute, [value]] });
  },

  lessThan(attribute: string, value: number | string): string {
    return JSON.stringify({ method: "lessThan", values: [attribute, [value]] });
  },

  lessThanEqual(attribute: string, value: number | string): string {
    return JSON.stringify({ method: "lessThanEqual", values: [attribute, [value]] });
  },

  isNotNull(attribute: string): string {
    return JSON.stringify({ method: "isNotNull", values: [attribute] });
  },

  isNull(attribute: string): string {
    return JSON.stringify({ method: "isNull", values: [attribute] });
  },

  startsWith(attribute: string, value: string): string {
    return JSON.stringify({ method: "startsWith", values: [attribute, value] });
  },

  search(attribute: string, value: string): string {
    return JSON.stringify({ method: "search", values: [attribute, value] });
  },

  cursorAfter(id: string): string {
    return JSON.stringify({ method: "cursorAfter", values: [id] });
  },
};
