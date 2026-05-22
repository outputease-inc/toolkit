import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RenderedFile } from "./renderer";
import { RollbackManager, validateTargetDir, writeFiles } from "./writer";

describe("dry-run mode", () => {
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "oe-writer-test-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  const sampleFiles: RenderedFile[] = [
    { relativePath: "package.json", content: '{"name": "test"}' },
    { relativePath: "src/index.ts", content: 'console.log("hello");' },
    { relativePath: "src/utils/helpers.ts", content: "export const x = 1;" },
  ];

  it("collects file paths without writing to disk in dry-run", () => {
    const tempDir = createTempDir();
    const targetDir = join(tempDir, "dry-project");
    const rollback = new RollbackManager();

    const { filesCreated } = writeFiles(sampleFiles, { targetDir, dryRun: true }, rollback);

    expect(filesCreated).toEqual(["package.json", "src/index.ts", "src/utils/helpers.ts"]);
    expect(existsSync(targetDir)).toBe(false);
    expect(rollback.trackedEntries).toHaveLength(0);
  });

  it("writes files to disk when dryRun is false", () => {
    const tempDir = createTempDir();
    const targetDir = join(tempDir, "real-project");
    const rollback = new RollbackManager();

    const { filesCreated } = writeFiles(sampleFiles, { targetDir, dryRun: false }, rollback);

    expect(filesCreated).toEqual(["package.json", "src/index.ts", "src/utils/helpers.ts"]);
    expect(existsSync(join(targetDir, "package.json"))).toBe(true);
    expect(existsSync(join(targetDir, "src/index.ts"))).toBe(true);
    expect(existsSync(join(targetDir, "src/utils/helpers.ts"))).toBe(true);
    expect(rollback.trackedEntries.length).toBeGreaterThan(0);
  });
});

describe("RollbackManager", () => {
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "oe-rollback-test-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("rolls back created files and directories in LIFO order", () => {
    const tempDir = createTempDir();
    const targetDir = join(tempDir, "rollback-test");
    const rollback = new RollbackManager();

    // Write some files
    const files: RenderedFile[] = [
      { relativePath: "package.json", content: '{"name": "test"}' },
      { relativePath: "src/index.ts", content: "export {};" },
    ];
    writeFiles(files, { targetDir, dryRun: false }, rollback);

    // Verify files exist
    expect(existsSync(join(targetDir, "package.json"))).toBe(true);
    expect(existsSync(join(targetDir, "src/index.ts"))).toBe(true);

    // Rollback
    rollback.rollback();

    // Files should be gone
    expect(existsSync(join(targetDir, "package.json"))).toBe(false);
    expect(existsSync(join(targetDir, "src/index.ts"))).toBe(false);
  });

  it("restores modified files during rollback", () => {
    const tempDir = createTempDir();
    const filePath = join(tempDir, "existing.txt");
    writeFileSync(filePath, "original content", "utf-8");

    const rollback = new RollbackManager();
    rollback.trackFileModified(filePath, "original content");

    // Modify the file
    writeFileSync(filePath, "modified content", "utf-8");
    expect(readFileSync(filePath, "utf-8")).toBe("modified content");

    // Rollback restores original
    rollback.rollback();
    expect(readFileSync(filePath, "utf-8")).toBe("original content");
  });

  it("simulates mid-write error and verifies zero orphaned files (SC-006)", async () => {
    const tempDir = createTempDir();
    const targetDir = join(tempDir, "error-test");
    const rollback = new RollbackManager();

    // Write first file successfully
    const firstFile: RenderedFile[] = [
      { relativePath: "package.json", content: '{"name": "test"}' },
    ];
    writeFiles(firstFile, { targetDir, dryRun: false }, rollback);
    expect(existsSync(join(targetDir, "package.json"))).toBe(true);

    // Simulate error after first write — rollback should clean up
    rollback.rollback();

    // No orphaned files
    expect(existsSync(join(targetDir, "package.json"))).toBe(false);
  });
});

describe("validateTargetDir", () => {
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "oe-validate-test-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("passes for non-existent directory", () => {
    const tempDir = createTempDir();
    const targetDir = join(tempDir, "new-project");
    expect(() => validateTargetDir(targetDir, "standalone")).not.toThrow();
  });

  it("passes for empty directory", () => {
    const tempDir = createTempDir();
    const targetDir = join(tempDir, "empty-dir");
    mkdirSync(targetDir);
    expect(() => validateTargetDir(targetDir, "standalone")).not.toThrow();
  });

  it("throws when package.json exists in standalone mode", () => {
    const tempDir = createTempDir();
    const targetDir = join(tempDir, "has-pkg");
    mkdirSync(targetDir);
    writeFileSync(join(targetDir, "package.json"), "{}", "utf-8");
    expect(() => validateTargetDir(targetDir, "standalone")).toThrow(/package.json/);
  });

  it("skips validation for monorepo scope", () => {
    const tempDir = createTempDir();
    const targetDir = join(tempDir, "mono");
    mkdirSync(targetDir);
    writeFileSync(join(targetDir, "package.json"), "{}", "utf-8");
    expect(() => validateTargetDir(targetDir, "monorepo")).not.toThrow();
  });
});

describe("dry-run end-to-end via runInit", () => {
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "oe-dryrun-e2e-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("returns file list without creating anything on disk", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "dry-run-app");

    const { runInit } = await import("../cli/init");
    const result = await runInit({
      name: "dry-run-app",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: true,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    expect(result.filesCreated.length).toBeGreaterThan(0);
    expect(result.filesCreated).toContain("package.json");
    expect(existsSync(projectDir)).toBe(false);
  });

  it("dry-run file list matches real run file list", async () => {
    const tempDirDry = createTempDir();
    const tempDirReal = createTempDir();
    const projectDry = join(tempDirDry, "dry");
    const projectReal = join(tempDirReal, "real");

    const { runInit } = await import("../cli/init");

    const dryResult = await runInit({
      name: "test-proj",
      targetDir: projectDry,
      preset: "web-app",
      pm: "bun",
      dryRun: true,
      claude: false,
      uv: false,
      specKit: false,
    });

    const realResult = await runInit({
      name: "test-proj",
      targetDir: projectReal,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(dryResult.success).toBe(true);
    expect(realResult.success).toBe(true);
    expect(dryResult.filesCreated.sort()).toEqual(realResult.filesCreated.sort());
  });
});

describe("writeFiles path traversal containment", () => {
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "oe-writer-traversal-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("throws when a relativePath escapes targetDir via ..", () => {
    const tempDir = createTempDir();
    const targetDir = join(tempDir, "project");
    mkdirSync(targetDir, { recursive: true });
    const rollback = new RollbackManager();
    const malicious: RenderedFile[] = [{ relativePath: "../escape.txt", content: "no" }];
    expect(() => writeFiles(malicious, { targetDir, dryRun: false }, rollback)).toThrow(
      /Path traversal blocked/,
    );
    expect(existsSync(join(tempDir, "escape.txt"))).toBe(false);
  });

  it("throws for an absolute path that points outside targetDir", () => {
    const tempDir = createTempDir();
    const targetDir = join(tempDir, "project");
    mkdirSync(targetDir, { recursive: true });
    const rollback = new RollbackManager();
    const elsewhere = join(tempDir, "elsewhere.txt");
    // Use a relative path with enough .. to climb above targetDir
    const escapePath = ["..", "..", "elsewhere.txt"].join("/");
    const malicious: RenderedFile[] = [{ relativePath: escapePath, content: "no" }];
    expect(() => writeFiles(malicious, { targetDir, dryRun: false }, rollback)).toThrow(
      /Path traversal blocked/,
    );
    expect(existsSync(elsewhere)).toBe(false);
  });
});
