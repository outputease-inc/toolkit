#!/usr/bin/env node
/**
 * PreToolUse hook: block Edit/Write on generated files.
 * Generated files are listed in .agents/generated.manifest.json; the source of
 * truth is the neutral .agents/ tree. Edit the source, then run
 * `bun run agents:generate`.
 *
 * Exit codes:
 *   0 = allow the operation
 *   2 = block the operation (drift prevention, timeout, or unexpected error)
 */

const fs = require("node:fs");
const path = require("node:path");

const MAX_INPUT = 1 * 1024 * 1024; // 1 MB
const MANIFEST = ".agents/generated.manifest.json";

let data = "";
const STDIN_TIMEOUT = setTimeout(() => {
  process.stderr.write("protect-generated: timed out reading input, blocking for safety\n");
  process.exit(2);
}, 4000);
process.stdin.on("data", (chunk) => {
  data += chunk;
  if (data.length > MAX_INPUT) {
    process.stderr.write("protect-generated: input too large, blocking for safety\n");
    clearTimeout(STDIN_TIMEOUT);
    process.exit(2);
  }
});
process.stdin.on("end", () => {
  clearTimeout(STDIN_TIMEOUT);
  try {
    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path;
    if (!filePath || typeof filePath !== "string") process.exit(0);

    const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, MANIFEST), "utf-8"));
    } catch {
      process.exit(0); // no manifest (pre-migration) — nothing to guard
    }

    const rel = path.relative(repoRoot, path.resolve(filePath)).replace(/\\/g, "/");
    const entry = (manifest.files || []).find((f) => f.path === rel);
    if (entry) {
      process.stderr.write(
        `BLOCKED: ${rel} is generated from ${entry.source}. ` +
          "Edit the neutral source and run 'bun run agents:generate' instead of editing the output.",
      );
      process.exit(2);
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      process.stderr.write("protect-generated: failed to parse input, blocking for safety\n");
      process.exit(2);
    }
    process.stderr.write(`protect-generated: unexpected error (${err.message}), blocking for safety\n`);
    process.exit(2);
  }
  process.exit(0);
});
