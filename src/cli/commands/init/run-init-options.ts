import type { AgentTargetId } from "../../../schema/agent-targets";
import type { ScaffoldScope } from "../../../schema/scaffold";
import type { DecisionTreeLeaf } from "../../../tree/schema";
import type { RunInitOptions } from "./run";

export interface InteractiveRunInitInput {
  name: string;
  targetDir: string;
  preset?: string;
  pm: string;
  pmExplicit: boolean;
  dryRun: boolean;
  agentTargets: AgentTargetId[];
  uv?: boolean;
  specKit?: boolean;
  scope: ScaffoldScope;
  /**
   * REQUIRED. The interactive tree always resolves a leaf; forgetting to thread
   * it is exactly the platform-divergence bug this guards against (a missing
   * leaf makes runInit fall back to the webApp default). Keeping this required
   * turns a dropped thread into a compile error. See
   * docs/superpowers/specs/2026-07-24-init-picker-platform-divergence-design.md.
   */
  leaf: DecisionTreeLeaf;
  runtime?: string;
  backend?: string;
  force?: boolean;
  selectedPlugins: string[];
}

/**
 * Assemble the RunInitOptions for the interactive init path (the fields
 * previously built inline in action.ts). Kept pure and separate so the leaf
 * thread is unit-testable without mocking the CLI prompt flow.
 */
export function buildInteractiveRunInitOptions(input: InteractiveRunInitInput): RunInitOptions {
  return {
    name: input.name,
    targetDir: input.targetDir,
    preset: input.preset,
    pm: input.pm,
    pmExplicit: input.pmExplicit,
    dryRun: input.dryRun,
    claude: input.agentTargets.includes("claude"),
    agentTargets: input.agentTargets,
    uv: input.uv ?? true,
    specKit: input.specKit ?? true,
    scope: input.scope,
    leaf: input.leaf,
    runtime: input.runtime,
    backend: input.backend,
    force: input.force,
    selectedPlugins: input.selectedPlugins,
  };
}
