import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../cli/init";

/**
 * Integration tests for root-level documentation templates.
 *
 * Verifies the CLI-resolvable substitution path: scaffolding a standalone project
 * must fill `[PROJECT_NAME]`, `[INSTALL_COMMAND]`, `[DEV_COMMAND]`, etc. via Eta.
 * User-TODO placeholders (`[PROJECT_DESCRIPTION]`, `[HOSTING_PROVIDER]`, ...)
 * intentionally remain as `[BRACKETS]` for the user to fill in.
 */
describe("root templates produce filled documentation", () => {
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "oe-root-templates-test-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  // CLI-resolvable tokens that MUST be filled by the scaffolder.
  const CLI_RESOLVABLE_TOKENS = [
    "PROJECT_NAME",
    "INSTALL_COMMAND",
    "DEV_COMMAND",
    "BUILD_COMMAND",
    "TEST_COMMAND",
    "LINT_COMMAND",
    "RUNTIME",
    "PACKAGE_MANAGER",
    "FRAMEWORK",
    "LANGUAGE",
    "DEFAULT_BRANCH",
    "RELEASE_DATE",
    "LICENSE_TYPE",
  ] as const;

  function assertNoCliResolvableTokens(content: string, file: string): void {
    for (const token of CLI_RESOLVABLE_TOKENS) {
      expect(content, `${file} should not contain [${token}]`).not.toContain(`[${token}]`);
    }
  }

  it("fills CLI-resolvable tokens in README.md", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "my-app");

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
    expect(existsSync(join(projectDir, "README.md"))).toBe(true);

    const readme = readFileSync(join(projectDir, "README.md"), "utf-8");

    // Project name filled in heading + clone instruction
    expect(readme).toContain("# my-app");
    expect(readme).toContain("cd my-app");

    // CLI commands filled
    expect(readme).toContain("bun install");
    expect(readme).toContain("bun run dev");
    expect(readme).toContain("bun run build");

    // Framework + language filled
    expect(readme).toContain("Next.js");
    expect(readme).toContain("TypeScript");

    // No CLI-resolvable tokens leak through
    assertNoCliResolvableTokens(readme, "README.md");
  });

  it("fills CLI-resolvable tokens in CHANGELOG.md", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "changelog-app");

    const result = await runInit({
      name: "changelog-app",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    const changelog = readFileSync(join(projectDir, "CHANGELOG.md"), "utf-8");
    expect(changelog).toContain("changelog-app");
    // Release date filled with YYYY-MM-DD
    expect(changelog).toMatch(/## \[0\.1\.0\] - \d{4}-\d{2}-\d{2}/);
    assertNoCliResolvableTokens(changelog, "CHANGELOG.md");
  });

  it("fills CLI-resolvable tokens in CONTRIBUTING.md", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "contrib-app");

    const result = await runInit({
      name: "contrib-app",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    const contrib = readFileSync(join(projectDir, "CONTRIBUTING.md"), "utf-8");
    expect(contrib).toContain("contrib-app");
    expect(contrib).toContain("`main`");
    expect(contrib).toContain("bun install");
    assertNoCliResolvableTokens(contrib, "CONTRIBUTING.md");
  });

  it("fills CLI-resolvable tokens in SECURITY.md", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "sec-app");

    const result = await runInit({
      name: "sec-app",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    const security = readFileSync(join(projectDir, "SECURITY.md"), "utf-8");
    expect(security).toContain("sec-app");
    expect(security).toContain("bun run audit");
    assertNoCliResolvableTokens(security, "SECURITY.md");
  });

  it("fills CLI-resolvable tokens in INDEX.md", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "idx-app");

    const result = await runInit({
      name: "idx-app",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    const index = readFileSync(join(projectDir, "INDEX.md"), "utf-8");
    expect(index).toContain("idx-app");
    assertNoCliResolvableTokens(index, "INDEX.md");
  });

  it("preserves user-TODO placeholders for the user to fill in", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "todo-app");

    const result = await runInit({
      name: "todo-app",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    const readme = readFileSync(join(projectDir, "README.md"), "utf-8");

    // User-TODO tokens intentionally left as literal brackets for the user.
    expect(readme).toContain("[PROJECT_DESCRIPTION]");
    expect(readme).toContain("[HOSTING_PROVIDER]");
    expect(readme).toContain("[FEATURE_1]");
  });
});
