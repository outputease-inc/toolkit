import { existsSync } from "node:fs";
import { join } from "node:path";
import { intro, log, outro } from "@clack/prompts";
import { readManifestTargets } from "../agents/generate";
import { primarySpecKitIntegration } from "../scaffold/agent-seed";
import { ensureSpecKit } from "../speckit/install";
import { SPECKIT_REF } from "../speckit/pin";

export type SpecKitCliMode = "init" | "refresh" | "verify";

const MODES: readonly string[] = ["init", "refresh", "verify"];

export function isSpecKitCliMode(value: string): value is SpecKitCliMode {
  return MODES.includes(value);
}

export interface SpecKitCliOptions {
  yes: boolean;
  dryRun: boolean;
  integration?: string;
}

/**
 * Which harness `specify init` should install commands for. Explicit flag wins; else
 * derive from the project's own generated manifest (a codex-only project must not get a
 * claude surface); else claude, the pre-feature default.
 */
export function resolveSpecKitIntegration(cwd: string, explicit?: string): string {
  if (explicit) return explicit;
  const agentsDir = join(cwd, ".agents");
  if (!existsSync(agentsDir)) return "claude";
  const targets = readManifestTargets(agentsDir);
  if (!targets) return "claude";
  return primarySpecKitIntegration(targets) ?? "claude";
}

/**
 * `outputease speckit <init|refresh|verify>` — the refresh channel that replaces
 * `.specify` delivery in `outputease update` (spec 2026-07-24 5.7). Without it, opted-in
 * projects freeze at scaffold time once the payload stops carrying spec-kit.
 *
 * This is the path that legitimately self-bootstraps uv and git: it calls `ensureSpecKit`
 * directly and may be the first toolkit command a machine ever runs.
 *
 * Exit codes: 0 ok, 1 spec-kit setup failed or failed verification, 2 bad usage.
 */
export async function speckitAction(
  mode: string,
  cwd: string = process.cwd(),
  options: SpecKitCliOptions = { yes: false, dryRun: false },
): Promise<{ exitCode: 0 | 1 | 2 }> {
  if (!isSpecKitCliMode(mode)) {
    log.error(`Unknown mode "${mode}". Expected one of: ${MODES.join(", ")}.`);
    return { exitCode: 2 };
  }

  const integration = resolveSpecKitIntegration(cwd, options.integration);
  intro(
    `outputease speckit ${mode} (github/spec-kit ${SPECKIT_REF}, --integration ${integration})`,
  );

  if (options.dryRun) {
    log.info(
      mode === "verify"
        ? "[dry run] would probe .specify/ for the archive-aware numbering patches."
        : `[dry run] would install specify-cli at ${SPECKIT_REF}, run \`specify init --force\`, apply the numbering overlay, re-bridge codex, and regenerate agent configs.`,
    );
    outro("[dry run] no changes applied.");
    return { exitCode: 0 };
  }

  const result = await ensureSpecKit({ targetDir: cwd, integration, mode });

  for (const err of result.errors) log.error(err);
  if (result.bridgedSkills.length > 0) {
    log.success(
      `Bridged ${result.bridgedSkills.length} spec-kit skill(s) to .agents/targets/codex/.`,
    );
  }
  if (result.regenerated !== null) {
    log.success(`Regenerated ${result.regenerated} agent config file(s) from .agents/.`);
  }

  const overlayOk = result.overlay.every(
    (o) => o.outcome !== "anchorMissing" && o.outcome !== "verifyFailed",
  );

  if (mode === "verify") {
    if (!result.initialized) {
      log.warn("No .specify/ in this project — run `outputease speckit init` to add it.");
      outro("spec-kit not installed.");
      return { exitCode: 1 };
    }
    const ok = overlayOk && result.errors.length === 0;
    outro(ok ? "spec-kit verified." : "spec-kit verification failed.");
    return { exitCode: ok ? 0 : 1 };
  }

  const ok = result.initialized && overlayOk;
  outro(
    ok
      ? `spec-kit ${mode === "init" ? "installed" : "refreshed"} at ${result.upstreamRef}.`
      : `spec-kit ${mode} incomplete — see the errors above.`,
  );
  return { exitCode: ok ? 0 : 1 };
}
