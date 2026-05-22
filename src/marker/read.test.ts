import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readMarker } from "./read";
import { MARKER_FILENAME } from "./schema";

const validBody = JSON.stringify(
  {
    toolkitVersion: "0.2.0",
    scaffoldedAt: "2026-05-15T14:23:11.482Z",
    projectType: "web-app",
    scaffoldSeed: "ab12cd34ef56",
  },
  null,
  2,
);

describe("readMarker", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "oe-marker-read-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("returns ok=true for a valid marker", async () => {
    await writeFile(join(root, MARKER_FILENAME), validBody);
    const result = await readMarker(root);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.marker.projectType).toBe("web-app");
    }
  });

  test("returns absent when no marker file exists", async () => {
    const result = await readMarker(root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("absent");
    }
  });

  test("returns malformed-json on bad JSON", async () => {
    await writeFile(join(root, MARKER_FILENAME), "{not json");
    const result = await readMarker(root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("malformed-json");
    }
  });

  test("returns schema-invalid on missing required field", async () => {
    await writeFile(
      join(root, MARKER_FILENAME),
      JSON.stringify({
        toolkitVersion: "0.2.0",
        scaffoldedAt: "2026-05-15T14:23:11.482Z",
        projectType: "web-app",
      }),
    );
    const result = await readMarker(root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("schema-invalid");
      if (result.reason === "schema-invalid") {
        expect(result.issues.some((i) => i.includes("scaffoldSeed"))).toBe(true);
      }
    }
  });
});
