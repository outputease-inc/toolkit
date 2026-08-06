#!/usr/bin/env node
/**
 * Stop hook: warn when a source you observed earlier this session changed (or
 * vanished) since you last read/edited it — the "verify, don't trust" check.
 *
 * Reads .claude/.last-reads.json (written by record-reads.js: { path: sha1 |
 * "@edited" }), re-hashes each tracked path, and emits a non-blocking
 * additionalContext warning naming the paths whose content diverged from the
 * recorded hash or that no longer exist. Refreshes the baseline for every
 * changed path so it does not re-nag next turn; drops vanished paths.
 *
 * "@edited" entries are files WE edited this turn (record-reads.js defers their
 * baseline here, since hashing at edit-time races auto-format.js — see that
 * hook's header). We resolve them to the now-stable hash and NEVER warn; the
 * resolved hash is persisted so a genuine external change on a LATER turn IS
 * caught. That persistence is the reason the ledger is written whenever it was
 * mutated (`dirty`), even when there is nothing to warn about.
 *
 * Never blocks: emits via hookSpecificOutput.additionalContext and exits 0,
 * exactly like batch-typecheck.js. Silent when nothing changed.
 *
 * Does NOT delete the sentinel file — the ledger is per-session (reset-reads.js
 * clears it at SessionStart), so it must survive across turns.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MAX_INPUT = 10 * 1024;
const SENTINEL = path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), ".claude", ".last-reads.json");
const EDITED_SENTINEL = "@edited"; // deferred-baseline marker; must match record-reads.js
const MAX_OUTPUT = 4000;
const FULL_HASH_LIMIT = 512 * 1024;
const SAMPLE_BYTES = 64 * 1024;

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

let data = "";
const STDIN_TIMEOUT = setTimeout(() => process.exit(0), 4000);

// Never let a stray stdin 'error' event become an uncaught exception (non-zero
// exit). Hardening beyond the record-edits.js precedent (founder decision).
process.stdin.on("error", () => process.exit(0));

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
    // A continuation Stop (stop_hook_active): another Stop hook (batch-test /
    // batch-typecheck) reported findings via additionalContext, which CONTINUES
    // the turn, so Stop fires again with this flag set. We must STILL resolve any
    // "@edited" sentinels here — a sentinel created during the continuation would
    // otherwise be orphaned (its resolving Stop skipped) and then silently
    // swallow the next turn's external drift. But we suppress warnings and skip
    // external-change / missing handling, staying a quiet passenger in that loop.
    const continuation = Boolean(input.stop_hook_active);
    if (!fs.existsSync(SENTINEL)) process.exit(0);

    let ledger;
    try {
      ledger = JSON.parse(fs.readFileSync(SENTINEL, "utf8"));
    } catch {
      process.exit(0);
    }
    if (!ledger || typeof ledger !== "object") process.exit(0);

    const changed = [];
    const missing = [];
    let dirty = false;
    for (const [absPath, storedHash] of Object.entries(ledger)) {
      if (storedHash === EDITED_SENTINEL) {
        // A file WE edited this turn (record-reads.js deferred it). Establish its
        // baseline from the now-stable post-turn bytes; never warn — it is our
        // own edit, not external drift. Done on continuation Stops too (see
        // above). If it cannot be hashed yet (missing / not a regular file),
        // leave the sentinel for a later Stop to resolve. Persisting this (dirty)
        // is what lets a genuine external change on a LATER turn be caught.
        if (!fs.existsSync(absPath)) continue;
        let editedHash;
        try {
          editedHash = hashFile(absPath);
        } catch {
          continue;
        }
        if (!editedHash) continue;
        ledger[absPath] = editedHash;
        dirty = true;
        continue;
      }
      if (continuation) continue; // external-change / missing checks only on a real Stop
      if (!fs.existsSync(absPath)) {
        missing.push(absPath);
        continue;
      }
      let currentHash;
      try {
        currentHash = hashFile(absPath);
      } catch {
        continue; // unreadable right now; skip rather than false-warn
      }
      if (!currentHash) continue;
      if (currentHash !== storedHash) {
        changed.push(absPath);
        ledger[absPath] = currentHash; // refresh baseline: don't re-nag next turn
        dirty = true;
      }
    }

    for (const absPath of missing) {
      delete ledger[absPath];
      dirty = true;
    }

    // Persist resolved sentinels / refreshed baselines / dropped paths even when
    // there is nothing to warn about — otherwise an "@edited" sentinel survives
    // and silently swallows future external drift on the file we edited.
    if (dirty) {
      try {
        fs.writeFileSync(SENTINEL, JSON.stringify(ledger));
      } catch {
        // Best-effort; never block on errors.
      }
    }

    if (changed.length === 0 && missing.length === 0) process.exit(0);

    const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const rel = (p) => path.relative(cwd, p).replace(/\\/g, "/") || p;
    const lines = [];
    for (const p of changed) {
      lines.push(`  • ${rel(p)} — read earlier this session, content changed`);
    }
    for (const p of missing) {
      lines.push(`  • ${rel(p)} — read earlier this session, now missing (moved/deleted)`);
    }

    const body = [
      "[Verify, don't trust] A source you read earlier changed since you observed it.",
      "Re-read it before trusting any claim, summary, or edit that relies on it:",
      ...lines,
    ]
      .join("\n")
      .substring(0, MAX_OUTPUT);

    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "Stop", additionalContext: body },
      }),
    );
  } catch {
    // Best-effort; never block on errors.
  }
  process.exit(0);
});
