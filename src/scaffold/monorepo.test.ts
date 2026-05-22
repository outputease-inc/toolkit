import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../cli/init";

/**
 * Integration tests for full monorepo scaffolding (US6).
 * Verifies turbo.json, workspaces config, shared packages, and starter app.
 */
describe("full monorepo scaffolding", () => {
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "oe-monorepo-test-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("scaffolds a complete Turborepo monorepo with Next.js starter app", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "my-monorepo");

    const result = await runInit({
      name: "my-monorepo",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
      scope: "monorepo",
    });

    expect(result.success).toBe(true);

    // Root config files exist
    expect(existsSync(join(projectDir, "turbo.json"))).toBe(true);
    expect(existsSync(join(projectDir, "package.json"))).toBe(true);
    expect(existsSync(join(projectDir, "biome.json"))).toBe(true);
    expect(existsSync(join(projectDir, ".gitignore"))).toBe(true);

    // Root package.json has workspaces
    const rootPkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf-8"));
    expect(rootPkg.name).toBe("my-monorepo");
    expect(rootPkg.workspaces).toContain("apps/*");
    expect(rootPkg.workspaces).toContain("packages/*");

    // turbo.json has pipeline config
    const turboJson = JSON.parse(readFileSync(join(projectDir, "turbo.json"), "utf-8"));
    expect(turboJson.tasks).toBeDefined();
    expect(turboJson.tasks.build).toBeDefined();
    expect(turboJson.tasks.dev).toBeDefined();

    // Starter app exists in apps/
    expect(existsSync(join(projectDir, "apps", "web", "package.json"))).toBe(true);
    expect(existsSync(join(projectDir, "apps", "web", "next.config.ts"))).toBe(true);

    // Shared config package exists
    expect(existsSync(join(projectDir, "packages", "config-typescript", "package.json"))).toBe(
      true,
    );
    expect(
      existsSync(join(projectDir, "packages", "config-typescript", "tsconfig.base.json")),
    ).toBe(true);

    // Static root template files at monorepo root (NOT under apps/web/)
    expect(existsSync(join(projectDir, "TODO.md"))).toBe(true);
    expect(existsSync(join(projectDir, "HANDOFF.md"))).toBe(true);
    expect(existsSync(join(projectDir, "INDEX.md"))).toBe(true);
    expect(existsSync(join(projectDir, "CONTRIBUTING.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".editorconfig"))).toBe(true);

    // Docs at monorepo root
    expect(existsSync(join(projectDir, "docs", "architecture.md"))).toBe(true);
    expect(existsSync(join(projectDir, "docs", "testing.md"))).toBe(true);

    // Root docs should NOT be under apps/web/
    expect(existsSync(join(projectDir, "apps", "web", "TODO.md"))).toBe(false);
    expect(existsSync(join(projectDir, "apps", "web", "docs"))).toBe(false);
  });

  it("uses workspace:* for internal dependencies", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "ws-deps");

    const result = await runInit({
      name: "ws-deps",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
      scope: "monorepo",
    });

    expect(result.success).toBe(true);

    // Starter app should reference config-typescript
    const appPkg = JSON.parse(
      readFileSync(join(projectDir, "apps", "web", "package.json"), "utf-8"),
    );
    expect(appPkg.devDependencies?.["@ws-deps/config-typescript"]).toBe("workspace:*");
  });

  it("supports monorepo with Claude Code opt-in", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "mono-claude");

    const result = await runInit({
      name: "mono-claude",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: true,
      uv: false,
      specKit: false,
      scope: "monorepo",
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(projectDir, "CLAUDE.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude", "settings.json"))).toBe(true);
  });

  it("supports monorepo with Astro content site", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "mono-astro");

    const result = await runInit({
      name: "mono-astro",
      targetDir: projectDir,
      preset: "content-site",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
      scope: "monorepo",
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(projectDir, "turbo.json"))).toBe(true);
    expect(existsSync(join(projectDir, "apps", "web", "astro.config.mjs"))).toBe(true);
  });

  it("dry-run works for monorepo scope", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "mono-dry");

    const result = await runInit({
      name: "mono-dry",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: true,
      claude: false,
      uv: false,
      specKit: false,
      scope: "monorepo",
    });

    expect(result.success).toBe(true);
    expect(result.filesCreated.length).toBeGreaterThan(0);
    expect(result.filesCreated).toContain("turbo.json");

    // Nothing written to disk
    expect(existsSync(projectDir)).toBe(false);
  });
});
