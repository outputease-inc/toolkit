#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { confirm, intro, isCancel, log, outro } from "@clack/prompts";
import pkg from "../../package.json" with { type: "json" };
import { clonedEnvSinglePath } from "../platform";
import { FetchError, fetchLatestVersion } from "../update/fetch";
import { compareSemver } from "../version/compare";
import { detectInstallMethod } from "./detect";

const PACKAGE_SPEC = "@outputease/toolkit@latest";

export type UpgradeOptions = { yes: boolean; dryRun: boolean };

export type UpgradeDeps = {
  fetchLatestVersion?: typeof fetchLatestVersion;
  runInstall?: (cmd: string, args: string[]) => { status: number | null };
  runningPath?: string;
  isTTY?: boolean;
};

function defaultRunInstall(cmd: string, args: string[]): { status: number | null } {
  const r = spawnSync(cmd, args, { stdio: "inherit", env: clonedEnvSinglePath() });
  return { status: r.status };
}

export async function upgradeAction(
  options: UpgradeOptions = { yes: false, dryRun: false },
  deps: UpgradeDeps = {},
): Promise<{ exitCode: number }> {
  const fetchVer = deps.fetchLatestVersion ?? fetchLatestVersion;
  const runInstall = deps.runInstall ?? defaultRunInstall;
  const runningPath = deps.runningPath ?? fileURLToPath(import.meta.url);
  const isTTY = deps.isTTY ?? Boolean(process.stdin.isTTY);

  intro(`outputease upgrade v${pkg.version}`);

  let latest: string;
  try {
    latest = (await fetchVer()).version;
  } catch (err) {
    if (err instanceof FetchError) {
      log.error(
        err.kind === "network"
          ? "Network required. outputease upgrade cannot run offline."
          : err.message,
      );
      return { exitCode: 3 };
    }
    throw err;
  }

  if (compareSemver(pkg.version, latest) >= 0) {
    log.info(`outputease ${pkg.version} is already the latest published version.`);
    outro("Nothing to do.");
    return { exitCode: 0 };
  }

  log.info(`Update available: ${pkg.version} → ${latest}`);

  const method = detectInstallMethod(runningPath);
  if (method === null) {
    log.warn("Could not determine how outputease was installed. Update it with one of:");
    log.message(
      [
        `  bun add -g ${PACKAGE_SPEC}`,
        `  npm i -g ${PACKAGE_SPEC}`,
        `  pnpm add -g ${PACKAGE_SPEC}`,
      ].join("\n"),
    );
    outro("Run the command matching your install, then verify with `outputease --version`.");
    return { exitCode: 0 };
  }

  const cmd = "bun";
  const args = ["add", "-g", PACKAGE_SPEC];
  const printable = `${cmd} ${args.join(" ")}`;

  if (options.dryRun) {
    log.info(`[dry run] Would run: ${printable}`);
    outro("Re-run without --dry-run to upgrade.");
    return { exitCode: 0 };
  }

  if (isTTY && !options.yes) {
    const ok = await confirm({ message: `Run \`${printable}\`?` });
    if (isCancel(ok) || !ok) {
      log.warn("Upgrade cancelled.");
      return { exitCode: 4 };
    }
  }

  log.info(`Running: ${printable}`);
  const { status } = runInstall(cmd, args);
  if (status !== 0) {
    const lines = [`\`${printable}\` exited with code ${status ?? "null"}.`];
    if (process.platform === "win32") {
      // The running launcher (outputease.exe) is file-locked while in use on Windows,
      // so an in-place global replace can fail even though the package may have updated.
      lines.push("The running launcher (outputease.exe) can't be replaced while in use.");
    }
    lines.push(
      "Open a NEW terminal and run:",
      `  ${printable}`,
      "Then verify with: outputease --version",
    );
    log.error(lines.join("\n"));
    return { exitCode: 1 };
  }

  log.success(`Upgraded toward ${latest}. Verify with: outputease --version`);
  outro("Done.");
  return { exitCode: 0 };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const out = await upgradeAction({
    yes: argv.includes("--yes"),
    dryRun: argv.includes("--dry-run"),
  });
  process.exit(out.exitCode);
}
