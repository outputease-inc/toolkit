#!/usr/bin/env node
/**
 * PostToolUse hook: Auto-format files with Biome after Edit/Write.
 * Runs Biome check --fix --unsafe on the edited file.
 *
 * Exit codes:
 *   0 = success (format applied or skipped gracefully)
 */

const { execFileSync } = require("child_process");

const MAX_INPUT = 10 * 1024; // 10 KB

// Extensions Biome v2 can process
const BIOME_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".jsonc",
  ".css",
  ".graphql",
  ".gql",
]);

let data = "";
const STDIN_TIMEOUT = setTimeout(() => {
  process.exit(0); // Non-blocking: skip formatting on timeout
}, 4000);

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

    const normalized = filePath.replace(/\\/g, "/");

    // Extract file extension
    const lastDot = normalized.lastIndexOf(".");
    if (lastDot === -1) process.exit(0);
    const ext = normalized.substring(lastDot).toLowerCase();

    // Skip files Biome cannot process
    if (!BIOME_EXTENSIONS.has(ext)) process.exit(0);

    // Run Biome check --fix --unsafe on the file
    // Uses execFileSync to avoid shell injection (no shell interpolation)
    execFileSync("bunx", ["@biomejs/biome", "format", "--write", filePath], {
      stdio: ["ignore", "ignore", "ignore"],
      timeout: 10000,
    });
  } catch {
    // Non-blocking: if Biome fails, continue silently.
    // Errors will be caught by the regular lint check.
  }
  process.exit(0);
});
