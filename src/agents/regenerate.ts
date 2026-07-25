import { join } from "node:path";
import { generate, readManifestTargets } from "./generate";

export interface RegenerateOptions {
  /** Only multi-agent projects (those with a `.agents/` neutral source) regenerate. */
  multiAgent: boolean;
  dryRun: boolean;
}

export interface RegenerateResult {
  regenerated: number | null;
  reason?: "no-manifest" | string;
}

/**
 * Regenerate every agent config from the neutral source, scoped to the project's own
 * target set (spec 008). Returns `regenerated` = file count, or a `reason` when it was
 * skipped/failed. Only runs for a multi-agent project outside dry-run.
 *
 * Lifted out of `cli/update.ts` so `src/speckit/install.ts` can reuse it after the
 * codex re-bridge without importing the update CLI. Safe to run AFTER `specify init`:
 * `writeArtifacts` (`agents/generate.ts:184-200`) is mkdir + writeFile per file plus the
 * manifest — there is no prune or stale-output deletion anywhere in `generate.ts` or the
 * emitters, so it cannot delete the `.claude/skills/speckit-*` upstream just wrote.
 */
export function maybeRegenerate(cwd: string, opts: RegenerateOptions): RegenerateResult {
  if (!opts.multiAgent || opts.dryRun) return { regenerated: null };
  const agentsDir = join(cwd, ".agents");
  const targets = readManifestTargets(agentsDir);
  if (!targets) return { regenerated: null, reason: "no-manifest" };
  const gen = generate({ agentsDir, repoRoot: cwd, targets });
  if (gen.exitCode !== 0) return { regenerated: null, reason: gen.errors.join("; ") };
  return { regenerated: gen.emitted.length };
}
