import { describe, expect, mock, test } from "bun:test";
import { type PromptDeps, resolveConflicts } from "./prompt";
import type { PlannedAction } from "./types";

function dirtyUpdate(targetPath: string): PlannedAction {
  return {
    kind: "update",
    targetPath,
    sourcePath: `/tmp/staged/${targetPath}`,
    hadLocalEdits: true,
    resolution: "skip",
  };
}

function cleanUpdate(targetPath: string): PlannedAction {
  return {
    kind: "update",
    targetPath,
    sourcePath: `/tmp/staged/${targetPath}`,
    hadLocalEdits: false,
    resolution: "overwrite",
  };
}

function addAction(targetPath: string): PlannedAction {
  return { kind: "add", targetPath, sourcePath: `/tmp/staged/${targetPath}` };
}

function buildDeps(selectImpl: PromptDeps["select"]): PromptDeps {
  return {
    select: selectImpl,
    isCancel: ((v: unknown) => v === Symbol.for("clack.cancel")) as PromptDeps["isCancel"],
    note: mock(() => {}) as unknown as PromptDeps["note"],
  };
}

describe("resolveConflicts (SC-007)", () => {
  test("non-interactive maps every dirty update to skip without prompting", async () => {
    const selectMock = mock(async () => "overwrite");
    const deps = buildDeps(selectMock as unknown as PromptDeps["select"]);

    const { resolved, aborted } = await resolveConflicts(
      [dirtyUpdate(".claude/a.md"), dirtyUpdate(".claude/b.md"), addAction(".claude/c.md")],
      { nonInteractive: true, projectRoot: "/tmp/project" },
      deps,
    );

    expect(aborted).toBe(false);
    expect(selectMock).toHaveBeenCalledTimes(0);
    expect(resolved).toHaveLength(3);
    expect(resolved[0]).toMatchObject({ kind: "update", resolution: "skip" });
    expect(resolved[1]).toMatchObject({ kind: "update", resolution: "skip" });
    expect(resolved[2]).toMatchObject({ kind: "add" });
  });

  test("interactive prompts once per dirty update; clean updates and adds pass through", async () => {
    const selectMock = mock(async () => "overwrite");
    const deps = buildDeps(selectMock as unknown as PromptDeps["select"]);

    const { resolved, aborted } = await resolveConflicts(
      [
        dirtyUpdate(".claude/a.md"),
        cleanUpdate(".claude/b.md"),
        addAction(".claude/c.md"),
        dirtyUpdate(".claude/d.md"),
      ],
      { nonInteractive: false, projectRoot: "/tmp/project" },
      deps,
    );

    expect(aborted).toBe(false);
    expect(selectMock).toHaveBeenCalledTimes(2);
    expect(resolved).toHaveLength(4);
    expect(resolved[0]).toMatchObject({ targetPath: ".claude/a.md", resolution: "overwrite" });
    expect(resolved[1]).toMatchObject({ targetPath: ".claude/b.md", hadLocalEdits: false });
    expect(resolved[2]).toMatchObject({ kind: "add", targetPath: ".claude/c.md" });
    expect(resolved[3]).toMatchObject({ targetPath: ".claude/d.md", resolution: "overwrite" });
  });

  test("apply-all on first dirty update short-circuits subsequent prompts", async () => {
    const selectMock = mock(async () => "apply-all");
    const deps = buildDeps(selectMock as unknown as PromptDeps["select"]);

    const { resolved, aborted } = await resolveConflicts(
      [dirtyUpdate(".claude/a.md"), dirtyUpdate(".claude/b.md"), dirtyUpdate(".claude/c.md")],
      { nonInteractive: false, projectRoot: "/tmp/project" },
      deps,
    );

    expect(aborted).toBe(false);
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(resolved.every((r) => r.kind === "update" && r.resolution === "overwrite")).toBe(true);
  });

  test("skip-all on first dirty update short-circuits subsequent prompts", async () => {
    const selectMock = mock(async () => "skip-all");
    const deps = buildDeps(selectMock as unknown as PromptDeps["select"]);

    const { resolved, aborted } = await resolveConflicts(
      [dirtyUpdate(".claude/a.md"), dirtyUpdate(".claude/b.md"), dirtyUpdate(".claude/c.md")],
      { nonInteractive: false, projectRoot: "/tmp/project" },
      deps,
    );

    expect(aborted).toBe(false);
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(resolved.every((r) => r.kind === "update" && r.resolution === "skip")).toBe(true);
  });

  test("view-diff renders patch then re-prompts; final choice applies", async () => {
    let call = 0;
    const selectMock = mock(async () => {
      call += 1;
      return call === 1 ? "view-diff" : "skip";
    });
    const noteMock = mock(() => {});
    const deps: PromptDeps = {
      select: selectMock as unknown as PromptDeps["select"],
      isCancel: ((v: unknown) => v === Symbol.for("clack.cancel")) as PromptDeps["isCancel"],
      note: noteMock as unknown as PromptDeps["note"],
    };

    const { resolved, aborted } = await resolveConflicts(
      [dirtyUpdate(".claude/a.md")],
      { nonInteractive: false, projectRoot: "/tmp/project" },
      deps,
    );

    expect(aborted).toBe(false);
    expect(selectMock).toHaveBeenCalledTimes(2);
    expect(noteMock).toHaveBeenCalledTimes(1);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ resolution: "skip" });
  });

  test("isCancel result returns aborted with partial resolved list", async () => {
    let call = 0;
    const selectMock = mock(async () => {
      call += 1;
      return call === 1 ? "overwrite" : Symbol.for("clack.cancel");
    });
    const deps = buildDeps(selectMock as unknown as PromptDeps["select"]);

    const { resolved, aborted } = await resolveConflicts(
      [dirtyUpdate(".claude/a.md"), dirtyUpdate(".claude/b.md"), dirtyUpdate(".claude/c.md")],
      { nonInteractive: false, projectRoot: "/tmp/project" },
      deps,
    );

    expect(aborted).toBe(true);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ targetPath: ".claude/a.md", resolution: "overwrite" });
  });
});
