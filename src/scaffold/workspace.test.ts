import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectWorkspace } from "./workspace";

describe("detectWorkspace", () => {
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "oe-ws-test-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("detects Turborepo workspace via turbo.json", () => {
    const dir = createTempDir();
    writeFileSync(join(dir, "turbo.json"), JSON.stringify({ pipeline: {} }));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "root", workspaces: ["apps/*", "packages/*"] }),
    );

    const result = detectWorkspace(dir);
    expect(result.detected).toBe(true);
    expect(result.type).toBe("turborepo");
    expect(result.appsDir).toBe("apps");
    expect(result.packagesDir).toBe("packages");
  });

  it("detects pnpm workspace via pnpm-workspace.yaml", () => {
    const dir = createTempDir();
    writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "root" }));

    const result = detectWorkspace(dir);
    expect(result.detected).toBe(true);
    expect(result.type).toBe("pnpm");
    expect(result.supported).toBe(false);
  });

  it("detects npm/yarn/bun workspace via package.json workspaces field", () => {
    const dir = createTempDir();
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "root", workspaces: ["packages/*"] }),
    );

    const result = detectWorkspace(dir);
    expect(result.detected).toBe(true);
    expect(result.type).toBe("npm-workspaces");
  });

  it("returns not detected for a non-workspace directory", () => {
    const dir = createTempDir();
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "standalone" }));

    const result = detectWorkspace(dir);
    expect(result.detected).toBe(false);
  });

  it("returns not detected for an empty directory", () => {
    const dir = createTempDir();
    const result = detectWorkspace(dir);
    expect(result.detected).toBe(false);
  });
});
