import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Integration tests for end-to-end standalone web app scaffolding.
 * Tests the non-interactive (preset) path since interactive prompts
 * cannot be driven in automated tests.
 */
describe("init command - standalone web app scaffold", () => {
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "outputease-toolkit-test-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("scaffolds a Next.js project with preset web-app", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "my-app");

    // Import and run the init orchestrator directly
    const { runInit } = await import("./init");
    const result = await runInit({
      name: "my-app",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    expect(result.projectName).toBe("my-app");

    // Verify key files exist
    expect(existsSync(join(projectDir, "package.json"))).toBe(true);
    expect(existsSync(join(projectDir, "tsconfig.json"))).toBe(true);
    expect(existsSync(join(projectDir, "biome.json"))).toBe(true);
    expect(existsSync(join(projectDir, ".gitignore"))).toBe(true);
    expect(existsSync(join(projectDir, "README.md"))).toBe(true);

    // Verify Next.js specific files
    expect(existsSync(join(projectDir, "next.config.ts"))).toBe(true);
    expect(existsSync(join(projectDir, "app", "page.tsx"))).toBe(true);
    expect(existsSync(join(projectDir, "app", "layout.tsx"))).toBe(true);

    // Verify static root template files
    expect(existsSync(join(projectDir, "TODO.md"))).toBe(true);
    expect(existsSync(join(projectDir, "HANDOFF.md"))).toBe(true);
    expect(existsSync(join(projectDir, "INDEX.md"))).toBe(true);
    expect(existsSync(join(projectDir, "CONTRIBUTING.md"))).toBe(true);
    expect(existsSync(join(projectDir, "SECURITY.md"))).toBe(true);
    expect(existsSync(join(projectDir, "SETUP.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".editorconfig"))).toBe(true);
    expect(existsSync(join(projectDir, ".gitattributes"))).toBe(true);
    expect(existsSync(join(projectDir, ".env.example"))).toBe(true);

    // Verify docs/ directory
    expect(existsSync(join(projectDir, "docs", "architecture.md"))).toBe(true);
    expect(existsSync(join(projectDir, "docs", "testing.md"))).toBe(true);
    expect(existsSync(join(projectDir, "docs", "workflow.md"))).toBe(true);

    // Verify package.json content
    const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf-8"));
    expect(pkg.name).toBe("my-app");
    expect(pkg.scripts?.dev).toContain("next");
    expect(pkg.scripts?.build).toContain("next");
  });

  it("scaffolds without Claude Code infrastructure when claude=false", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "no-claude-app");

    const { runInit } = await import("./init");
    const result = await runInit({
      name: "no-claude-app",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(projectDir, "CLAUDE.md"))).toBe(false);
    expect(existsSync(join(projectDir, ".claude"))).toBe(false);
  });

  it("uses the specified package manager in generated files", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "npm-app");

    const { runInit } = await import("./init");
    const result = await runInit({
      name: "npm-app",
      targetDir: projectDir,
      preset: "web-app",
      pm: "npm",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    const _pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf-8"));
    // Scripts should use npm run
    const readmeContent = readFileSync(join(projectDir, "README.md"), "utf-8");
    expect(readmeContent).toContain("npm");
  });
});

describe("init command - project name validation", () => {
  it.each([
    ["foo/../bar"],
    [".."],
    ["../escape"],
    ["foo/bar"],
    ["UPPER"],
    [""],
    ["a b"],
  ])("rejects unsafe project name %p", async (name) => {
    const { runInit } = await import("./init");
    const result = await runInit({
      name,
      targetDir: join(tmpdir(), `oe-bad-${Date.now()}-${Math.random()}`),
      preset: "web-app",
      pm: "bun",
      dryRun: true,
      claude: false,
      uv: false,
      specKit: false,
    });
    expect(result.success).toBe(false);
    expect(result.error?.toLowerCase()).toContain("invalid project name");
  });

  it("accepts @scope/name", async () => {
    const { runInit } = await import("./init");
    const result = await runInit({
      name: "@acme/web",
      targetDir: join(tmpdir(), `oe-scoped-${Date.now()}-${Math.random()}`),
      preset: "web-app",
      pm: "bun",
      dryRun: true,
      claude: false,
      uv: false,
      specKit: false,
    });
    expect(result.success).toBe(true);
  });
});
