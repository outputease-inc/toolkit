import { describe, expect, test } from "bun:test";
import { isPathInScope, UPDATE_SCOPE } from "./manifest";

describe("UPDATE_SCOPE", () => {
  test("directories are .claude and .specify only", () => {
    expect(UPDATE_SCOPE.directories).toEqual([".claude", ".specify"]);
  });

  test("rootFiles is .mcp.json only", () => {
    expect(UPDATE_SCOPE.rootFiles).toEqual([".mcp.json"]);
  });
});

describe("isPathInScope", () => {
  test.each([
    [".claude/commands/foo.md", true],
    [".claude", true],
    [".specify/memory/constitution.md", true],
    [".mcp.json", true],
    ["src/index.ts", false],
    ["apps/card/page.tsx", false],
    ["packages/db/schema.ts", false],
    ["package.json", false],
    [".env", false],
    ["biome.json", false],
    ["", false],
    ["../outside/foo.md", false],
  ])("isPathInScope(%s) === %s", (path, expected) => {
    expect(isPathInScope(path)).toBe(expected);
  });

  test("normalizes Windows backslashes", () => {
    expect(isPathInScope(".claude\\commands\\foo.md")).toBe(true);
  });
});
