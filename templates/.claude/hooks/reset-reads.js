#!/usr/bin/env node
/**
 * SessionStart hook: clear the per-session source-staleness ledger.
 *
 * record-reads.js (PostToolUse) records content hashes of observed files into
 * .claude/.last-reads.json and verify-sources.js (Stop) checks them at
 * turn-end. Unlike the batched-verify sentinel (.last-edits.json, reset per
 * TURN by reset-edits.js on SessionStart + UserPromptSubmit), this ledger is
 * per-SESSION: a file read early and summarized late must stay tracked, so it
 * is cleared ONLY at SessionStart, never on UserPromptSubmit. Best-effort;
 * never blocks.
 */

const { rmSync } = require("node:fs");
const path = require("node:path");

const SENTINEL = path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), ".claude", ".last-reads.json");

try {
  rmSync(SENTINEL, { force: true });
} catch {
  // Best-effort; never block on errors.
}
process.exit(0);
