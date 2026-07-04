#!/usr/bin/env node
/**
 * PreToolUse hook: Warn when DB migration/schema files are edited on main/master.
 *
 * Policy (CLAUDE.md "Branch & Commit Workflow", PR trigger 2): DB schema migrations
 * require a PR -- any change under packages/db/migrations/ or new Drizzle schema
 * files. Data integrity warrants review, so these edits belong on a feature branch,
 * never directly on the default branch.
 *
 * Guarded path segments: packages/db/migrations/ (the CLAUDE.md wording),
 * packages/db/src/migrations/ (where drizzle.config.ts `out: "./src/migrations"`
 * actually writes generated migrations), and packages/db/src/schema/ (Drizzle
 * schema sources).
 *
 * Branch detection reads .git/HEAD directly -- no git subprocess. A worktree
 * `.git` FILE (`gitdir: <path>`) is followed exactly once. Detached HEAD, missing
 * .git, or any read failure resolves to "unknown" and the hook stays silent
 * (fail-open). Downstream-safe by construction: projects without packages/db/
 * never match the guarded paths.
 *
 * Exit codes:
 *   0 = allow (always -- warn-only hook, never blocks)
 *
 * Returns additionalContext telling Claude to switch to a feature branch + PR.
 */

const fs = require("node:fs");
const path = require("node:path");

const MAX_INPUT = 10 * 1024; // 10 KB

const GUARDED_SEGMENTS = [
  "/packages/db/migrations/",
  "/packages/db/src/migrations/",
  "/packages/db/src/schema/",
];

const DEFAULT_BRANCHES = new Set(["main", "master"]);

/**
 * Resolve the checked-out branch by reading .git/HEAD without spawning git.
 * Follows a single worktree `gitdir:` pointer. Returns null for detached HEAD
 * or on any failure (callers treat null as "unknown" and stay silent).
 */
function currentBranch(cwd) {
  try {
    let gitPath = path.join(cwd, ".git");
    if (!fs.existsSync(gitPath)) return null;
    if (fs.statSync(gitPath).isFile()) {
      const pointer = fs.readFileSync(gitPath, "utf8").trim();
      if (!pointer.startsWith("gitdir:")) return null;
      gitPath = path.resolve(cwd, pointer.slice("gitdir:".length).trim());
    }
    const head = fs.readFileSync(path.join(gitPath, "HEAD"), "utf8").trim();
    if (!head.startsWith("ref: refs/heads/")) return null;
    return head.slice("ref: refs/heads/".length);
  } catch {
    return null;
  }
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

    const normalized = filePath.replace(/\\/g, "/");
    // Leading slash so relative paths ("packages/db/...") match the segments too.
    const probe = normalized.startsWith("/") ? normalized : `/${normalized}`;
    if (!GUARDED_SEGMENTS.some((segment) => probe.includes(segment))) process.exit(0);

    const branch = currentBranch(process.cwd());
    if (!branch || !DEFAULT_BRANCHES.has(branch)) process.exit(0);

    const result = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext:
          `WARNING: DB migration/schema change on branch "${branch}": ${normalized}\n` +
          "CLAUDE.md Branch & Commit Workflow (PR trigger 2) requires a PR for DB schema " +
          "migrations -- any change under packages/db/migrations/ or new Drizzle schema " +
          "files. Data integrity warrants review. Create a feature branch first (prefixes " +
          "per CONTRIBUTING.md: feat/, fix/, chore/, security/, a11y/) and open a PR " +
          `instead of editing directly on ${branch}.`,
      },
    };
    process.stdout.write(JSON.stringify(result));
  } catch {
    // Warn-only: any parse failure allows the operation (fail-open).
  }
  process.exit(0);
});
