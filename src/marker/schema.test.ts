import { describe, expect, test } from "bun:test";
import { MarkerSchema } from "./schema";

const validMarker = {
  toolkitVersion: "0.2.0",
  scaffoldedAt: "2026-05-15T14:23:11.482Z",
  projectType: "web-app",
  scaffoldSeed: "ab12cd34ef56",
};

describe("MarkerSchema", () => {
  test("accepts a fully valid marker", () => {
    const result = MarkerSchema.safeParse(validMarker);
    expect(result.success).toBe(true);
  });

  test("rejects when scaffoldSeed is missing", () => {
    const { scaffoldSeed, ...partial } = validMarker;
    void scaffoldSeed;
    const result = MarkerSchema.safeParse(partial);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("scaffoldSeed"))).toBe(true);
    }
  });

  test("rejects bad projectType enum value", () => {
    const result = MarkerSchema.safeParse({ ...validMarker, projectType: "saas" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("projectType"))).toBe(true);
    }
  });

  test("rejects uppercase scaffoldSeed (regex is lowercase-only)", () => {
    const result = MarkerSchema.safeParse({ ...validMarker, scaffoldSeed: "AB12CD34EF56" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("scaffoldSeed"))).toBe(true);
    }
  });

  test("rejects non-semver toolkitVersion", () => {
    const result = MarkerSchema.safeParse({ ...validMarker, toolkitVersion: "0.2" });
    expect(result.success).toBe(false);
  });

  test("rejects non-ISO scaffoldedAt", () => {
    const result = MarkerSchema.safeParse({ ...validMarker, scaffoldedAt: "2026-05-15" });
    expect(result.success).toBe(false);
  });

  test("rejects extra unknown keys (strict)", () => {
    const result = MarkerSchema.safeParse({ ...validMarker, extra: "nope" });
    expect(result.success).toBe(false);
  });

  test("accepts semver with pre-release tag", () => {
    const result = MarkerSchema.safeParse({ ...validMarker, toolkitVersion: "1.0.0-beta.1" });
    expect(result.success).toBe(true);
  });
});
