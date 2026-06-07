import { describe, it, expect } from "vitest";
import { parseDoc, docSchema } from "./parse-doc";
import { z } from "zod";

const TestSchema = docSchema({
  name: z.string(),
  email: z.string().email().nullable(),
});

describe("parseDoc", () => {
  it("maps Appwrite meta fields and validates shape", () => {
    const doc = {
      $id: "abc123",
      $createdAt: "2026-06-01T10:00:00.000Z",
      $updatedAt: "2026-06-01T12:00:00.000Z",
      name: "Mario Rossi",
      email: "mario@example.com",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = parseDoc(TestSchema, doc as any);

    expect(result.id).toBe("abc123");
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(result.name).toBe("Mario Rossi");
    expect(result.email).toBe("mario@example.com");
  });

  it("throws on missing required field", () => {
    const doc = {
      $id: "abc123",
      $createdAt: "2026-06-01T10:00:00.000Z",
      $updatedAt: "2026-06-01T12:00:00.000Z",
      email: null,
      // missing name
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => parseDoc(TestSchema, doc as any)).toThrow();
  });

  it("allows null for nullable fields", () => {
    const doc = {
      $id: "abc123",
      $createdAt: "2026-06-01T10:00:00.000Z",
      $updatedAt: "2026-06-01T12:00:00.000Z",
      name: "Mario",
      email: null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = parseDoc(TestSchema, doc as any);
    expect(result.email).toBeNull();
  });
});
