#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { join } from "node:path";
import { confirm, intro, isCancel, log, outro } from "@clack/prompts";
import pkg from "../../package.json" with { type: "json" };
import { maybeRegenerate } from "../agents/regenerate";
import { readMarker } from "../marker/read";
import { materializeToolkitSource } from "../scaffold/agent-seed";
import type { SpecKitResult } from "../schema/scaffold";
import { ensureSpecKit } from "../speckit/install";
import { SPECKIT_REF } from "../speckit/pin";
import { commitActions } from "../update/commit";
import { computeDiff } from "../update/diff";
import { extractTarball } from "../update/extract";
import { FetchError, fetchTarball } from "../update/fetch";
import { MULTI_AGENT_UPDATE_SCOPE, UPDATE_SCOPE } from "../update/manifest";
import { stalenessNudge } from "../update/nudge";
import { resolveConflicts } from "../update/prompt";
import { createStagingDir } from "../update/stage";
import { countActions, renderSummary } from "../update/summary";
import type { UpdateCliOptions, UpdateExitCode, UpdateRunSummary } from "../update/types";
import { resolveSpecKitIntegration } from "./speckit";

export type UpdateActionResult = {
  exitCode: UpdateExitCode;
  summary?: UpdateRunSummary;
};

export type SpecKitRefreshDecision =
  | { action: "absent" }
  | { action: "dry-run" }
  | { action: "declined"; reason: "non-interactive" | "user" }
  | { action: "refreshed"; result: SpecKitResult };

export interface SpecKitRefreshDeps {
  /** Override the TTY sniff so the prompt path is testable. */
  interactive?: boolean;
  confirm?: (message: string) => Promise<boolean>;
  ensure?: typeof ensureSpecKit;
}

/**
 * `.specify/` left both update scopes with the payload-hygiene gate (spec 2026-07-24 5.7),
 * so `outputease update` no longer refreshes spec-kit implicitly. Offer it explicitly
 * instead — the finding this closes is *absence of signal*, not a false "already in sync"
 * (that message is gated on `planned.length === 0` and unreachable while `.claude` is staged).
 *
 * `--yes` / non-TTY declines, matching the keep-local default at `update/prompt.ts:32-34`.
 */
export async function maybeRefreshSpecKit(
  cwd: string,
  options: UpdateCliOptions,
  deps: SpecKitRefreshDeps = {},
): Promise<SpecKitRefreshDecision> {
  if (!existsSync(join(cwd, ".specify"))) {
    log.info("spec-kit not installed — `outputease speckit init` to add it.");
    return { action: "absent" };
  }
  if (options.dryRun) {
    log.info(`[dry run] would offer to refresh spec-kit from upstream (${SPECKIT_REF}).`);
    return { action: "dry-run" };
  }
  const interactive = deps.interactive ?? (!options.yes && Boolean(process.stdin.isTTY));
  if (!interactive) {
    log.info(
      `spec-kit left untouched — run \`outputease speckit refresh\` to move to ${SPECKIT_REF}.`,
    );
    return { action: "declined", reason: "non-interactive" };
  }

  const message = `Refresh spec-kit from upstream (${SPECKIT_REF}) and re-apply archive-aware numbering?`;
  const askImpl =
    deps.confirm ??
    (async (msg: string) => {
      const answer = await confirm({ message: msg, initialValue: false });
      return !isCancel(answer) && answer === true;
    });
  if (!(await askImpl(message))) {
    log.info("spec-kit left untouched.");
    return { action: "declined", reason: "user" };
  }

  const ensureImpl = deps.ensure ?? ensureSpecKit;
  const result = await ensureImpl({
    targetDir: cwd,
    integration: resolveSpecKitIntegration(cwd),
    mode: "refresh",
  });
  for (const err of result.errors) log.error(err);
  if (result.errors.length === 0) {
    log.success(`spec-kit refreshed at ${result.upstreamRef}.`);
  }
  return { action: "refreshed", result };
}

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

    const nudge = stalenessNudge(pkg.version, fetched.version);
    if (nudge) log.warn(nudge);

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
        fetchedVersion: fetched.version,
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
        fetchedVersion: fetched.version,
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
      fetchedVersion: fetched.version,
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
    await maybeRefreshSpecKit(cwd, options);
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
