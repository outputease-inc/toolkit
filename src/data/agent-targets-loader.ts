import type { AgentTarget } from "../schema/agent-targets";
import { agentTargetsFileSchema } from "../schema/agent-targets";
import { makeStackLoader } from "./make-loader";

const loader = makeStackLoader<AgentTarget>("agent-targets.json", agentTargetsFileSchema);

/**
 * Load and validate the agent-targets mapping table (parsed + Zod-validated,
 * cached). Throws on structural errors (contract guarantee 2).
 */
export function loadAgentTargets(): AgentTarget[] {
  return loader.load();
}

/** Absolute path to the bundled agent-targets.json file. */
export function getAgentTargetsPath(): string {
  return loader.getPath();
}
