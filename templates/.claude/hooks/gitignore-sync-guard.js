#!/usr/bin/env node
/**
 * PostToolUse hook: Guard the .gitignore <-> sync-templates exclude mirror.
 *
 * Invariant (CLAUDE.md gotcha "Gitignore <-> sync-templates EXCLUDE_REL_POSIX must
 * mirror"; incident 2026-05-26, commit c800006): every root .gitignore line that
 * ignores a concrete `.claude/` or `.specify/` path MUST have a matching entry in
 * EXCLUDE_REL_POSIX (exact relpaths) or EXCLUDE_PREFIX_POSIX (dir prefixes with a
 * trailing slash) in packages/toolkit/scripts/sync-templates.ts. The gitignore rule
 * only prevents tracking at the repo root; sync-templates copies into
 * packages/toolkit/templates/ where the rule does not apply, and release.yml's
 * autosync-templates job auto-commits synced templates to main -- so a missing
 * exclude auto-commits the leaked ephemeral file.
 *
 * Directional: gitignore -> exclude only (extra excludes without gitignore lines
 * are fine). Wildcard lines (any `*`) are skipped entirely: they are name patterns,
 * not concrete relpaths, so they have no single canonical exclude entry (e.g. the
 * double-star `scheduled_tasks.lock` glob line is already covered by the concrete
 * `.claude/scheduled_tasks.lock` exclude). Comments and `!` negations are skipped.
 *
 * Downstream-safe: silently no-ops when packages/toolkit/scripts/sync-templates.ts
 * is absent (scaffolded projects have no templates mirror to guard).
 *
 * Exit codes:
 *   0 = allow (always -- warn-only hook, fail-open on any error)
 *
 * Returns additionalContext listing each missing exclude for Claude to self-correct.
 */

const fs = require("node:fs");
const path = require("node:path");

const MAX_INPUT = 10 * 1024; // 10 KB

const SYNC_TEMPLATES_REL = path.join("packages", "toolkit", "scripts", "sync-templates.ts");

/**
 * Map a raw .gitignore line to a concrete .claude/ or .specify/ candidate relpath,
 * or null when the line is out of scope (comment, negation, wildcard, other paths).
 */
function candidateFromLine(rawLine) {
  let line = rawLine.trim();
  if (line === "" || line.startsWith("#") || line.startsWith("!")) return null;
  if (line.startsWith("/")) line = line.slice(1); // root-anchored spelling
  if (!line.startsWith(".claude/") && !line.startsWith(".specify/")) return null;
  if (line.includes("*")) return null; // name patterns have no canonical exclude entry
  return line;
}

/**
 * Textual containment check: each candidate must appear as a double-quoted string
 * anywhere in sync-templates.ts. Deliberately NOT a TS parse -- the exclude lists
 * are plain string literals, and this stays dependency-free and fail-open.
 */
function collectMissingExcludes(gitignoreText, syncText) {
  const missing = [];
  const seen = new Set();
  for (const rawLine of gitignoreText.split("\n")) {
    const candidate = candidateFromLine(rawLine);
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    if (syncText.includes(`"${candidate}"`)) continue;
    const target = candidate.endsWith("/")
      ? "EXCLUDE_PREFIX_POSIX (dir prefix -- keep the trailing slash)"
      : "EXCLUDE_REL_POSIX (exact relpath)";
    missing.push(`  - "${candidate}" -> add to ${target}`);
  }
  return missing;
}

function isRepoRootGitignore(filePath) {
  const normalized = path.resolve(filePath).replace(/\\/g, "/");
  if (!normalized.endsWith("/.gitignore")) return false;
  const rootGitignore = path.resolve(process.cwd(), ".gitignore").replace(/\\/g, "/");
  if (process.platform === "win32") {
    return normalized.toLowerCase() === rootGitignore.toLowerCase();
  }
  return normalized === rootGitignore;
}

let data = "";
const STDIN_TIMEOUT = setTimeout(() => {
  process.exit(0);
}, 4000);

process.stdin.on("data", (chunk) => {
  data += chunk;
  if (data.length > MAX_INPUT) {
    clearTimeout(STDIN_TIMEOUT);
    process.exit(0);
  }
});

process.stdin.on("end", () => {
  clearTimeout(STDIN_TIMEOUT);
  try {
    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path;
    if (!filePath || typeof filePath !== "string") process.exit(0);
    if (!isRepoRootGitignore(filePath)) process.exit(0);

    // Downstream scaffolds have no templates mirror to guard -- silent no-op.
    const syncTemplatesPath = path.join(process.cwd(), SYNC_TEMPLATES_REL);
    if (!fs.existsSync(syncTemplatesPath)) process.exit(0);

    // PostToolUse: the edit has landed, so disk holds the post-edit .gitignore.
    const gitignoreText = fs.readFileSync(path.resolve(filePath), "utf8");
    const syncText = fs.readFileSync(syncTemplatesPath, "utf8");
    const missing = collectMissingExcludes(gitignoreText, syncText);

    if (missing.length > 0) {
      const result = {
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext:
            "WARNING: .gitignore <-> sync-templates exclude mirror drift detected.\n" +
            "These root .gitignore entries ignore concrete .claude/ or .specify/ paths " +
            "but have no matching quoted entry in packages/toolkit/scripts/sync-templates.ts:\n" +
            missing.join("\n") +
            '\n\nPer the CLAUDE.md gotcha "Gitignore <-> sync-templates EXCLUDE_REL_POSIX ' +
            'must mirror" (incident 2026-05-26, commit c800006): the gitignore rule only ' +
            "prevents tracking at the repo root; sync-templates still copies the path into " +
            "packages/toolkit/templates/, and release.yml's autosync-templates then " +
            "auto-commits the leaked file to main. Add each path above to the indicated " +
            "list in packages/toolkit/scripts/sync-templates.ts, then re-run " +
            "`bun run --filter=@outputease/toolkit sync:templates` and verify with " +
            "`bun run packages/toolkit/scripts/sync-check.ts`.",
        },
      };
      process.stdout.write(JSON.stringify(result));
    }
  } catch {
    // Warn-only: any parse/read failure allows the operation (fail-open).
  }
  process.exit(0);
});
