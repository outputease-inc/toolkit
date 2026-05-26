#!/usr/bin/env bun
import { intro, log, outro } from "@clack/prompts";
import pkg from "../../package.json" with { type: "json" };
import { readMarker } from "../marker/read";
import { commitActions } from "../update/commit";
import { computeDiff } from "../update/diff";
import { extractTarball } from "../update/extract";
import { FetchError, fetchTarball } from "../update/fetch";
import { resolveConflicts } from "../update/prompt";
import { createStagingDir } from "../update/stage";
import { countActions, renderSummary } from "../update/summary";
import type { UpdateCliOptions, UpdateExitCode, UpdateRunSummary } from "../update/types";

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

    await extractImpl({ body: fetched.body, destDir: staging.path });

    const planned = await computeDiff({
      projectRoot: cwd,
      stagedRoot: staging.path,
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
    await commitActions(resolved, { projectRoot: cwd });

    runSummary = { ...previewSummary, completedAt: new Date().toISOString(), result: "success" };
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
