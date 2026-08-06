#!/usr/bin/env node
/**
 * SessionStart + UserPromptSubmit hook: reset the batched-verify sentinel at the
 * START of each turn.
 *
 * record-edits.js (PostToolUse) appends to .claude/.last-edits.json and the Stop
 * hooks (batch-typecheck/batch-test) consume it — batch-test deletes it at the
 * very end. If a Stop hook is killed mid-run (timeout) the sentinel survives and
 * the next turn re-runs typecheck/test on stale files, growing unbounded. Clearing
 * it here makes every turn start from a clean slate regardless of how the prior
 * Stop hook exited. Best-effort; never blocks.
 */

const { rmSync } = require("node:fs");
const path = require("node:path");

const SENTINEL = path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), ".claude", ".last-edits.json");

try {
  rmSync(SENTINEL, { force: true });
} catch {
  // Best-effort; never block on errors.
}
process.exit(0);
