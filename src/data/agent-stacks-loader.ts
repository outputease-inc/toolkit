import type { AgentStackEntry } from "../schema/agent-stacks";
import { agentStacksFileSchema } from "../schema/agent-stacks";
import { makeStackLoader } from "./make-loader";

const loader = makeStackLoader<AgentStackEntry>("agent-stacks.json", agentStacksFileSchema);

/**
 * Load and validate the agent-stacks dataset (parsed + Zod-validated, cached).
 * Throws on structural errors.
 */
export function loadAgentStacks(): AgentStackEntry[] {
  return loader.load();
}

/** Absolute path to the bundled agent-stacks.json file. */
export function getAgentStacksPath(): string {
  return loader.getPath();
}
