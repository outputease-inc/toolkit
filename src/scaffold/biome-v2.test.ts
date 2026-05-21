import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../cli/init";

describe("biome v2 template", () => {
  const dirs: string[] = [];
  const td = () => {
    const d = mkdtempSync(join(tmpdir(), "oe-biome-"));
    dirs.push(d);
    return d;
  };
  const opts = (name: string, dir: string, ov = {}) => ({
    name,
    targetDir: dir,
    preset: "web-app",
    pm: "bun",
    dryRun: false,
    claude: false,
    uv: false,
    specKit: false,
    ...ov,
  });
  const biome = (dir: string) => JSON.parse(readFileSync(join(dir, "biome.json"), "utf-8"));

  // afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); dirs.length = 0; });

  it("uses v2 schema, assist.actions, and files.includes", async () => {
    const dir = join(td(), "app");
    await runInit(opts("app", dir));
    const b = biome(dir);
    expect(b.$schema).toContain("2.0.0");
    expect(b.assist?.actions?.source?.organizeImports).toBe("on");
    expect(b.files?.includes).toBeArray();
    expect(b.files?.includes).toContain("!node_modules");
  });

  it("uses 2-space indent", async () => {
    const dir = join(td(), "app");
    await runInit(opts("app", dir));
    const b = biome(dir);
    expect(b.formatter.indentStyle).toBe("space");
    expect(b.formatter.indentWidth).toBe(2);
  });

  it("includes CSS block for Next.js (CSS framework)", async () => {
    const dir = join(td(), "app");
    await runInit(opts("app", dir));
    const b = biome(dir);
    expect(b.css).toBeDefined();
    expect(b.css.parser.tailwindDirectives).toBe(true);
  });

  it("omits CSS block for bun-cli (no CSS)", async () => {
    const dir = join(td(), "cli");
    await runInit(opts("cli", dir, { preset: "cli-tool" }));
    const b = biome(dir);
    expect(b.css).toBeUndefined();
  });

  it("includes useExhaustiveDependencies for React frameworks", async () => {
    const dir = join(td(), "app");
    await runInit(opts("app", dir));
    const b = biome(dir);
    expect(b.linter.rules.correctness.useExhaustiveDependencies).toBe("warn");
  });

  it("omits useExhaustiveDependencies for non-React frameworks", async () => {
    const dir = join(td(), "cli");
    await runInit(opts("cli", dir, { preset: "cli-tool" }));
    const b = biome(dir);
    expect(b.linter.rules.correctness.useExhaustiveDependencies).toBeUndefined();
  });

  it("bun-cli allows console (noConsole off)", async () => {
    const dir = join(td(), "cli");
    await runInit(opts("cli", dir, { preset: "cli-tool" }));
    const b = biome(dir);
    expect(b.linter.rules.suspicious.noConsole).toBe("off");
  });

  it("monorepo excludes .turbo", async () => {
    const dir = join(td(), "mono");
    await runInit(opts("mono", dir, { scope: "monorepo" }));
    const b = biome(dir);
    expect(b.files.includes).toContain("!.turbo");
  });

  it("monorepo always includes CSS block", async () => {
    const dir = join(td(), "mono");
    await runInit(opts("mono", dir, { scope: "monorepo" }));
    const b = biome(dir);
    expect(b.css).toBeDefined();
    expect(b.css.parser.tailwindDirectives).toBe(true);
  });
});
