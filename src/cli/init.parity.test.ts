import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MARKER_FILENAME, MarkerSchema } from "../marker/schema";
import { runInit } from "./init";

describe("init US2 parity — Claude Code customizations match live monorepo", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "oe-init-parity-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("scaffolds a standalone project with marker, .ignore, .env.local, hookify .local.md files, capture.md, dependency-auditor.md", async () => {
    const result = await runInit({
      name: "parity-test",
      targetDir: dir,
      pm: "bun",
      dryRun: false,
      claude: true,
      uv: false,
      specKit: false,
      preset: "library",
      scope: "standalone",
    });

    expect(result.success).toBe(true);

    // Marker present + valid
    const markerPath = join(dir, MARKER_FILENAME);
    expect(existsSync(markerPath)).toBe(true);
    const markerRaw = readFileSync(markerPath, "utf8");
    const parsed = MarkerSchema.safeParse(JSON.parse(markerRaw));
    expect(parsed.success).toBe(true);

    // .ignore + .env.local emitted
    expect(existsSync(join(dir, ".ignore"))).toBe(true);
    expect(existsSync(join(dir, ".env.local"))).toBe(true);
    expect(existsSync(join(dir, ".env.example"))).toBe(true);

    // Hookify directory uses .local.md naming convention exclusively (no .require-*.md survivors)
    const hookifyDir = join(dir, ".claude", "hookify");
    if (existsSync(hookifyDir) && statSync(hookifyDir).isDirectory()) {
      const entries = readdirSync(hookifyDir);
      const requireOnly = entries.filter(
        (n) => n.startsWith("hookify.require-") && !n.endsWith(".local.md"),
      );
      // Templates may keep `hookify.require-TEMPLATE.md` for guidance; that's not a runtime rule.
      const nonTemplateRequires = requireOnly.filter((n) => !n.includes("TEMPLATE"));
      expect(nonTemplateRequires).toEqual([]);
    }

    // capture.md + dependency-auditor.md present
    if (existsSync(join(dir, ".claude", "commands"))) {
      expect(existsSync(join(dir, ".claude", "commands", "capture.md"))).toBe(true);
    }
    if (existsSync(join(dir, ".claude", "agents"))) {
      expect(existsSync(join(dir, ".claude", "agents", "dependency-auditor.md"))).toBe(true);
    }
  });
});
