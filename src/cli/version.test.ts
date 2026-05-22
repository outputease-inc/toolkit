import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pkg from "../../package.json" with { type: "json" };

/**
 * Pins the toolkit CLI's reported version to `package.json`.
 * Catches the prior drift bug where `index.ts` hardcoded `"0.0.1"` while
 * the package version had been bumped.
 */
describe("CLI version", () => {
  it("package.json declares a valid semver", () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("index.ts reads the version from package.json (no hardcoded literal)", () => {
    const cliSource = readFileSync(join(import.meta.dir, "index.ts"), "utf-8");
    expect(cliSource).toContain('import pkg from "../../package.json"');
    expect(cliSource).toContain(".version(pkg.version)");
    expect(cliSource).not.toMatch(/\.version\(\s*"\d+\.\d+\.\d+"\s*\)/);
  });

  it("init action uses the same package.json version for the banner", () => {
    const actionSource = readFileSync(join(import.meta.dir, "commands/init/action.ts"), "utf-8");
    expect(actionSource).toContain('import pkg from "../../../../package.json"');
    expect(actionSource).toContain("version: pkg.version");
    expect(actionSource).not.toMatch(/version:\s*"\d+\.\d+\.\d+"/);
  });
});
