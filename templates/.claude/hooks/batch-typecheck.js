#!/usr/bin/env node
/**
 * Stop hook: run scoped typecheck on every package touched this turn.
 *
 * Reads .claude/.last-edits.json (newline-delimited paths written by
 * record-edits.js), derives the unique set of affected workspace packages,
 * and runs `turbo run typecheck --filter=./<pkg>` for each. Errors are
 * reported via additionalContext so Claude can see them and respond.
 *
 * Routed through turbo, not through bare `tsc`, so this hook and `/dev-check`
 * (which runs `bun run typecheck` == `turbo run typecheck`) share one cache
 * instead of paying the same work twice (spec 010, finding B3). The cache IS
 * the artifact linking them: whichever runs first pays, the other replays.
 * Measured on apps/web, 2026-07-27 — 7.73 s bare tsc, 0.15 s on a turbo cache
 * hit, 7.76 s on a miss. `typecheck` declares `dependsOn: ["^build"]`, which
 * resolves to no additional task for a workspace app, so a miss costs what the
 * bare invocation cost and never triggers a build chain inside a Stop hook.
 *
 * Does NOT delete the sentinel — batch-test.js cleans up after the test
 * pass so both Stop hooks see the same file list. Stop hooks run
 * sequentially in array order in settings.json.
 *
 * On stop_hook_active (re-invocation), exits silently to avoid loops.
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const MAX_INPUT = 10 * 1024;
const SENTINEL = path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), ".claude", ".last-edits.json");
const TS_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);

let data = "";
const STDIN_TIMEOUT = setTimeout(() => process.exit(0), 4000);

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
    const input = data ? JSON.parse(data) : {};
    if (input.stop_hook_active) process.exit(0);
    if (!fs.existsSync(SENTINEL)) process.exit(0);

    const raw = fs.readFileSync(SENTINEL, "utf8");
    const packages = new Set();
    for (const line of raw.split("\n")) {
      const normalized = line.replace(/\\/g, "/").trim();
      if (!normalized) continue;
      const lastDot = normalized.lastIndexOf(".");
      if (lastDot === -1) continue;
      const ext = normalized.substring(lastDot).toLowerCase();
      if (!TS_EXTENSIONS.has(ext)) continue;
      const match = normalized.match(/\/(packages|apps)\/([^/]+)\//);
      if (!match) continue;
      packages.add(`${match[1]}/${match[2]}`);
    }

    if (packages.size === 0) process.exit(0);

    const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const errors = [];

    // Stay under the Stop-hook harness timeout (settings.json) even when many
    // packages are touched: bound total wall-clock and shrink the per-package
    // timeout to the remaining budget instead of letting N*45s exceed it.
    const BUDGET_MS = 110000;
    const startedAt = Date.now();
    let skipped = 0;

    for (const pkg of packages) {
      const remaining = BUDGET_MS - (Date.now() - startedAt);
      if (remaining < 5000) {
        skipped += 1;
        continue;
      }
      const tsconfigRelative = `${pkg}/tsconfig.json`;
      const tsconfigAbsolute = path.join(cwd, tsconfigRelative);
      if (!fs.existsSync(tsconfigAbsolute)) continue;

      try {
        execFileSync(
          "bunx",
          ["turbo", "run", "typecheck", `--filter=./${pkg}`, "--output-logs=errors-only"],
          {
            cwd,
            stdio: ["ignore", "pipe", "pipe"],
            timeout: Math.min(45000, remaining),
          },
        );
      } catch (err) {
        const stdout = err.stdout ? err.stdout.toString() : "";
        const stderr = err.stderr ? err.stderr.toString() : "";
        const combined = (stdout + stderr).trim();
        if (combined) errors.push(`[${pkg}]\n${combined}`);
      }
    }

    if (skipped > 0) {
      errors.push(
        `[batched typecheck] time budget reached — ${skipped} package(s) not checked this turn; run \`bun run typecheck\` to cover them.`,
      );
    }

    if (errors.length > 0) {
      const joined = errors.join("\n\n").substring(0, 4000);
      const output = JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "Stop",
          additionalContext: `[Batched typecheck] TypeScript errors:\n${joined}`,
        },
      });
      process.stdout.write(output);
    }
  } catch {
    // Best-effort; never block on errors.
  }
  process.exit(0);
});
