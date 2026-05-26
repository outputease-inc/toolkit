import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "./init";

/**
 * Tests for workspace-app and workspace-package scopes.
 * These simulate scaffolding into an existing Turborepo workspace.
 */
describe("init command - workspace scopes", () => {
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "oe-workspace-test-"));
    tempDirs.push(dir);
    return dir;
  }

  function createMockWorkspace(root: string): void {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        name: "test-monorepo",
        private: true,
        workspaces: ["apps/*", "packages/*"],
      }),
    );
    writeFileSync(
      join(root, "turbo.json"),
      JSON.stringify({ $schema: "https://turbo.build/schema.json" }),
    );
    mkdirSync(join(root, "apps"), { recursive: true });
    mkdirSync(join(root, "packages"), { recursive: true });
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("workspace-app scaffolds into apps/<name>/ with no biome.json or .gitignore", async () => {
    const root = createTempDir();
    createMockWorkspace(root);
    const appDir = join(root, "apps", "web");

    const result = await runInit({
      name: "web",
      targetDir: appDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
      scope: "workspace-app",
    });

    expect(result.success).toBe(true);

    // App-specific files should exist
    expect(existsSync(join(appDir, "package.json"))).toBe(true);
    expect(existsSync(join(appDir, "tsconfig.json"))).toBe(true);
    expect(existsSync(join(appDir, "next.config.ts"))).toBe(true);
    expect(existsSync(join(appDir, "app", "page.tsx"))).toBe(true);
    expect(existsSync(join(appDir, "README.md"))).toBe(true);

    // Root-level configs should NOT exist (inherited from workspace root)
    expect(existsSync(join(appDir, "biome.json"))).toBe(false);
    expect(existsSync(join(appDir, ".gitignore"))).toBe(false);

    // Root/docs static files should NOT exist in workspace scopes
    expect(existsSync(join(appDir, "TODO.md"))).toBe(false);
    expect(existsSync(join(appDir, "HANDOFF.md"))).toBe(false);
    expect(existsSync(join(appDir, "docs"))).toBe(false);
  });

  it("workspace-package scaffolds a library with no biome.json or .gitignore", async () => {
    const root = createTempDir();
    createMockWorkspace(root);
    const pkgDir = join(root, "packages", "utils");

    const result = await runInit({
      name: "utils",
      targetDir: pkgDir,
      preset: "library",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
      scope: "workspace-package",
    });

    expect(result.success).toBe(true);

    // Package files should exist
    expect(existsSync(join(pkgDir, "package.json"))).toBe(true);
    expect(existsSync(join(pkgDir, "tsconfig.json"))).toBe(true);
    expect(existsSync(join(pkgDir, "src", "index.ts"))).toBe(true);
    expect(existsSync(join(pkgDir, "README.md"))).toBe(true);

    // Root-level configs should NOT exist
    expect(existsSync(join(pkgDir, "biome.json"))).toBe(false);
    expect(existsSync(join(pkgDir, ".gitignore"))).toBe(false);
  });

  it("workspace-package with cli-tool preset excludes root configs", async () => {
    const root = createTempDir();
    createMockWorkspace(root);
    const pkgDir = join(root, "packages", "my-cli");

    const result = await runInit({
      name: "my-cli",
      targetDir: pkgDir,
      preset: "cli-tool",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
      scope: "workspace-package",
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(pkgDir, "package.json"))).toBe(true);
    expect(existsSync(join(pkgDir, "src", "index.ts"))).toBe(true);

    // Root-level configs should NOT exist
    expect(existsSync(join(pkgDir, "biome.json"))).toBe(false);
    expect(existsSync(join(pkgDir, ".gitignore"))).toBe(false);
  });

  it("workspace-app with content-site preset works", async () => {
    const root = createTempDir();
    createMockWorkspace(root);
    const appDir = join(root, "apps", "docs");

    const result = await runInit({
      name: "docs",
      targetDir: appDir,
      preset: "content-site",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
      scope: "workspace-app",
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(appDir, "package.json"))).toBe(true);
    expect(existsSync(join(appDir, "astro.config.mjs"))).toBe(true);
    expect(existsSync(join(appDir, "biome.json"))).toBe(false);
    expect(existsSync(join(appDir, ".gitignore"))).toBe(false);
  });

  it("workspace-app with claude=true includes Claude files but still excludes root configs", async () => {
    const root = createTempDir();
    createMockWorkspace(root);
    const appDir = join(root, "apps", "web");

    const result = await runInit({
      name: "web",
      targetDir: appDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: true,
      uv: false,
      specKit: false,
      scope: "workspace-app",
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(appDir, "CLAUDE.md"))).toBe(true);
    expect(existsSync(join(appDir, "biome.json"))).toBe(false);
    expect(existsSync(join(appDir, ".gitignore"))).toBe(false);

    // Claude static infrastructure files should be present
    expect(existsSync(join(appDir, ".claude", "commands", "quickstart.md"))).toBe(true);
    expect(existsSync(join(appDir, ".claude", "agents", "test-writer.md"))).toBe(true);
    expect(existsSync(join(appDir, ".claude", "skills", "INDEX.md"))).toBe(true);

    // Root/docs static files should NOT be present in workspace scopes
    expect(existsSync(join(appDir, "TODO.md"))).toBe(false);
    expect(existsSync(join(appDir, "HANDOFF.md"))).toBe(false);
    expect(existsSync(join(appDir, "docs"))).toBe(false);
  });
});
