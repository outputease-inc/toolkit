import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "./init";

describe("init command - preset mode", () => {
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "oe-preset-test-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("scaffolds with --preset web-app without prompts", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "my-web-app");

    const result = await runInit({
      name: "my-web-app",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(projectDir, "package.json"))).toBe(true);
    expect(existsSync(join(projectDir, "next.config.ts"))).toBe(true);
  });

  it("scaffolds with --preset content-site", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "my-site");

    const result = await runInit({
      name: "my-site",
      targetDir: projectDir,
      preset: "content-site",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(projectDir, "package.json"))).toBe(true);
    expect(existsSync(join(projectDir, "astro.config.mjs"))).toBe(true);
  });

  it("scaffolds with --preset cli-tool", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "my-cli");

    const result = await runInit({
      name: "my-cli",
      targetDir: projectDir,
      preset: "cli-tool",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(projectDir, "package.json"))).toBe(true);
    expect(existsSync(join(projectDir, "src", "index.ts"))).toBe(true);
  });

  it("returns error for unknown preset", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "bad");

    const result = await runInit({
      name: "bad",
      targetDir: projectDir,
      preset: "nonexistent",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown preset");
    expect(result.error).toContain("web-app");
  });

  it("scaffolds with --preset web-app-supabase and includes Supabase tools", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "my-web-app-supa");

    const result = await runInit({
      name: "my-web-app-supa",
      targetDir: projectDir,
      preset: "web-app-supabase",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    const toolNames = result.stack.tools.map((t) => t.tool);
    expect(toolNames).toContain("Supabase");
    expect(toolNames).toContain("Supabase Auth");
    expect(result.stack.additiveRoutes).toEqual(["backend:supabase"]);
  });

  it("scaffolds with --preset web-app-standalone and includes standalone backend tools", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "my-web-app-standalone");

    const result = await runInit({
      name: "my-web-app-standalone",
      targetDir: projectDir,
      preset: "web-app-standalone",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    const toolNames = result.stack.tools.map((t) => t.tool);
    expect(toolNames).toContain("Neon");
    expect(toolNames).toContain("BetterAuth");
    expect(result.stack.additiveRoutes).toEqual(["backend:standalone"]);
  });

  it("scaffolds with --preset web-app-node and includes Node.js tools", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "my-web-app-node");

    const result = await runInit({
      name: "my-web-app-node",
      targetDir: projectDir,
      preset: "web-app-node",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    const toolNames = result.stack.tools.map((t) => t.tool);
    expect(toolNames).toContain("Node.js");
    expect(toolNames).toContain("pnpm");
    expect(toolNames).toContain("Vitest");
    expect(toolNames).not.toContain("Bun");
    expect(result.stack.additiveRoutes).toEqual(["runtime:node"]);
  });

  it("scaffolds with runtime and backend CLI flags", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "my-full-stack");

    const result = await runInit({
      name: "my-full-stack",
      targetDir: projectDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
      runtime: "node",
      backend: "supabase",
    });

    expect(result.success).toBe(true);
    const toolNames = result.stack.tools.map((t) => t.tool);
    expect(toolNames).toContain("Node.js");
    expect(toolNames).toContain("Supabase");
  });

  it("ignores backend flag for cli-tool (tooling platform)", async () => {
    const tempDir = createTempDir();
    const projectDir = join(tempDir, "my-cli-backend");

    const result = await runInit({
      name: "my-cli-backend",
      targetDir: projectDir,
      preset: "cli-tool",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
      backend: "supabase",
    });

    expect(result.success).toBe(true);
    const toolNames = result.stack.tools.map((t) => t.tool);
    expect(toolNames).not.toContain("Supabase");
  });
});
