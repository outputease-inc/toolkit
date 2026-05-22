import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { buildFixture, buildStagedTree, type FixtureProject } from "./__fixtures__/build-fixture";
import { computeDiff } from "./diff";

describe("computeDiff", () => {
  let project: FixtureProject;
  let staged: Awaited<ReturnType<typeof buildStagedTree>>;

  beforeEach(async () => {
    project = await buildFixture({
      files: [
        { path: ".claude/commands/keep.md", content: "same" },
        { path: ".claude/commands/edited.md", content: "local-edited" },
        { path: ".claude/orphan.md", content: "stays" },
      ],
    });
    staged = await buildStagedTree([
      { path: "templates/.claude/commands/keep.md", content: "same" },
      { path: "templates/.claude/commands/edited.md", content: "upstream-new" },
      { path: "templates/.claude/commands/new.md", content: "added" },
      { path: "templates/.specify/memory/constitution.md", content: "spec" },
      { path: "templates/src/should-be-ignored.ts", content: "x" },
    ]);
  });

  afterEach(async () => {
    await Promise.all([project.cleanup(), staged.cleanup()]);
  });

  test("classifies files into add / update / skip(unchanged)", async () => {
    const actions = await computeDiff({
      projectRoot: project.root,
      stagedRoot: staged.stagedRoot,
    });
    const byTarget = Object.fromEntries(actions.map((a) => [a.targetPath, a]));

    expect(byTarget[".claude/commands/new.md"]?.kind).toBe("add");
    expect(byTarget[".claude/commands/edited.md"]?.kind).toBe("update");
    if (byTarget[".claude/commands/edited.md"]?.kind === "update") {
      expect(byTarget[".claude/commands/edited.md"].hadLocalEdits).toBe(true);
      expect(byTarget[".claude/commands/edited.md"].resolution).toBe("skip");
    }
    expect(byTarget[".claude/commands/keep.md"]?.kind).toBe("skip");
    if (byTarget[".claude/commands/keep.md"]?.kind === "skip") {
      expect(byTarget[".claude/commands/keep.md"].reason).toBe("unchanged");
    }
    expect(byTarget[".specify/memory/constitution.md"]?.kind).toBe("add");
  });

  test("never emits actions for out-of-scope paths", async () => {
    const actions = await computeDiff({
      projectRoot: project.root,
      stagedRoot: staged.stagedRoot,
    });
    const targets = actions.map((a) => a.targetPath);
    expect(targets.some((t) => t.startsWith("src/"))).toBe(false);
  });
});
