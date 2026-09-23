#!/usr/bin/env node
/**
 * SessionStart hook: manage the per-session source-staleness ledgers.
 *
 * record-reads.js (PostToolUse) records content hashes of observed files into
 * .claude/.last-reads/<session_id>.json and verify-sources.js (Stop) checks them at
 * turn-end. Unlike the batched-verify sentinel (.last-edits.json, reset per TURN by
 * reset-edits.js), this ledger is per-SESSION: a file read early and summarized late
 * must stay tracked. So, by SessionStart source:
 *   resume, compact              -> keep this session's ledger: the context, or a
 *                                   summary of it, still relies on those reads;
 *   startup, clear, fork, other  -> delete this session's ledger (a fresh context).
 * Then it deletes other sessions' ledgers not modified in 7 days, and the legacy
 * single-file ledger .claude/.last-reads.json, whatever the source.
 *
 * ledgerPath() must stay identical in record-reads.js and verify-sources.js (twin
 * test in source-staleness.test.ts). Writes nothing to stdout: SessionStart stdout
 * is injected into the model's context. Best-effort; exits 0 on every path.
 */

const fs = require("node:fs");
const path = require("node:path");

const MAX_INPUT = 1024 * 1024; // 1 MB, like the other ledger hooks
const CLAUDE_DIR = path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), ".claude");
const LEDGER_DIR = path.join(CLAUDE_DIR, ".last-reads");
const LEGACY_LEDGER = path.join(CLAUDE_DIR, ".last-reads.json");
const SESSION_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const KEEP_SOURCES = new Set(["resume", "compact"]);
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

function ledgerPath(sessionId) {
  const id = typeof sessionId === "string" && SESSION_ID_RE.test(sessionId) ? sessionId : "default";
  return path.join(LEDGER_DIR, `${id}.json`);
}

let data = "";
let finished = false;
// finish() is a hoisted function declaration, so the timer can name it here.
const STDIN_TIMEOUT = setTimeout(finish, 4000);

function finish() {
  if (finished) return;
  finished = true;
  clearTimeout(STDIN_TIMEOUT);

  let input = {};
  try {
    const parsed = data ? JSON.parse(data) : {};
    if (parsed && typeof parsed === "object") input = parsed;
  } catch {
    // Unparsable input: a fresh context with no id, so the default ledger.
  }

  const own = ledgerPath(input.session_id);
  if (!KEEP_SOURCES.has(input.source)) {
    try {
      fs.rmSync(own, { force: true });
    } catch {
      // Best-effort.
    }
  }

  try {
    const cutoff = Date.now() - STALE_MS;
    for (const name of fs.readdirSync(LEDGER_DIR)) {
      const file = path.join(LEDGER_DIR, name);
      if (file === own || !name.endsWith(".json")) continue;
      try {
        if (fs.statSync(file).mtimeMs < cutoff) fs.rmSync(file, { force: true });
      } catch {
        // Best-effort, per file.
      }
    }
  } catch {
    // No ledger folder yet (or not a folder).
  }

  try {
    fs.rmSync(LEGACY_LEDGER, { force: true });
  } catch {
    // Best-effort.
  }
  process.exit(0);
}

process.stdin.on("error", finish);
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  data += chunk;
  if (data.length > MAX_INPUT) {
    data = "";
    finish();
  }
});
process.stdin.on("end", finish);
