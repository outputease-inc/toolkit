#!/usr/bin/env node
/**
 * Stop hook: run co-located bun tests for every TS file touched this turn.
 *
 * Reads .claude/.last-edits.json (newline-delimited paths written by
 * record-edits.js), and for each .ts/.tsx file finds a sibling
 * *.test.ts(x) (or, if the edited file IS a test file, runs it directly).
 * Failures are reported via additionalContext so Claude sees them.
 *
 * Deletes the sentinel at the end of every normal run — this hook runs
 * after batch-typecheck.js in the Stop hook array, so both have already
 * consumed the file list.
 *
 * On stop_hook_active (re-invocation), exits silently without touching
 * the sentinel to avoid loops.
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const MAX_INPUT = 10 * 1024;
const SENTINEL = path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), ".claude", ".last-edits.json");
const TS_EXTENSIONS = new Set([".ts", ".tsx"]);

let data = "";
const STDIN_TIMEOUT = setTimeout(() => process.exit(0), 4000);

process.stdin.on("data", (chunk) => {
  data += chunk;
  if (data.length > MAX_INPUT) {
    clearTimeout(STDIN_TIMEOUT);
    process.exit(0);
  }
});

function removeSentinel() {
  try {
    if (fs.existsSync(SENTINEL)) fs.unlinkSync(SENTINEL);
  } catch {
    // Best-effort.
  }
}

process.stdin.on("end", () => {
  clearTimeout(STDIN_TIMEOUT);

  let input = {};
  try {
    if (data) input = JSON.parse(data);
  } catch {
    // Treat parse failures as empty input; never block.
  }

  if (input.stop_hook_active) {
    // Re-invocation: do not consume or delete the sentinel.
    process.exit(0);
  }

  if (!fs.existsSync(SENTINEL)) process.exit(0);

  const testFiles = new Set();
  try {
    const raw = fs.readFileSync(SENTINEL, "utf8");
    for (const line of raw.split("\n")) {
      const normalized = line.replace(/\\/g, "/").trim();
      if (!normalized) continue;
      const lastDot = normalized.lastIndexOf(".");
      if (lastDot === -1) continue;
      const ext = normalized.substring(lastDot).toLowerCase();
      if (!TS_EXTENSIONS.has(ext)) continue;
      const stem = normalized.substring(0, lastDot);
      if (stem.endsWith(".test")) {
        testFiles.add(normalized);
        continue;
      }
      for (const candidate of [`${stem}.test.ts`, `${stem}.test.tsx`]) {
        if (fs.existsSync(candidate)) {
          testFiles.add(candidate);
          break;
        }
      }
    }
  } catch {
    // Read failure → no work, still clean up below.
  }

  const errors = [];
  // Bound total wall-clock under the Stop-hook harness timeout (settings.json)
  // even with many touched test files: shrink the per-test timeout to the
  // remaining budget instead of letting N*30s exceed it.
  const BUDGET_MS = 80000;
  const startedAt = Date.now();
  let skipped = 0;
  for (const testFile of testFiles) {
    const remaining = BUDGET_MS - (Date.now() - startedAt);
    if (remaining < 3000) {
      skipped += 1;
      continue;
    }
    try {
      execFileSync("bunx", ["bun", "test", testFile], {
        cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        timeout: Math.min(30000, remaining),
      });
    } catch (err) {
      const stdout = err.stdout ? err.stdout.toString() : "";
      const stderr = err.stderr ? err.stderr.toString() : "";
      const combined = (stdout + stderr).trim();
      if (combined) errors.push(`[${testFile}]\n${combined}`);
    }
  }

  if (skipped > 0) {
    errors.push(
      `[batched tests] time budget reached — ${skipped} test file(s) not run this turn; run \`bun run test\` to cover them.`,
    );
  }

  if (errors.length > 0) {
    const joined = errors.join("\n\n").substring(0, 4000);
    const output = JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "Stop",
        additionalContext: `[Batched tests] Test failures:\n${joined}`,
      },
    });
    process.stdout.write(output);
  }

  removeSentinel();
  process.exit(0);
});
