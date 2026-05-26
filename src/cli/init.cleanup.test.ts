import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MARKER_FILENAME } from "../marker/schema";
import { runInit } from "./init";

describe("init US4 cleanup + rerun guard", () => {
  let parent: string;

  beforeEach(() => {
    parent = mkdtempSync(join(tmpdir(), "oe-init-cleanup-"));
  });

  afterEach(() => {
    rmSync(parent, { recursive: true, force: true });
  });

  test("T052: end-of-run leaves no .tmp-* files or scratch dirs (SC-004)", async () => {
    const dir = join(parent, "clean-end");
    const result = await runInit({
      name: "clean-end",
      targetDir: dir,
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
      preset: "library",
    });
    expect(result.success).toBe(true);
    const entries = readdirSync(dir);
    const leftover = entries.filter(
      (e) => e.startsWith(".tmp-") || e === ".outputease-staging" || e === ".oe-scratch",
    );
    expect(leftover).toEqual([]);
  });

  test("T053: rerun in dirty dir (no marker, .tmp file present) cleans then scaffolds", async () => {
    const dir = join(parent, "dirty-rerun");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, ".tmp-leftover"), "x");

    const result = await runInit({
      name: "dirty-rerun",
      targetDir: dir,
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
      preset: "library",
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(dir, ".tmp-leftover"))).toBe(false);
    expect(existsSync(join(dir, "package.json"))).toBe(true);
  });

  test("T054: rerun in dir with valid marker refuses with FR-012 message", async () => {
    const dir = join(parent, "already-scaffolded");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, MARKER_FILENAME),
      JSON.stringify(
        {
          toolkitVersion: "0.0.3",
          scaffoldedAt: "2026-05-15T14:23:11.482Z",
          projectType: "library",
          scaffoldSeed: "ab12cd34ef56",
        },
        null,
        2,
      ),
    );

    const result = await runInit({
      name: "already-scaffolded",
      targetDir: dir,
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
      preset: "library",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Project already scaffolded");
    expect(result.error).toContain("outputease update");
  });
});
