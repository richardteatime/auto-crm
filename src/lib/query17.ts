/**
 * Query wrapper for Appwrite 1.7.4.
 *
 * 1.7.4 uses two JSON formats depending on the method:
 *   - "limit" / "offset" / "cursorAfter":  {"method":"...","values":[...]}
 *   - all others (equal, orderDesc, etc.):  {"method":"...","attribute":"...","values":[...]}
 */

function q(method: string, values: unknown[]): string {
  return JSON.stringify({ method, values });
}

function qAttr(method: string, attribute: string, values: unknown[]): string {
  return JSON.stringify({ method, attribute, values });
}

export const Query = {
  limit(n: number): string {
    return q("limit", [n]);
  },

  offset(n: number): string {
    return q("offset", [n]);
  },

  orderDesc(attribute: string): string {
    return qAttr("orderDesc", attribute, []);
  },

  orderAsc(attribute: string): string {
    return qAttr("orderAsc", attribute, []);
  },

  equal(attribute: string, value: string | number | boolean | string[]): string {
    const v = Array.isArray(value) ? value : [value];
    return qAttr("equal", attribute, v);
  },

  notEqual(attribute: string, value: string | number | boolean): string {
    return qAttr("notEqual", attribute, [value]);
  },

  greaterThan(attribute: string, value: number | string): string {
    return qAttr("greaterThan", attribute, [value]);
  },

  greaterThanEqual(attribute: string, value: number | string): string {
    return qAttr("greaterThanEqual", attribute, [value]);
  },

  lessThan(attribute: string, value: number | string): string {
    return qAttr("lessThan", attribute, [value]);
  },

  lessThanEqual(attribute: string, value: number | string): string {
    return qAttr("lessThanEqual", attribute, [value]);
  },

  isNotNull(attribute: string): string {
    return qAttr("isNotNull", attribute, []);
  },

  isNull(attribute: string): string {
    return qAttr("isNull", attribute, []);
  },

  startsWith(attribute: string, value: string): string {
    return qAttr("startsWith", attribute, [value]);
  },

  search(attribute: string, value: string): string {
    return qAttr("search", attribute, [value]);
  },

  cursorAfter(id: string): string {
    return q("cursorAfter", [id]);
  },
};
