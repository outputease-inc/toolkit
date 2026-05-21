#!/usr/bin/env bun
/**
 * Setup validation wrapper.
 *
 * Runs validation checks independently of the full setup pipeline.
 * See SETUP.md for full documentation.
 *
 * Usage:
 *   bun verify-setup.js
 */

import path from "node:path";
import { loadConfig, validate } from "@outputease/toolkit";

const root = path.resolve(import.meta.dirname);
const configPath = path.join(root, "toolkit.config.json");

// Load config
const { config, errors } = loadConfig(configPath);

if (errors.length > 0) {
  console.log("Config errors:");
  for (const err of errors) console.log(`  [error] ${err}`);
  console.log("");
}

if (!config) {
  console.error("Fatal: cannot validate without a valid config.");
  console.error("Fill required fields in toolkit.config.json first.");
  process.exit(1);
}

// Run validation
const result = validate(root, config);

console.log("Setup Validation\n");

for (const r of result.results) {
  const icon =
    r.status === "pass" ? "[PASS]" : r.status === "warn" ? "[WARN]" : "[FAIL]";
  console.log(`  ${icon} ${r.label}`);
  if (r.message) console.log(`         ${r.message}`);
}

console.log(
  `\n  ${result.passed} passed, ${result.failed} failed, ${result.warnings} warning(s)`,
);

process.exit(result.failed > 0 ? 1 : 0);
