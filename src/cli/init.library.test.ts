import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "./init";

describe("init command - library preset", () => {
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "oe-library-test-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("scaffolds a library with preset library", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "my-lib");

    const result = await runInit({
      name: "my-lib",
      targetDir: projectDir,
      preset: "library",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    expect(result.projectName).toBe("my-lib");

    // Verify key files exist
    expect(existsSync(join(projectDir, "package.json"))).toBe(true);
    expect(existsSync(join(projectDir, "tsconfig.json"))).toBe(true);
    expect(existsSync(join(projectDir, "biome.json"))).toBe(true);
    expect(existsSync(join(projectDir, ".gitignore"))).toBe(true);
    expect(existsSync(join(projectDir, "README.md"))).toBe(true);
    expect(existsSync(join(projectDir, "src", "index.ts"))).toBe(true);

    // Should NOT have framework-specific files
    expect(existsSync(join(projectDir, "next.config.ts"))).toBe(false);
    expect(existsSync(join(projectDir, "astro.config.mjs"))).toBe(false);
  });

  it("generates package.json with exports map for library", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "my-lib");

    const result = await runInit({
      name: "my-lib",
      targetDir: projectDir,
      preset: "library",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);

    const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf-8"));
    expect(pkg.name).toBe("my-lib");
    expect(pkg.type).toBe("module");
    expect(pkg.exports).toBeDefined();
    expect(pkg.exports["."]).toBeDefined();
    expect(pkg.exports["."].default).toBe("./src/index.ts");
  });

  it("generates library-specific scripts", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "my-lib");

    const result = await runInit({
      name: "my-lib",
      targetDir: projectDir,
      preset: "library",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);

    const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf-8"));
    expect(pkg.scripts.dev).toBe("tsc --watch");
    expect(pkg.scripts.build).toBe("tsc");
    expect(pkg.scripts.test).toBe("bun test");
    expect(pkg.scripts.typecheck).toBe("tsc --noEmit");
  });

  it("generates src/index.ts with empty export", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "my-lib");

    const result = await runInit({
      name: "my-lib",
      targetDir: projectDir,
      preset: "library",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);

    const content = readFileSync(join(projectDir, "src", "index.ts"), "utf-8");
    expect(content.trim()).toBe("export {};");
  });

  it("has no runtime dependencies", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "my-lib");

    const result = await runInit({
      name: "my-lib",
      targetDir: projectDir,
      preset: "library",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);

    const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf-8"));
    const depCount = Object.keys(pkg.dependencies ?? {}).length;
    expect(depCount).toBe(0);
  });
});
