import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../cli/init";

describe("automation template scaffolding", () => {
  const tempDirs: string[] = [];
  const td = () => {
    const d = mkdtempSync(join(tmpdir(), "oe-auto-"));
    tempDirs.push(d);
    return d;
  };
  const mockWs = (root: string) => {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "ws", private: true, workspaces: ["apps/*", "packages/*"] }),
    );
    writeFileSync(join(root, "turbo.json"), "{}");
    mkdirSync(join(root, "apps"), { recursive: true });
    mkdirSync(join(root, "packages"), { recursive: true });
  };
  afterEach(() => {
    for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
    tempDirs.length = 0;
  });
  const opts = (name: string, targetDir: string, overrides = {}) => ({
    name,
    targetDir,
    preset: "web-app",
    pm: "bun",
    dryRun: false,
    claude: false,
    uv: false,
    specKit: false,
    ...overrides,
  });

  it("standalone includes all automation files", async () => {
    const dir = join(td(), "app");
    const r = await runInit(opts("app", dir));
    expect(r.success).toBe(true);
    for (const f of [
      "commitlint.config.mjs",
      "release-please-config.json",
      ".release-please-manifest.json",
      "CHANGELOG.md",
    ])
      expect(existsSync(join(dir, f))).toBe(true);
    expect(existsSync(join(dir, ".github", "workflows", "ci.yml"))).toBe(true);
    expect(existsSync(join(dir, ".github", "workflows", "release.yml"))).toBe(true);
  });

  it("standalone release-please uses single-package format", async () => {
    const dir = join(td(), "app");
    await runInit(opts("app", dir));
    const c = JSON.parse(readFileSync(join(dir, "release-please-config.json"), "utf-8"));
    expect(c.packages["."]).toBeDefined();
    expect(c["separate-pull-requests"]).toBeUndefined();
  });

  it("standalone manifest starts at 0.0.1", async () => {
    const dir = join(td(), "app");
    await runInit(opts("app", dir));
    const m = JSON.parse(readFileSync(join(dir, ".release-please-manifest.json"), "utf-8"));
    expect(m["."]).toBe("0.0.1");
  });

  it("standalone commitlint has no monorepo scopes", async () => {
    const dir = join(td(), "app");
    await runInit(opts("app", dir));
    const c = readFileSync(join(dir, "commitlint.config.mjs"), "utf-8");
    expect(c).toContain("deps");
    expect(c).not.toContain('"web"');
  });

  it("standalone package.json has prepare + simple-git-hooks + automation deps", async () => {
    const dir = join(td(), "app");
    await runInit(opts("app", dir));
    const p = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
    expect(p.scripts.prepare).toBe("simple-git-hooks");
    expect(p["simple-git-hooks"]["commit-msg"]).toContain("commitlint --edit");
    expect(p.devDependencies["@commitlint/cli"]).toBeDefined();
    expect(p.devDependencies["simple-git-hooks"]).toBeDefined();
  });

  it("bun CI uses setup-bun", async () => {
    const dir = join(td(), "app");
    await runInit(opts("app", dir));
    const ci = readFileSync(join(dir, ".github", "workflows", "ci.yml"), "utf-8");
    expect(ci).toContain("oven-sh/setup-bun");
    expect(ci).toContain("bunx commitlint");
    expect(ci).toContain("bun test");
  });

  it("npm CI uses setup-node and omits bun test", async () => {
    const dir = join(td(), "app");
    await runInit(opts("app", dir, { pm: "npm" }));
    const ci = readFileSync(join(dir, ".github", "workflows", "ci.yml"), "utf-8");
    expect(ci).toContain("actions/setup-node");
    expect(ci).not.toContain("oven-sh/setup-bun");
    expect(ci).toContain("npx commitlint");
    expect(ci).not.toContain("bun test");
  });

  it("npm simple-git-hooks uses npx", async () => {
    const dir = join(td(), "app");
    await runInit(opts("app", dir, { pm: "npm" }));
    const p = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
    expect(p["simple-git-hooks"]["commit-msg"]).toContain("npx commitlint");
  });

  it("monorepo includes automation at root", async () => {
    const dir = join(td(), "mono");
    await runInit(opts("mono", dir, { scope: "monorepo" }));
    expect(existsSync(join(dir, "commitlint.config.mjs"))).toBe(true);
    expect(existsSync(join(dir, "release-please-config.json"))).toBe(true);
    expect(existsSync(join(dir, ".github", "workflows", "ci.yml"))).toBe(true);
  });

  it("monorepo release-please uses multi-package with dynamic names", async () => {
    const dir = join(td(), "mono");
    await runInit(opts("mono", dir, { scope: "monorepo" }));
    const c = JSON.parse(readFileSync(join(dir, "release-please-config.json"), "utf-8"));
    expect(c["separate-pull-requests"]).toBe(true);
    expect(c.packages["apps/web"]["package-name"]).toBe("@mono/web");
  });

  it("monorepo commitlint includes package scopes", async () => {
    const dir = join(td(), "mono");
    await runInit(opts("mono", dir, { scope: "monorepo" }));
    const c = readFileSync(join(dir, "commitlint.config.mjs"), "utf-8");
    expect(c).toContain('"web"');
    expect(c).toContain('"config-typescript"');
  });

  it("monorepo root package.json has automation", async () => {
    const dir = join(td(), "mono");
    await runInit(opts("mono", dir, { scope: "monorepo" }));
    const p = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
    expect(p.scripts.prepare).toBe("simple-git-hooks");
    expect(p["simple-git-hooks"]).toBeDefined();
    expect(p.devDependencies["@commitlint/cli"]).toBeDefined();
  });

  it("workspace-app has NO automation files", async () => {
    const root = td();
    mockWs(root);
    const dir = join(root, "apps", "web");
    await runInit(opts("web", dir, { scope: "workspace-app" }));
    expect(existsSync(join(dir, "commitlint.config.mjs"))).toBe(false);
    expect(existsSync(join(dir, ".github"))).toBe(false);
    expect(existsSync(join(dir, "CHANGELOG.md"))).toBe(false);
  });

  it("workspace-package has NO automation files", async () => {
    const root = td();
    mockWs(root);
    const dir = join(root, "packages", "utils");
    await runInit(opts("utils", dir, { preset: "library", scope: "workspace-package" }));
    expect(existsSync(join(dir, "commitlint.config.mjs"))).toBe(false);
    expect(existsSync(join(dir, ".github"))).toBe(false);
  });

  it("workspace-app package.json has no prepare or automation deps", async () => {
    const root = td();
    mockWs(root);
    const dir = join(root, "apps", "web");
    await runInit(opts("web", dir, { scope: "workspace-app" }));
    const p = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
    expect(p.scripts.prepare).toBeUndefined();
    expect(p["simple-git-hooks"]).toBeUndefined();
    expect(p.devDependencies["@commitlint/cli"]).toBeUndefined();
  });
});
