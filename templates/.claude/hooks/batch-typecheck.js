#!/usr/bin/env node
/**
 * Stop hook: run scoped typecheck on every package touched this turn.
 *
 * Reads .claude/.last-edits.json (newline-delimited paths written by
 * record-edits.js), derives the unique set of affected workspace packages,
 * and runs `bunx tsc --noEmit -p <pkg>/tsconfig.json` for each. Errors are
 * reported via additionalContext so Claude can see them and respond.
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
const SENTINEL = path.join(process.cwd(), ".claude", ".last-edits.json");
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

    const cwd = process.cwd();
    const errors = [];

    for (const pkg of packages) {
      const tsconfigRelative = `${pkg}/tsconfig.json`;
      const tsconfigAbsolute = path.join(cwd, tsconfigRelative);
      if (!fs.existsSync(tsconfigAbsolute)) continue;

      try {
        execFileSync("bunx", ["tsc", "--noEmit", "--pretty", "--project", tsconfigRelative], {
          cwd,
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 45000,
        });
      } catch (err) {
        const stdout = err.stdout ? err.stdout.toString() : "";
        const stderr = err.stderr ? err.stderr.toString() : "";
        const combined = (stdout + stderr).trim();
        if (combined) errors.push(`[${pkg}]\n${combined}`);
      }
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
