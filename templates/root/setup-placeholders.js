#!/usr/bin/env bun
/**
 * Placeholder-token inspection utility.
 *
 * The 6-phase setup pipeline (LOAD/PRUNE/REMOVE/REPLACE/OPERATE/VALIDATE)
 * was removed in toolkit 0.2.0 — the Eta-based scaffolder now fills
 * CLI-resolvable placeholders at scaffold time. This script remains as a
 * read-only inspector for unfilled tokens that still need manual editing.
 *
 * Usage:
 *   bun setup-placeholders.js            List unfilled placeholder tokens
 *   bun setup-placeholders.js --help     Show this help
 */

import path from "node:path";
import { runListTokens } from "@outputease/toolkit";

const root = path.resolve(import.meta.dirname);
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: bun setup-placeholders.js");
  console.log("  Lists every placeholder token still present in this project.");
  console.log("  Edit each file by hand; the legacy --apply pipeline was removed in 0.2.0.");
  process.exit(0);
}

const { tokens } = runListTokens(root);
const sorted = [...tokens.entries()].sort((a, b) => b[1] - a[1]);
if (sorted.length === 0) {
  console.log("No unfilled placeholder tokens found.");
  process.exit(0);
}
console.log(`Found ${sorted.length} unique placeholder tokens:\n`);
for (const [token, count] of sorted) {
  console.log(`  ${token}: ${count}`);
}
