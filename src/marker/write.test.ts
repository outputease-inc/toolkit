import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readMarker } from "./read";
import { MARKER_FILENAME } from "./schema";
import { buildMarker, writeMarker } from "./write";

describe("writeMarker", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "oe-marker-write-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("writes a valid marker that round-trips through readMarker", async () => {
    const marker = buildMarker({
      toolkitVersion: "0.2.0",
      projectType: "web-app",
      scaffoldSeed: "ab12cd34ef56",
      scaffoldedAt: "2026-05-15T14:23:11.482Z",
    });
    await writeMarker(root, marker);
    const result = await readMarker(root);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.marker).toEqual(marker);
    }
  });

  test("rejects an invalid marker before any write occurs", async () => {
    await expect(
      writeMarker(root, {
        toolkitVersion: "not-semver",
        scaffoldedAt: "2026-05-15T14:23:11.482Z",
        projectType: "web-app",
        // biome-ignore lint/style/useNamingConvention: matches schema field
        scaffoldSeed: "ab12cd34ef56",
      } as never),
    ).rejects.toThrow();

    // No file should exist after rejection.
    const result = await readMarker(root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("absent");
    }
  });

  test("buildMarker auto-fills scaffoldedAt if omitted", () => {
    const marker = buildMarker({
      toolkitVersion: "0.2.0",
      projectType: "library",
      scaffoldSeed: "ab12cd34ef56",
    });
    expect(marker.scaffoldedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  test("file body is pretty-printed JSON with trailing newline", async () => {
    const marker = buildMarker({
      toolkitVersion: "0.2.0",
      projectType: "web-app",
      scaffoldSeed: "ab12cd34ef56",
      scaffoldedAt: "2026-05-15T14:23:11.482Z",
    });
    await writeMarker(root, marker);
    const raw = await readFile(join(root, MARKER_FILENAME), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain('"projectType": "web-app"');
  });
});
