import * as fs from "node:fs";
import * as path from "node:path";
import type { PlaceholderRegistry } from "../schema/registry";
import { PLACEHOLDER_REGISTRY } from "../schema/registry";

/**
 * Scans toolkit template files for placeholder tokens and validates them against
 * the placeholder registry. Also detects hardcoded framework-specific terms.
 */

/** Files to skip (engine code, config, templates) */
const SKIP_FILES = new Set([
  "setup-placeholders.js",
  "verify-setup.js",
  "toolkit.config.json",
  "_TEMPLATE.md",
  "auto-format.js.example",
]);

/** Directories to skip (engine code, not template files) */
const SKIP_DIRS = new Set(["node_modules", ".git", "lib"]);

/** A file extension pattern for lintable files */
const LINTABLE_EXT = /\.(md|js|json|ts|yaml|yml|toml|example|env)$/;

/** Doc-level files that auto-allow any UPPER_SNAKE token */
const DOC_FILE_PATTERN =
  /^(docs\/|CLAUDE\.md|README\.md|CONTRIBUTING\.md|CHANGELOG\.md|SECURITY\.md|HANDOFF\.md|INDEX\.md|TODO\.md|SETUP\.md)/;

interface FileLocation {
  file: string;
  line: number;
}

interface BlocklistHit {
  file: string;
  line: number;
  text: string;
}

export interface LintResult {
  unregistered: Record<string, FileLocation[]>;
  blocklistHits: Record<string, BlocklistHit[]>;
  hasIssues: boolean;
}

interface LoadedRegistry {
  tokens: Set<string>;
  blocklist: string[];
  nonTokens: Set<string>;
}

interface FileInfo {
  relative: string;
  absolute: string;
}

function loadRegistryFromData(registry: PlaceholderRegistry): LoadedRegistry {
  const allTokens = new Set<string>();
  for (const category of Object.values(registry.categories)) {
    for (const tokenName of Object.keys(category.tokens)) {
      allTokens.add(tokenName);
    }
  }

  const nonTokenLiterals = new Set<string>(registry.known_non_tokens?.literals ?? []);

  return {
    tokens: allTokens,
    blocklist: registry.framework_terms_blocklist ?? [],
    nonTokens: nonTokenLiterals,
  };
}

function loadRegistryFromFile(registryPath: string): LoadedRegistry {
  const raw = fs.readFileSync(registryPath, "utf-8");
  const registry = JSON.parse(raw) as PlaceholderRegistry;
  return loadRegistryFromData(registry);
}

function getFiles(dir: string, prefix = ""): FileInfo[] {
  const files: FileInfo[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...getFiles(path.join(dir, entry.name), relativePath));
    } else if (LINTABLE_EXT.test(entry.name)) {
      if (!SKIP_FILES.has(entry.name)) {
        files.push({
          relative: relativePath,
          absolute: path.join(dir, entry.name),
        });
      }
    }
  }
  return files;
}

function findAllMatches(text: string): string[] {
  const regex = /\[([A-Z][A-Z0-9_, ]*)\]/g;
  const results: string[] = [];
  for (const m of text.matchAll(regex)) {
    if (m[1]) results.push(m[1]);
  }
  return results;
}

/**
 * Lint placeholder tokens in the toolkit templates directory.
 *
 * @param kitPath - Absolute path to the toolkit templates directory
 * @param registryPath - Optional path to a JSON registry file.
 *   When omitted, uses the built-in PLACEHOLDER_REGISTRY.
 * @returns LintResult with unregistered tokens and blocklist hits
 */
export function lintPlaceholders(kitPath: string, registryPath?: string): LintResult {
  const { tokens, blocklist, nonTokens } = registryPath
    ? loadRegistryFromFile(registryPath)
    : loadRegistryFromData(PLACEHOLDER_REGISTRY);

  const files = getFiles(kitPath);
  const unregistered: Record<string, FileLocation[]> = {};
  const blocklistHits: Record<string, BlocklistHit[]> = {};

  for (const fileInfo of files) {
    const content = fs.readFileSync(fileInfo.absolute, "utf-8");
    const lines = content.split("\n");

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (!line) continue;

      for (const rawToken of findAllMatches(line)) {
        const token = rawToken.trim();
        if (/^[A-Z]{1,2}$/.test(token)) continue;
        if (nonTokens.has(token)) continue;

        if (!tokens.has(token)) {
          const isDocFile = DOC_FILE_PATTERN.test(fileInfo.relative);
          const isCmdReadme = fileInfo.relative === ".claude/commands/README.md";
          if (isDocFile || isCmdReadme) continue;

          if (!unregistered[token]) unregistered[token] = [];
          unregistered[token].push({
            file: fileInfo.relative,
            line: li + 1,
          });
        }
      }

      const isExampleCtx = /e\.g\.,|Examples?:|for example|such as|\([A-Z][a-z]+,\s/i.test(line);
      if (!isExampleCtx) {
        for (const term of blocklist) {
          if (line.indexOf(term) !== -1) {
            const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            if (new RegExp(`\\[[^\\]]*${escaped}[^\\]]*\\]`).test(line)) {
              continue;
            }

            if (!blocklistHits[term]) blocklistHits[term] = [];
            blocklistHits[term].push({
              file: fileInfo.relative,
              line: li + 1,
              text: line.trim().substring(0, 80),
            });
          }
        }
      }
    }
  }

  const hasIssues = Object.keys(unregistered).length > 0 || Object.keys(blocklistHits).length > 0;

  return { unregistered, blocklistHits, hasIssues };
}

/** Print a human-readable report to stdout. */
function printReport(result: LintResult): void {
  console.log("=== Placeholder Lint Report ===\n");

  const unregKeys = Object.keys(result.unregistered).sort();
  const hitKeys = Object.keys(result.blocklistHits).sort();

  if (unregKeys.length > 0) {
    console.log(`UNREGISTERED PLACEHOLDERS (${unregKeys.length} tokens):`);
    for (const uToken of unregKeys) {
      const locations = result.unregistered[uToken];
      if (!locations) continue;
      const fileList = locations
        .slice(0, 3)
        .map((l) => `${l.file}:${l.line}`)
        .join(", ");
      const more = locations.length > 3 ? ` (+${locations.length - 3} more)` : "";
      console.log(`  [${uToken}] -> ${fileList}${more}`);
    }
    console.log();
  }

  if (hitKeys.length > 0) {
    console.log(`FRAMEWORK-SPECIFIC TERMS DETECTED (${hitKeys.length} terms):`);
    for (const hTerm of hitKeys) {
      const hits = result.blocklistHits[hTerm];
      if (!hits) continue;
      console.log(`  "${hTerm}" (${hits.length} occurrences):`);
      for (let hi = 0; hi < Math.min(hits.length, 3); hi++) {
        const hit = hits[hi];
        if (!hit) continue;
        console.log(`    ${hit.file}:${hit.line} | ${hit.text}`);
      }
      if (hits.length > 3) {
        console.log(`    (+${hits.length - 3} more)`);
      }
    }
    console.log();
  }

  if (!result.hasIssues) {
    console.log("OK: All placeholders registered, no framework-specific terms detected.");
  } else {
    console.log(
      "ACTION NEEDED: Register new placeholders in placeholder-registry.json " +
        "and/or replace framework-specific terms with placeholders.",
    );
  }
}

// CLI mode
if (import.meta.main) {
  const kitPath = process.argv[2] ?? path.resolve(process.cwd(), "..", "toolkit");
  const registryPath = process.argv[3];

  const result = lintPlaceholders(kitPath, registryPath);
  printReport(result);
  process.exit(result.hasIssues ? 1 : 0);
}
