/**
 * Validator -- Phase 6 of the setup pipeline.
 *
 * Post-setup validation checks. Extends the logic from verify-setup.js
 * to cover config completeness, feature flag consistency, hookify state,
 * settings.local.json, MCP config, and pruned file consistency.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolkitConfig } from "./config-loader";
import { REQUIRED_FIELDS } from "./config-loader";
import { FILE_MANIFEST } from "./file-manifest";
import { getNestedValue, readFileSafe } from "./utils";

// ---- Types ------------------------------------------------------------------

/** Status of a single validation check. */
export type ValidationStatus = "pass" | "warn" | "fail";

/** A single validation check result. */
export interface ValidationCheckResult {
  label: string;
  status: ValidationStatus;
  message?: string;
}

/** Aggregate result of all validation checks. */
export interface ValidationResult {
  passed: number;
  failed: number;
  warnings: number;
  results: ValidationCheckResult[];
}

/**
 * Run all validation checks.
 * @param root - toolkit root directory
 * @param config - parsed config object
 */
export function validate(root: string, config: ToolkitConfig): ValidationResult {
  const results: ValidationCheckResult[] = [];
  let passed = 0;
  let failed = 0;
  let warnings = 0;

  // biome-ignore lint/suspicious/noConfusingVoidType: void is correct — pass callbacks return nothing
  function check(label: string, fn: () => string | void): void {
    try {
      const result = fn();
      if (typeof result === "string") {
        results.push({ label, status: "warn", message: result });
        warnings++;
      } else {
        results.push({ label, status: "pass" });
        passed++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ label, status: "fail", message });
      failed++;
    }
  }

  // 1. Config completeness
  for (const field of REQUIRED_FIELDS) {
    check(`Config: ${field} is set`, () => {
      const val = getNestedValue(config as unknown as Record<string, unknown>, field);
      if (!val || (typeof val === "string" && val.trim() === "")) {
        throw new Error(`Required field "${field}" is empty`);
      }
    });
  }

  // 2. JSON file validity
  const jsonFiles = [".claude/settings.json", "toolkit.config.json"];
  if (fs.existsSync(path.join(root, ".claude/settings.local.json"))) {
    jsonFiles.push(".claude/settings.local.json");
  }

  for (const file of jsonFiles) {
    check(`${file} is valid JSON`, () => {
      const content = fs.readFileSync(path.join(root, file), "utf8");
      JSON.parse(content);
    });
  }

  // 3. Feature flag consistency.
  // Only a MISSING required file is an error. A disabled feature's files are
  // allowed to exist: the 0.2.0 Eta scaffolder copies docs/ wholesale (the
  // legacy prune phase was removed), so asserting "should have been pruned"
  // produced guaranteed false FAILs on the default OutputEase doc set.
  for (const [flag, files] of Object.entries(FILE_MANIFEST)) {
    const featureEnabled = config.features[flag];
    for (const relPath of files) {
      const exists = fs.existsSync(path.join(root, relPath));
      if (featureEnabled && !exists) {
        check(`Feature flag: ${relPath}`, () => {
          throw new Error(`${flag} is true but ${relPath} is missing`);
        });
      } else {
        check(`Feature flag: ${relPath}`, () => {});
      }
    }
  }

  // 4. Hookify state -- enabled rules should have no placeholder tokens
  const claudeDir = path.join(root, ".claude");
  let hookifyFiles: string[] = [];
  try {
    hookifyFiles = fs
      .readdirSync(claudeDir)
      .filter((f) => f.startsWith("hookify.") && f.endsWith(".md"));
  } catch {
    // Directory may not exist
  }

  for (const file of hookifyFiles) {
    check(`.claude/${file} placeholder check`, () => {
      const content = readFileSafe(path.join(claudeDir, file));
      if (!content) return;
      const matches = content.match(/\[[A-Z][A-Z0-9_]*\]/g);
      if (matches && /enabled:\s*true/i.test(content)) {
        throw new Error(
          `Enabled rule has unfilled placeholders: ${[...new Set(matches)].join(", ")}`,
        );
      }
      if (matches) {
        return `Unfilled placeholders in disabled rule: ${[...new Set(matches)].join(", ")}`;
      }
    });
  }

  // 5. settings.local.json exists if formatter was configured
  if (config.commands.formatter) {
    check("settings.local.json exists (formatter configured)", () => {
      if (!fs.existsSync(path.join(root, ".claude/settings.local.json"))) {
        throw new Error(
          "commands.formatter is set but .claude/settings.local.json was not generated",
        );
      }
    });
  }

  // 6. MCP config -- no REPLACE strings remaining
  check(".mcp.json has no REPLACE tokens", () => {
    const content = readFileSafe(path.join(root, ".mcp.json"));
    if (!content) return;
    if (content.includes("REPLACE-OR-REMOVE")) {
      throw new Error("Found 'REPLACE-OR-REMOVE' in .mcp.json -- run setup to resolve");
    }
  });

  // 7. Critical files have no unfilled placeholders
  const criticalFiles = [".claude/settings.json"];
  for (const file of criticalFiles) {
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath)) continue;
    check(`${file} has no unfilled placeholders`, () => {
      const content = fs.readFileSync(fullPath, "utf8");
      const matches = content.match(/\[[A-Z][A-Z0-9_]*\]/g);
      if (matches) {
        throw new Error(`Found: ${[...new Set(matches)].join(", ")}`);
      }
    });
  }

  // 8. Required files exist
  const requiredFiles = [
    "CLAUDE.md",
    ".gitattributes",
    ".editorconfig",
    ".gitignore",
    "README.md",
    "SETUP.md",
    "INDEX.md",
    "LICENSE",
    ".claude/settings.json",
    ".claude/hooks/protect-sensitive.js",
  ];

  for (const file of requiredFiles) {
    check(`${file} exists`, () => {
      if (!fs.existsSync(path.join(root, file))) {
        throw new Error(`Missing required file: ${file}`);
      }
    });
  }

  return { passed, failed, warnings, results };
}
