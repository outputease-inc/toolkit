import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../cli/init";

/**
 * Integration tests for Claude Code opt-in vs opt-out.
 * Verifies that claude=true generates CLAUDE.md + .claude/ directory,
 * and claude=false omits them entirely.
 */
describe("Claude Code infrastructure opt-in", () => {
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "oe-claude-test-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("generates CLAUDE.md and .claude/ when claude=true", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "claude-on");

    const result = await runInit({
      name: "claude-on",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: true,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);

    // Claude Code files present
    expect(existsSync(join(projectDir, "CLAUDE.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude", "settings.json"))).toBe(true);

    // CLAUDE.md contains project-specific content (from .eta template)
    const claudeMd = readFileSync(join(projectDir, "CLAUDE.md"), "utf-8");
    expect(claudeMd).toContain("claude-on");
    expect(claudeMd).toContain("Next.js");
    expect(claudeMd).toContain("bun");

    // Claude static infrastructure files present
    expect(existsSync(join(projectDir, ".claude", "commands", "quickstart.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude", "commands", "session-end.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude", "commands", "checkpoint.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude", "agents", "accessibility-reviewer.md"))).toBe(
      true,
    );
    expect(existsSync(join(projectDir, ".claude", "agents", "test-writer.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude", "skills", "INDEX.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude", "docs", "AGENTS-INDEX.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude", "docs", "PLUGINS-INDEX.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude", "hooks", "protect-sensitive.js"))).toBe(true);
  });

  it("omits CLAUDE.md and .claude/ when claude=false", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "claude-off");

    const result = await runInit({
      name: "claude-off",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);

    // Claude Code files absent
    expect(existsSync(join(projectDir, "CLAUDE.md"))).toBe(false);
    expect(existsSync(join(projectDir, ".claude"))).toBe(false);
  });

  it("produces identical non-Claude files regardless of Claude opt-in", async () => {
    const tempDirOn = createTempDir();
    const tempDirOff = createTempDir();
    const projectOn = join(tempDirOn, "compare-on");
    const projectOff = join(tempDirOff, "compare-off");

    const resultOn = await runInit({
      name: "compare",
      targetDir: projectOn,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: true,
      uv: false,
      specKit: false,
    });

    const resultOff = await runInit({
      name: "compare",
      targetDir: projectOff,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(resultOn.success).toBe(true);
    expect(resultOff.success).toBe(true);

    // Non-Claude files should be identical
    const isClaudeFile = (f: string) =>
      f.startsWith("CLAUDE.md") ||
      f.startsWith(".claude") ||
      f === ".mcp.json" ||
      f === "scripts/install-claude-plugins.sh";
    const nonClaudeFilesOn = resultOn.filesCreated.filter((f) => !isClaudeFile(f));
    const nonClaudeFilesOff = resultOff.filesCreated.filter((f) => !isClaudeFile(f));
    expect(nonClaudeFilesOn).toEqual(nonClaudeFilesOff);

    // Claude opt-in should have extra files
    const claudeOnlyFiles = resultOn.filesCreated.filter(
      (f) => f.startsWith("CLAUDE.md") || f.startsWith(".claude"),
    );
    expect(claudeOnlyFiles.length).toBeGreaterThan(0);
  });

  it("varies CLAUDE.md content by framework", async () => {
    const tempDirNext = createTempDir();
    const tempDirAstro = createTempDir();
    const projectNext = join(tempDirNext, "next-claude");
    const projectAstro = join(tempDirAstro, "astro-claude");

    const resultNext = await runInit({
      name: "next-claude",
      targetDir: projectNext,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: true,
      uv: false,
      specKit: false,
    });

    const resultAstro = await runInit({
      name: "astro-claude",
      targetDir: projectAstro,
      preset: "content-site",
      pm: "bun",
      dryRun: false,
      claude: true,
      uv: false,
      specKit: false,
    });

    expect(resultNext.success).toBe(true);
    expect(resultAstro.success).toBe(true);

    const claudeNext = readFileSync(join(projectNext, "CLAUDE.md"), "utf-8");
    const claudeAstro = readFileSync(join(projectAstro, "CLAUDE.md"), "utf-8");

    // Both should exist and differ
    expect(claudeNext).toContain("Next.js");
    expect(claudeAstro).toContain("Astro");
    expect(claudeNext).not.toEqual(claudeAstro);
  });

  it("varies CLAUDE.md content by package manager", async () => {
    const tempDirBun = createTempDir();
    const tempDirNpm = createTempDir();
    const projectBun = join(tempDirBun, "bun-claude");
    const projectNpm = join(tempDirNpm, "npm-claude");

    const resultBun = await runInit({
      name: "bun-claude",
      targetDir: projectBun,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: true,
      uv: false,
      specKit: false,
    });

    const resultNpm = await runInit({
      name: "npm-claude",
      targetDir: projectNpm,
      preset: "web-app",
      pm: "npm",
      dryRun: false,
      claude: true,
      uv: false,
      specKit: false,
    });

    expect(resultBun.success).toBe(true);
    expect(resultNpm.success).toBe(true);

    const claudeBun = readFileSync(join(projectBun, "CLAUDE.md"), "utf-8");
    const claudeNpm = readFileSync(join(projectNpm, "CLAUDE.md"), "utf-8");

    expect(claudeBun).toContain("bun");
    expect(claudeNpm).toContain("npm");
  });
});
