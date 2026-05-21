import * as fs from "node:fs";
import * as path from "node:path";
import type { DevStackEntry } from "../schema/dev-stacks";
import { devStacksFileSchema } from "../schema/dev-stacks";

/** Resolved path to the bundled dev-stacks.json data file. */
const DATA_PATH = path.resolve(import.meta.dirname ?? ".", "..", "..", "data", "dev-stacks.json");

/** Cached parsed entries (lazy singleton). */
let _cache: DevStackEntry[] | null = null;

/**
 * Load and validate the dev-stacks dataset.
 * Returns parsed + Zod-validated entries. Throws on structural errors.
 * Results are cached after first call.
 */
export function loadDevStacks(): DevStackEntry[] {
  if (_cache) return _cache;
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  const json = JSON.parse(raw);
  const result = devStacksFileSchema.parse(json);
  _cache = result;
  return result;
}

/**
 * Get the absolute path to the bundled dev-stacks.json file.
 * Useful for tools that want to read or edit the raw JSON directly.
 */
export function getDevStacksPath(): string {
  return DATA_PATH;
}
