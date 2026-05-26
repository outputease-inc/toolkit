import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../cli/init";

/**
 * Integration tests for spec-kit opt-in vs opt-out.
 * Verifies that specKit=true adds the spec-kit section to CLAUDE.md,
 * and specKit=false omits it entirely.
 */
describe("spec-kit opt-in/opt-out", () => {
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "oe-speckit-test-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("includes spec-kit section in CLAUDE.md when specKit=true and claude=true", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "speckit-on");

    const result = await runInit({
      name: "speckit-on",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: true,
      uv: false,
      specKit: true,
    });

    expect(result.success).toBe(true);
    const claudeMd = readFileSync(join(projectDir, "CLAUDE.md"), "utf-8");
    expect(claudeMd).toContain("spec-kit");
    expect(claudeMd).toContain("Spec-Driven Development");
    expect(claudeMd).toContain("/speckit-specify");
  });

  it("omits spec-kit section from CLAUDE.md when specKit=false", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "speckit-off");

    const result = await runInit({
      name: "speckit-off",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: true,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    const claudeMd = readFileSync(join(projectDir, "CLAUDE.md"), "utf-8");
    expect(claudeMd).not.toContain("spec-kit");
    expect(claudeMd).not.toContain("Spec-Driven Development");
  });

  it("no CLAUDE.md at all when claude=false regardless of specKit", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "no-claude");

    const result = await runInit({
      name: "no-claude",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: true,
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(projectDir, "CLAUDE.md"))).toBe(false);
  });

  it("does not run post-install when uv=false and specKit=false", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "no-postinstall");

    const result = await runInit({
      name: "no-postinstall",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    expect(result.postInstall).toBeUndefined();
  });

  it("dry-run does not spawn any external commands", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "dry-speckit");

    const result = await runInit({
      name: "dry-speckit",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: true,
      claude: true,
      uv: true,
      specKit: true,
    });

    expect(result.success).toBe(true);
    // Dry-run should not write anything to disk
    expect(existsSync(projectDir)).toBe(false);
  });

  it("produces identical non-CLAUDE files regardless of specKit opt-in", async () => {
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
      specKit: true,
    });

    const resultOff = await runInit({
      name: "compare",
      targetDir: projectOff,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: true,
      uv: false,
      specKit: false,
    });

    expect(resultOn.success).toBe(true);
    expect(resultOff.success).toBe(true);

    // Same files created (CLAUDE.md exists in both since claude=true)
    expect(resultOn.filesCreated.sort()).toEqual(resultOff.filesCreated.sort());
  });
});
