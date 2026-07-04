#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { join } from "node:path";
import { intro, log, outro } from "@clack/prompts";
import pkg from "../../package.json" with { type: "json" };
import { generate, readManifestTargets } from "../agents/generate";
import { readMarker } from "../marker/read";
import { materializeToolkitSource } from "../scaffold/agent-seed";
import { commitActions } from "../update/commit";
import { computeDiff } from "../update/diff";
import { extractTarball } from "../update/extract";
import { FetchError, fetchTarball } from "../update/fetch";
import { MULTI_AGENT_UPDATE_SCOPE, UPDATE_SCOPE } from "../update/manifest";
import { resolveConflicts } from "../update/prompt";
import { createStagingDir } from "../update/stage";
import { countActions, renderSummary } from "../update/summary";
import type { UpdateCliOptions, UpdateExitCode, UpdateRunSummary } from "../update/types";

/**
 * Regenerate every agent config from the (freshly refreshed) neutral source, scoped to
 * the project's own target set (spec 008). Returns `regenerated` = file count, or a
 * `reason` when it was skipped/failed. Only runs for a multi-agent project outside dry-run.
 */
function maybeRegenerate(
  cwd: string,
  opts: { multiAgent: boolean; dryRun: boolean },
): { regenerated: number | null; reason?: "no-manifest" | string } {
  if (!opts.multiAgent || opts.dryRun) return { regenerated: null };
  const agentsDir = join(cwd, ".agents");
  const targets = readManifestTargets(agentsDir);
  if (!targets) return { regenerated: null, reason: "no-manifest" };
  const gen = generate({ agentsDir, repoRoot: cwd, targets });
  if (gen.exitCode !== 0) return { regenerated: null, reason: gen.errors.join("; ") };
  return { regenerated: gen.emitted.length };
}

export type UpdateActionResult = {
  exitCode: UpdateExitCode;
  summary?: UpdateRunSummary;
};

export type UpdateDeps = {
  fetchTarball?: typeof fetchTarball;
  extractTarball?: typeof extractTarball;
};

export async function updateAction(
  cwd: string = process.cwd(),
  options: UpdateCliOptions = { yes: false, dryRun: false, verbose: false },
  deps: UpdateDeps = {},
): Promise<UpdateActionResult> {
  const fetchImpl = deps.fetchTarball ?? fetchTarball;
  const extractImpl = deps.extractTarball ?? extractTarball;
  const startedAt = new Date().toISOString();
  intro(`outputease update v${pkg.version}`);

  const marker = await readMarker(cwd);
  if (!marker.ok) {
    if (marker.reason === "absent") {
      log.error(
        `No .outputease marker found at ${cwd}. Not a toolkit-scaffolded project, or marker was deleted. Re-scaffold or retrofit a marker manually.`,
      );
    } else if (marker.reason === "malformed-json") {
      log.error(`Marker file is not valid JSON: ${marker.error}`);
    } else {
      log.error(`Marker file failed schema validation:\n  ${marker.issues.join("\n  ")}`);
    }
    return { exitCode: 2 };
  }

  log.info(`Detected project type: ${marker.marker.projectType}`);
  log.info(`Marker toolkitVersion: ${marker.marker.toolkitVersion}`);

  // Spec 008: a project with `.agents/` is multi-agent — its `.claude/` etc. are
  // GENERATED. Refresh the toolkit-owned neutral source + regenerate, rather than
  // copying templates/.claude/ over generated output.
  const multiAgent = existsSync(join(cwd, ".agents"));
  const scope = multiAgent ? MULTI_AGENT_UPDATE_SCOPE : UPDATE_SCOPE;

  const staging = await createStagingDir();
  let result: UpdateExitCode = 0;
  let runSummary: UpdateRunSummary | undefined;

  try {
    let fetched: Awaited<ReturnType<typeof fetchTarball>>;
    try {
      fetched = await fetchImpl();
    } catch (err) {
      if (err instanceof FetchError) {
        if (err.kind === "network") {
          log.error("Network required. outputease update cannot run offline.");
        } else {
          log.error(err.message);
        }
        return { exitCode: 3 };
      }
      throw err;
    }

    log.info(`Upstream SHA: ${fetched.shortSha}`);
    const versionDiverged = marker.marker.toolkitVersion !== pkg.version;
    if (versionDiverged) {
      log.info(
        `Marker version (${marker.marker.toolkitVersion}) differs from installed (${pkg.version})`,
      );
    }

    await extractImpl({ body: fetched.body, destDir: staging.path, expectedSha: fetched.sha });

    if (multiAgent) {
      // Re-derive the toolkit-owned neutral source (skills + Claude passthrough, no
      // instructions/mcp/settings) FROM THE FETCHED tarball's templates into staging, so
      // the existing diff pipeline reconciles it against the project's `.agents/`.
      materializeToolkitSource(join(staging.path, "templates", ".agents"), {
        includeSettings: false,
        templatesRoot: join(staging.path, "templates"),
      });
    }

    const planned = await computeDiff({
      projectRoot: cwd,
      stagedRoot: staging.path,
      scope,
    });

    if (planned.length === 0) {
      log.info("No drift detected. Project already in sync.");
      runSummary = {
        installedToolkitVersion: pkg.version,
        upstreamSha: fetched.shortSha,
        markerVersion: marker.marker.toolkitVersion,
        versionDiverged,
        actions: [],
        startedAt,
        completedAt: new Date().toISOString(),
        result: "success",
      };
      const regen = maybeRegenerate(cwd, { multiAgent, dryRun: options.dryRun });
      if (regen.reason === "no-manifest") {
        log.warn(
          "Refreshed the neutral source, but found no .agents/generated.manifest.json — run `outputease agents generate` to regenerate agent configs.",
        );
      } else if (regen.reason) {
        log.error(`Agent config regeneration failed: ${regen.reason}`);
        runSummary = { ...runSummary, result: "error" };
        outro(renderSummary(runSummary));
        return { exitCode: 1, summary: runSummary };
      } else if (regen.regenerated !== null) {
        log.success(`Regenerated ${regen.regenerated} agent config file(s) from .agents/.`);
      }
      if (multiAgent && options.dryRun) {
        log.info("[dry run] would regenerate agent configs from .agents/.");
      }
      outro(renderSummary(runSummary));
      return { exitCode: 0, summary: runSummary };
    }

    const nonInteractive = options.yes || !process.stdin.isTTY;
    const { resolved, aborted } = await resolveConflicts(planned, {
      nonInteractive,
      projectRoot: cwd,
    });

    if (aborted) {
      log.warn("Aborted by user before commit. Project tree untouched.");
      runSummary = {
        installedToolkitVersion: pkg.version,
        upstreamSha: fetched.shortSha,
        markerVersion: marker.marker.toolkitVersion,
        versionDiverged,
        actions: resolved,
        startedAt,
        completedAt: new Date().toISOString(),
        result: "aborted",
      };
      outro(renderSummary(runSummary));
      return { exitCode: 4, summary: runSummary };
    }

    const previewSummary: UpdateRunSummary = {
      installedToolkitVersion: pkg.version,
      upstreamSha: fetched.shortSha,
      markerVersion: marker.marker.toolkitVersion,
      versionDiverged,
      actions: resolved,
      startedAt,
      result: "success",
    };

    if (options.dryRun) {
      log.info("[dry run] No changes applied. Re-run without --dry-run to commit.");
      if (multiAgent) log.info("[dry run] would regenerate agent configs from .agents/.");
      runSummary = { ...previewSummary, completedAt: new Date().toISOString() };
      outro(renderSummary(runSummary));
      return { exitCode: 0, summary: runSummary };
    }

    const counts = countActions(previewSummary);
    if (options.verbose) {
      log.info(
        `Committing ${counts.added + counts.updatedClean + counts.overwritten} writes; ${counts.skipped + counts.unchanged + counts.outOfScope} skipped`,
      );
    }
    await commitActions(resolved, { projectRoot: cwd, scope });

    runSummary = { ...previewSummary, completedAt: new Date().toISOString(), result: "success" };
    const regen = maybeRegenerate(cwd, { multiAgent, dryRun: options.dryRun });
    if (regen.reason === "no-manifest") {
      log.warn(
        "Refreshed the neutral source, but found no .agents/generated.manifest.json — run `outputease agents generate` to regenerate agent configs.",
      );
    } else if (regen.reason) {
      log.error(`Agent config regeneration failed: ${regen.reason}`);
      runSummary = { ...runSummary, result: "error" };
      outro(renderSummary(runSummary));
      return { exitCode: 1, summary: runSummary };
    } else if (regen.regenerated !== null) {
      log.success(`Regenerated ${regen.regenerated} agent config file(s) from .agents/.`);
    }
    outro(renderSummary(runSummary));
    return { exitCode: 0, summary: runSummary };
  } catch (err) {
    log.error(`Unexpected error: ${(err as Error).message}`);
    result = 1;
    runSummary = {
      installedToolkitVersion: pkg.version,
      upstreamSha: "unknown",
      markerVersion: marker.marker.toolkitVersion,
      versionDiverged: false,
      actions: [],
      startedAt,
      completedAt: new Date().toISOString(),
      result: "error",
    };
    return { exitCode: result, summary: runSummary };
  } finally {
    await staging.cleanup();
  }
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const options: UpdateCliOptions = {
    yes: argv.includes("--yes"),
    dryRun: argv.includes("--dry-run"),
    verbose: argv.includes("--verbose"),
  };
  const out = await updateAction(process.cwd(), options);
  process.exit(out.exitCode);
}
