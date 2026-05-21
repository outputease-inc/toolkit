import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupScratch } from "./cleanup";

describe("cleanupScratch", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "oe-cleanup-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("removes .tmp-* files and known scratch dirs", async () => {
    await writeFile(join(root, ".tmp-foo"), "x");
    await writeFile(join(root, ".tmp-bar"), "y");
    await mkdir(join(root, ".outputease-staging"), { recursive: true });
    await writeFile(join(root, ".outputease-staging", "inner"), "z");
    await writeFile(join(root, "keep.txt"), "ok");

    const report = await cleanupScratch(root);
    expect(report.removed.sort()).toEqual([".outputease-staging", ".tmp-bar", ".tmp-foo"]);

    await expect(stat(join(root, ".tmp-foo"))).rejects.toThrow();
    await expect(stat(join(root, ".outputease-staging"))).rejects.toThrow();
    await expect(stat(join(root, "keep.txt"))).resolves.toBeDefined();
  });

  test("preserves all non-matching entries", async () => {
    await writeFile(join(root, "src.ts"), "x");
    await writeFile(join(root, ".tmpfoo"), "y"); // missing dash — should NOT match
    await writeFile(join(root, "package.json"), "{}");

    const report = await cleanupScratch(root);
    expect(report.removed).toEqual([]);
    await expect(stat(join(root, ".tmpfoo"))).resolves.toBeDefined();
  });

  test("returns empty report when target dir does not exist", async () => {
    const report = await cleanupScratch(join(root, "does-not-exist"));
    expect(report.removed).toEqual([]);
  });
});
