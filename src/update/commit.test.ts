import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildFixture, buildStagedTree, type FixtureProject } from "./__fixtures__/build-fixture";
import { commitActions } from "./commit";
import type { PlannedAction } from "./types";

describe("commitActions", () => {
  let project: FixtureProject;
  let staged: Awaited<ReturnType<typeof buildStagedTree>>;

  beforeEach(async () => {
    project = await buildFixture({
      files: [{ path: ".claude/commands/existing.md", content: "old" }],
    });
    staged = await buildStagedTree([
      { path: ".claude/commands/existing.md", content: "new-upstream" },
      { path: ".claude/commands/new.md", content: "added" },
    ]);
  });

  afterEach(async () => {
    await Promise.all([project.cleanup(), staged.cleanup()]);
  });

  test("writes adds and overwrite updates, leaves skip alone", async () => {
    const actions: PlannedAction[] = [
      {
        kind: "add",
        targetPath: ".claude/commands/new.md",
        sourcePath: join(staged.stagedRoot, ".claude/commands/new.md"),
      },
      {
        kind: "update",
        targetPath: ".claude/commands/existing.md",
        sourcePath: join(staged.stagedRoot, ".claude/commands/existing.md"),
        hadLocalEdits: true,
        resolution: "overwrite",
      },
    ];
    const result = await commitActions(actions, { projectRoot: project.root });
    expect(result.written.sort()).toEqual([
      ".claude/commands/existing.md",
      ".claude/commands/new.md",
    ]);
    const overwritten = await readFile(join(project.root, ".claude/commands/existing.md"), "utf8");
    expect(overwritten).toBe("new-upstream");
  });

  test("skips out-of-scope writes defensively", async () => {
    await writeFile(join(staged.stagedRoot, "out-of-scope.ts"), "x");
    const actions: PlannedAction[] = [
      {
        kind: "add",
        targetPath: "src/out-of-scope.ts",
        sourcePath: join(staged.stagedRoot, "out-of-scope.ts"),
      },
    ];
    const result = await commitActions(actions, { projectRoot: project.root });
    expect(result.written).toEqual([]);
    expect(result.skipped).toContain("src/out-of-scope.ts");
    await expect(stat(join(project.root, "src/out-of-scope.ts"))).rejects.toThrow();
  });

  test("update resolution=skip leaves the local file untouched", async () => {
    const actions: PlannedAction[] = [
      {
        kind: "update",
        targetPath: ".claude/commands/existing.md",
        sourcePath: join(staged.stagedRoot, ".claude/commands/existing.md"),
        hadLocalEdits: true,
        resolution: "skip",
      },
    ];
    await commitActions(actions, { projectRoot: project.root });
    const content = await readFile(join(project.root, ".claude/commands/existing.md"), "utf8");
    expect(content).toBe("old");
  });
});
