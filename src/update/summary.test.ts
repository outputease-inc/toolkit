import { describe, expect, test } from "bun:test";
import { countActions, renderSummary } from "./summary";
import type { UpdateRunSummary } from "./types";

const baseSummary: UpdateRunSummary = {
  installedToolkitVersion: "0.2.0",
  upstreamSha: "abc1234",
  markerVersion: "0.0.3",
  versionDiverged: true,
  startedAt: "2026-05-15T00:00:00.000Z",
  completedAt: "2026-05-15T00:00:05.000Z",
  result: "success",
  actions: [
    { kind: "add", targetPath: ".claude/x.md", sourcePath: "/staged/.claude/x.md" },
    {
      kind: "update",
      targetPath: ".claude/y.md",
      sourcePath: "/staged/.claude/y.md",
      hadLocalEdits: false,
      resolution: "overwrite",
    },
    {
      kind: "update",
      targetPath: ".claude/z.md",
      sourcePath: "/staged/.claude/z.md",
      hadLocalEdits: true,
      resolution: "skip",
    },
    { kind: "skip", targetPath: ".claude/keep.md", reason: "unchanged" },
  ],
};

describe("countActions", () => {
  test("counts each category", () => {
    const c = countActions(baseSummary);
    expect(c.added).toBe(1);
    expect(c.updatedClean).toBe(1);
    expect(c.skipped).toBe(1);
    expect(c.unchanged).toBe(1);
  });
});

describe("renderSummary", () => {
  test("includes installed/upstream/marker lines", () => {
    const text = renderSummary(baseSummary);
    expect(text).toContain("Toolkit installed: 0.2.0");
    expect(text).toContain("Upstream SHA:      abc1234");
    expect(text).toContain("Marker version:    0.0.3 (diverged from installed)");
    expect(text).toContain("Result: success");
  });

  test("omits divergence label when versionDiverged=false", () => {
    const text = renderSummary({ ...baseSummary, versionDiverged: false });
    expect(text).not.toContain("(diverged from installed)");
  });
});
