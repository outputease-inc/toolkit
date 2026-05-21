import * as fs from "node:fs";
import * as path from "node:path";
import type { AgentStackEntry } from "../schema/agent-stacks";
import { agentStacksFileSchema } from "../schema/agent-stacks";

/** Resolved path to the bundled agent-stacks.json data file. */
const DATA_PATH = path.resolve(import.meta.dirname ?? ".", "..", "..", "data", "agent-stacks.json");

/** Cached parsed entries (lazy singleton). */
let _cache: AgentStackEntry[] | null = null;

/**
 * Load and validate the agent-stacks dataset.
 * Returns parsed + Zod-validated entries. Throws on structural errors.
 * Results are cached after first call.
 */
export function loadAgentStacks(): AgentStackEntry[] {
  if (_cache) return _cache;
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  const json = JSON.parse(raw);
  const result = agentStacksFileSchema.parse(json);
  _cache = result;
  return result;
}

/**
 * Get the absolute path to the bundled agent-stacks.json file.
 * Useful for tools that want to read or edit the raw JSON directly.
 */
export function getAgentStacksPath(): string {
  return DATA_PATH;
}
