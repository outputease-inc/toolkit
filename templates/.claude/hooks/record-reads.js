#!/usr/bin/env node
/**
 * PostToolUse hook (Read, Edit|Write, NotebookEdit): record what we observed about a
 * file into this session's ledger, .claude/.last-reads/<session_id>.json, so the Stop
 * hook (verify-sources.js) can detect whether a source changed between when you
 * observed it and turn-end.
 *
 *   Read       -> store a content hash of the file as read now.
 *   Edit/Write/NotebookEdit (NotebookEdit names the file notebook_path)
 *              -> store the "@edited" sentinel and DEFER the baseline to the Stop
 *     hook. We cannot hash reliably here: auto-format.js (`biome format --write`)
 *     runs under the same Edit|Write matcher, and Claude Code runs matching hooks
 *     IN PARALLEL (array order is NOT execution order), so hashing the file now
 *     races the formatter and may capture pre-format bytes -> verify-sources.js
 *     would then false-flag our own edit. verify-sources.js resolves the sentinel
 *     to a real hash at turn-end, when the bytes are stable (design D3: a file you
 *     changed yourself must not later flag as changed-by-someone-else, yet stays
 *     tracked for genuine external drift on later turns).
 *
 * The sentinel "@edited" can never collide with a SHA-1 hex ([0-9a-f]{40}).
 *
 * Per-session ledger: one file per payload session_id (a subagent's tool calls
 * carry its parent's id, so its reads land in the parent's ledger). An id that
 * fails SESSION_ID_RE is never turned into a path; it falls back to default.json.
 * ledgerPath() must stay identical in verify-sources.js and reset-reads.js (twin
 * test in source-staleness.test.ts). reset-reads.js clears a session's ledger at
 * SessionStart for a fresh context only (never per turn, never on resume or
 * compact), so a file read early and referenced late stays tracked.
 *
 * Stdin cap is 1 MB. A Read payload carries the file content (tool_response) and an
 * Edit payload the whole pre-edit file (originalFile), so the old 10 KB cap silently
 * skipped every file over about 10 KB. Above 1 MB (an image over about 750 KB, sent
 * as base64) the hook still exits 0 without recording.
 *
 * Storage: JSON object { "<absolute-path>": "<sha1-hex> | @edited" }, most-recent
 * last, capped at MAX_ENTRIES. Best-effort: exits 0 on every path.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MAX_INPUT = 1024 * 1024; // 1 MB: a Read payload carries the file, an Edit payload the pre-edit file
const LEDGER_DIR = path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), ".claude", ".last-reads");
const SESSION_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const EDITED_SENTINEL = "@edited"; // deferred-baseline marker; must match verify-sources.js
const MAX_ENTRIES = 200;
const FULL_HASH_LIMIT = 512 * 1024; // hash whole file up to 512 KB
const SAMPLE_BYTES = 64 * 1024; // larger files: hash size + first/last 64 KB

function ledgerPath(sessionId) {
  const id = typeof sessionId === "string" && SESSION_ID_RE.test(sessionId) ? sessionId : "default";
  return path.join(LEDGER_DIR, `${id}.json`);
}

// Write to a temp file and rename it over the ledger: writeFileSync truncates first, so
// a hook reading at that moment would see "" and write back a ledger holding only its
// own entry, wiping the session's. The temp name keeps ".json" so reset-reads' 7-day GC
// reaps a crash leftover, and cannot collide with a ledger (SESSION_ID_RE bars dots).
// A failed rename (Windows EPERM while another hook has the file open) is one lost
// update, not a wipe. Must match verify-sources.js.
function writeLedger(ledgerFile, ledger) {
  const tmp = ledgerFile.replace(/\.json$/, `.${process.pid}.tmp.json`);
  fs.writeFileSync(tmp, JSON.stringify(ledger));
  try {
    fs.renameSync(tmp, ledgerFile);
  } catch {
    fs.rmSync(tmp, { force: true });
  }
}

function hashFile(absPath) {
  const stat = fs.statSync(absPath);
  if (!stat.isFile()) return null;
  const hash = crypto.createHash("sha1");
  hash.update(String(stat.size));
  if (stat.size <= FULL_HASH_LIMIT) {
    hash.update(fs.readFileSync(absPath));
  } else {
    const fd = fs.openSync(absPath, "r");
    try {
      const head = Buffer.alloc(SAMPLE_BYTES);
      fs.readSync(fd, head, 0, SAMPLE_BYTES, 0);
      hash.update(head);
      const tail = Buffer.alloc(SAMPLE_BYTES);
      fs.readSync(fd, tail, 0, SAMPLE_BYTES, stat.size - SAMPLE_BYTES);
      hash.update(tail);
    } finally {
      fs.closeSync(fd);
    }
  }
  return hash.digest("hex");
}

function loadLedger(ledgerFile) {
  try {
    const parsed = JSON.parse(fs.readFileSync(ledgerFile, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

let data = "";
const STDIN_TIMEOUT = setTimeout(() => process.exit(0), 4000);

// Never let a stray stdin 'error' event become an uncaught exception (non-zero
// exit). Hardening beyond the record-edits.js precedent (founder decision).
process.stdin.on("error", () => process.exit(0));

// Decode as UTF-8 across chunk boundaries: a multibyte character split between two
// chunks must not become two replacement characters in a path.
process.stdin.setEncoding("utf8");
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
    // NotebookEdit names its target notebook_path, not file_path.
    const filePath = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
    if (!filePath || typeof filePath !== "string") process.exit(0);

    const absPath = path.resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd(), filePath);
    if (!fs.existsSync(absPath)) process.exit(0);

    // Read -> hash the observed bytes now. Anything else that reached this hook
    // is an edit (Edit/Write/NotebookEdit) -> defer to verify-sources.js via the
    // sentinel (see header). Default the ambiguous case to the sentinel: mis-
    // hashing a just-edited file is the bug we are fixing; deferring a stray
    // read only costs one turn of staleness tracking.
    let value;
    if (input.tool_name === "Read") {
      try {
        value = hashFile(absPath);
      } catch {
        process.exit(0);
      }
      if (!value) process.exit(0);
    } else {
      value = EDITED_SENTINEL;
    }

    const ledgerFile = ledgerPath(input.session_id);
    const ledger = loadLedger(ledgerFile);
    // Delete then set so the key moves to the end (most-recent-last ordering).
    delete ledger[absPath];
    ledger[absPath] = value;

    const keys = Object.keys(ledger);
    if (keys.length > MAX_ENTRIES) {
      for (const stale of keys.slice(0, keys.length - MAX_ENTRIES)) {
        delete ledger[stale];
      }
    }

    fs.mkdirSync(path.dirname(ledgerFile), { recursive: true });
    writeLedger(ledgerFile, ledger);
  } catch {
    // Best-effort; never block on errors.
  }
  process.exit(0);
});
