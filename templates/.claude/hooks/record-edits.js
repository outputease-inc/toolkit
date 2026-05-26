#!/usr/bin/env node
/**
 * PostToolUse hook: append edited file path to .claude/.last-edits.json
 * so the batched Stop hooks can run typecheck/test on the union of touched
 * files at turn-end (instead of cascading on every edit).
 *
 * Storage: newline-delimited absolute paths. Atomic via appendFileSync for
 * any single path < PIPE_BUF.
 *
 * Exits 0 on every code path; this hook is best-effort and must not block.
 */

const { appendFileSync } = require("node:fs");
const path = require("node:path");

const MAX_INPUT = 10 * 1024;
const SENTINEL = path.join(process.cwd(), ".claude", ".last-edits.json");

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
    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path;
    if (!filePath || typeof filePath !== "string") process.exit(0);
    appendFileSync(SENTINEL, `${filePath}\n`);
  } catch {
    // Best-effort; never block on errors.
  }
  process.exit(0);
});
