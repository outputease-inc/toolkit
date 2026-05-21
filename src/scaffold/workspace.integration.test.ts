import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../cli/init";

describe("workspace scaffolding integration", () => {
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "oe-ws-int-"));
    tempDirs.push(dir);
    return dir;
  }

  function createTurborepoWorkspace(dir: string): void {
    writeFileSync(
      join(dir, "turbo.json"),
      JSON.stringify({ $schema: "https://turbo.build/schema.json", tasks: {} }, null, 2),
    );
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify(
        {
          name: "test-monorepo",
          private: true,
          workspaces: ["apps/*", "packages/*"],
        },
        null,
        2,
      ),
    );
    mkdirSync(join(dir, "apps"), { recursive: true });
    mkdirSync(join(dir, "packages"), { recursive: true });
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("scaffolds an app into apps/ in a Turborepo workspace", async () => {
    const dir = createTempDir();
    createTurborepoWorkspace(dir);

    const appDir = join(dir, "apps", "my-web-app");
    const result = await runInit({
      name: "my-web-app",
      targetDir: appDir,
      preset: "web-app",
      pm: "bun",
      dryRun: false,
      claude: false,
      uv: false,
      specKit: false,
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(appDir, "package.json"))).toBe(true);
    expect(existsSync(join(appDir, "app", "page.tsx"))).toBe(true);

    // Verify the app's package.json exists and has a name
    const pkg = JSON.parse(readFileSync(join(appDir, "package.json"), "utf-8"));
    expect(pkg.name).toBe("my-web-app");
  });
});
