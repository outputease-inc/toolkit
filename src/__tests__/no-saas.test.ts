import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOLKIT_ROOT = join(__dirname, "..", "..");

const SCAN_ROOTS = [
  join(TOOLKIT_ROOT, "src"),
  join(TOOLKIT_ROOT, "templates"),
  join(TOOLKIT_ROOT, "README.md"),
];

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".md", ".json"]);

/**
 * Paths excluded from the SaaS-free invariant:
 *  - tests (`*.test.ts`) — may reference legacy preset names in transitional fixtures
 *  - `__tests__` directories
 *  - this file itself (it literally contains the string "saas" in the rule)
 */
const EXCLUDE_PATH_RE = /(\.test\.ts$|__tests__|no-saas\.test\.ts$|\.turbo\b)/;

const SAAS_RE = /\bsaas\b/i;

function walk(rootPath: string, files: string[]): void {
  let info: ReturnType<typeof statSync>;
  try {
    info = statSync(rootPath);
  } catch {
    return;
  }
  if (info.isFile()) {
    files.push(rootPath);
    return;
  }
  if (!info.isDirectory()) {
    return;
  }
  for (const entry of readdirSync(rootPath)) {
    const abs = join(rootPath, entry);
    walk(abs, files);
  }
}

describe("SaaS-free invariant (SC-008, FR-005)", () => {
  test("no user-facing surface contains the string 'saas' (case-insensitive)", () => {
    const files: string[] = [];
    for (const root of SCAN_ROOTS) {
      walk(root, files);
    }

    const matches: { file: string; line: number; text: string }[] = [];
    for (const file of files) {
      const rel = relative(TOOLKIT_ROOT, file);
      if (EXCLUDE_PATH_RE.test(rel)) {
        continue;
      }
      const ext = file.slice(file.lastIndexOf("."));
      if (!SCAN_EXTENSIONS.has(ext)) {
        continue;
      }
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i += 1) {
        if (SAAS_RE.test(lines[i] ?? "")) {
          matches.push({ file: rel, line: i + 1, text: (lines[i] ?? "").trim() });
        }
      }
    }

    if (matches.length > 0) {
      const detail = matches.map((m) => `  ${m.file}:${m.line}  ${m.text}`).join("\n");
      throw new Error(`Found ${matches.length} user-facing 'SaaS' reference(s):\n${detail}`);
    }
    expect(matches).toEqual([]);
  });
});
