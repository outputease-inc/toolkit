import type { AgentTarget, EmitterFamily } from "../schema/agent-targets";
import type { SourceModel } from "./source";
import type { ManifestTarget } from "./source-schemas";

/**
 * Core generation types (spec 008). Emitters are pure `(ctx) => EmittedFile[]`
 * functions keyed by `EmitterFamily`; the orchestrator dispatches to them based
 * on each target's mapping-table fields, dedupes identical same-path outputs,
 * and writes the manifest.
 */

export interface EmittedFile {
  /** Repo-relative POSIX path (LF line endings in `content`). */
  path: string;
  content: string;
  /** Attribution: a target id, or "shared" for the common AGENTS.md core. */
  target: ManifestTarget;
  family: EmitterFamily;
  /** Neutral-source path this file derived from (for drift-guard pointers). */
  source: string;
}

export interface EmitterContext {
  /** The target this emit is for. AGENTS.md ("shared") passes a representative. */
  target: AgentTarget;
  /** Every target in the dataset. */
  allTargets: AgentTarget[];
  /** Targets enabled for this generate run (after --targets filtering). */
  enabledTargets: AgentTarget[];
  source: SourceModel;
}

export type Emitter = (ctx: EmitterContext) => EmittedFile[];

/** Thrown by a stub emitter for a family whose function has not shipped yet. */
export class EmitterNotImplementedError extends Error {
  family: EmitterFamily;
  constructor(family: EmitterFamily) {
    super(`emitter for family "${family}" is not implemented`);
    this.name = "EmitterNotImplementedError";
    this.family = family;
  }
}
