import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { platform } from "node:os";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { clonedEnvSinglePath } from "../platform";
import { RUNTIME_PREREQ_MAPPINGS } from "../tree/additive-routes";
import type { DecisionTreeLeaf, PrereqCheck } from "../tree/schema";
import { compareSemver } from "../version/compare";

/**
 * Per-leaf preflight: detect host-machine prerequisites for a scaffolded
 * project (Rust for Tauri, Xcode for Capacitor iOS, etc.) and surface them
 * to the user before scaffold writes happen.
 *
 * Soft-fail by design: missing required prereqs warn loudly and prompt the
 * caller to confirm continue, missing recommended prereqs warn only. We do
 * NOT attempt to install Rust / Xcode / Android SDK ourselves — they need
 * elevated permissions and platform-specific flows beyond what a generic
 * scaffolder should own.
 *
 * Detection mirrors the spawnSync + timeout pattern from `post-install.ts`.
 */

const SPAWN_TIMEOUT_MS = 10_000;

export interface PrereqResult {
  check: PrereqCheck;
  available: boolean;
  /** Detected version string when applicable (e.g. "20.11.0" for Node). */
  version?: string;
  /** Set when the check ran but failed a constraint (e.g. minVersion). */
  reason?: string;
}

export interface PreflightReport {
  /** Subset of results where severity = "required" and available = false. */
  blockingMissing: PrereqResult[];
  /** Subset of results where severity = "recommended" and available = false. */
  recommendedMissing: PrereqResult[];
  /** Every check that ran (including those that passed). */
  all: PrereqResult[];
}

export interface RunPreflightOptions {
  /**
   * The runtime the user picked in the additive-route question.
   * - `"node"` swaps any leaf-declared Bun check for Node 20+ + pnpm so the
   *   user gets accurate install hints for the toolchain they actually need.
   * - undefined or `"bun"` leaves the leaf's declared prereqs as-is.
   */
  runtime?: string;
}

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

function detectBinary(cmd: string, args: string[]): { ok: boolean; stdout?: string } {
  try {
    const r = spawnSync(cmd, args, {
      stdio: "pipe",
      timeout: SPAWN_TIMEOUT_MS,
      env: clonedEnvSinglePath(),
    });
    if (r.status === 0) {
      return { ok: true, stdout: r.stdout?.toString().trim() };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

function detectNode(minVersion?: string): {
  ok: boolean;
  version?: string;
  reason?: string;
} {
  const r = detectBinary("node", ["--version"]);
  if (!r.ok || !r.stdout) return { ok: false };
  const version = r.stdout.replace(/^v/, "");
  if (minVersion && compareSemver(version, minVersion) < 0) {
    return {
      ok: false,
      version,
      reason: `Found ${version}, need >= ${minVersion}`,
    };
  }
  return { ok: true, version };
}

export function runPrereqCheck(check: PrereqCheck): PrereqResult {
  const { detect } = check;
  switch (detect.kind) {
    case "binary": {
      const r = detectBinary(detect.cmd, detect.args ?? []);
      return { check, available: r.ok, version: r.stdout };
    }
    case "node": {
      const r = detectNode(detect.minVersion);
      return {
        check,
        available: r.ok,
        version: r.version,
        reason: r.reason,
      };
    }
    case "bun": {
      const r = detectBinary("bun", ["--version"]);
      return { check, available: r.ok, version: r.stdout };
    }
    case "pnpm": {
      const r = detectBinary("pnpm", ["--version"]);
      return { check, available: r.ok, version: r.stdout };
    }
    default: {
      const _exhaustive: never = detect;
      throw new Error(`Unhandled prereq kind: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function isCheckApplicable(check: PrereqCheck): boolean {
  if (!check.appliesTo || check.appliesTo.length === 0) return true;
  return check.appliesTo.includes(platform() as "win32" | "darwin" | "linux");
}

/**
 * Write a JSON sidecar of the report when `OE_PREFLIGHT_REPORT_PATH` is set.
 * Used by E2E tests (Windows Sandbox) where PowerShell's `Start-Transcript`
 * doesn't reliably capture stdout from grandchild processes. The sidecar is
 * authoritative for automated assertions; the on-screen output is for humans.
 */
function maybeWriteSidecar(report: PreflightReport): void {
  const path = process.env.OE_PREFLIGHT_REPORT_PATH;
  if (!path) return;
  try {
    const payload = {
      schemaVersion: 1,
      writtenAt: new Date().toISOString(),
      summary: {
        totalChecks: report.all.length,
        blockingMissing: report.blockingMissing.length,
        recommendedMissing: report.recommendedMissing.length,
      },
      all: report.all.map((r) => ({
        name: r.check.name,
        detectKind: r.check.detect.kind,
        severity: r.check.severity,
        available: r.available,
        version: r.version,
        reason: r.reason,
        installHint: r.check.installHint,
      })),
    };
    writeFileSync(path, JSON.stringify(payload, null, 2));
  } catch {
    // Sidecar failure shouldn't break the user-facing flow.
  }
}

export function runPreflight(
  leaf: DecisionTreeLeaf,
  opts: RunPreflightOptions = {},
): PreflightReport {
  // Resolve the runtime mapping (if any) from the registry so adding a new
  // runtime is a one-file change in tree/additive-routes.ts.
  const mapping = opts.runtime
    ? RUNTIME_PREREQ_MAPPINGS.find((m) => m.value === opts.runtime)
    : undefined;
  const supersedes = new Set(mapping?.supersedes ?? []);

  const leafChecks = (leaf.prerequisites ?? []).filter((c) => !supersedes.has(c.detect.kind));
  const runtimeChecks: PrereqCheck[] = mapping?.prereqs ?? [];
  const checks: PrereqCheck[] = [...leafChecks, ...runtimeChecks].filter(isCheckApplicable);

  const all = checks.map(runPrereqCheck);
  const report: PreflightReport = {
    all,
    blockingMissing: all.filter((r) => !r.available && r.check.severity === "required"),
    recommendedMissing: all.filter((r) => !r.available && r.check.severity === "recommended"),
  };
  maybeWriteSidecar(report);
  return report;
}

/**
 * Render the report and return whether any required prereqs are missing
 * (caller decides what to do — interactive confirm vs hard exit).
 *
 * Two output paths:
 * - Interactive TTY: clack `p.log.*` for the polished walk-through.
 * - Non-TTY (CI, PowerShell `Start-Transcript`, Bun-on-Windows pipe capture):
 *   plain `console.log` lines so the report appears in captured logs.
 *
 * clack writes via raw cursor manipulation that doesn't survive non-TTY
 * capture on Windows; the plain branch is the source of truth that
 * downstream tooling (E2E asserts, CI logs) can grep.
 */
export function displayPreflightReport(report: PreflightReport): boolean {
  const missing = [...report.blockingMissing, ...report.recommendedMissing];
  if (missing.length === 0) return false;

  const requiredCount = report.blockingMissing.length;
  const optionalCount = report.recommendedMissing.length;
  const isInteractive = process.stdout.isTTY === true;

  if (isInteractive) {
    const summary = buildSummaryLine(requiredCount, optionalCount);
    p.log.warn(summary);

    let index = 1;
    for (const r of report.blockingMissing) {
      p.log.message(formatItem(index, r, "required"));
      index += 1;
    }
    for (const r of report.recommendedMissing) {
      p.log.message(formatItem(index, r, "recommended"));
      index += 1;
    }

    if (requiredCount > 0) {
      p.log.message(
        pc.dim(
          "Install the required items above to scaffold a working project. Optional items can be installed later.",
        ),
      );
    } else {
      p.log.message(
        pc.dim(
          "Optional items are not blocking. You can install them later when you need the related feature.",
        ),
      );
    }
  } else {
    // Plain-text fallback. Drops colors + box-drawing but preserves every word
    // a TTY user would see, on its own line, so log scrapers can grep it.
    console.log(buildPlainSummaryLine(requiredCount, optionalCount));

    let index = 1;
    for (const r of report.blockingMissing) {
      for (const line of formatPlainItem(index, r, "required")) console.log(line);
      index += 1;
    }
    for (const r of report.recommendedMissing) {
      for (const line of formatPlainItem(index, r, "recommended")) console.log(line);
      index += 1;
    }

    if (requiredCount > 0) {
      console.log(
        "Install the required items above to scaffold a working project. Optional items can be installed later.",
      );
    } else {
      console.log(
        "Optional items are not blocking. You can install them later when you need the related feature.",
      );
    }
  }

  return requiredCount > 0;
}

function buildPlainSummaryLine(requiredCount: number, optionalCount: number): string {
  const parts: string[] = [];
  if (requiredCount > 0) {
    parts.push(`${requiredCount} required ${requiredCount === 1 ? "tool" : "tools"} missing`);
  }
  if (optionalCount > 0) {
    parts.push(`${optionalCount} optional ${optionalCount === 1 ? "tool" : "tools"} missing`);
  }
  return `Prerequisite check: ${parts.join(", ")}`;
}

function formatPlainItem(
  index: number,
  r: PrereqResult,
  kind: "required" | "recommended",
): string[] {
  const badge = kind === "required" ? "[required]" : "[optional]";
  const reasonSuffix = r.check.reason ? ` - ${r.check.reason}` : "";
  const versionSuffix = r.reason ? ` [${r.reason}]` : "";
  const lines: string[] = [`${index}. ${badge} ${r.check.name}${reasonSuffix}${versionSuffix}`];
  if (r.check.installHint.command) {
    lines.push(`   install: ${r.check.installHint.command}`);
  }
  if (r.check.installHint.url) {
    lines.push(`   docs:    ${r.check.installHint.url}`);
  }
  return lines;
}

function buildSummaryLine(requiredCount: number, optionalCount: number): string {
  const parts: string[] = [];
  if (requiredCount > 0) {
    parts.push(
      pc.red(`${requiredCount} required ${requiredCount === 1 ? "tool" : "tools"} missing`),
    );
  }
  if (optionalCount > 0) {
    parts.push(
      pc.yellow(`${optionalCount} optional ${optionalCount === 1 ? "tool" : "tools"} missing`),
    );
  }
  return `Prerequisite check: ${parts.join(", ")}`;
}

function formatItem(index: number, r: PrereqResult, kind: "required" | "recommended"): string {
  const badge = kind === "required" ? pc.red("[required]") : pc.yellow("[optional]");
  const reasonSuffix = r.check.reason ? ` — ${pc.dim(r.check.reason)}` : "";
  const versionSuffix = r.reason ? ` ${pc.dim(`[${r.reason}]`)}` : "";
  const header = `${index}. ${badge} ${pc.bold(r.check.name)}${reasonSuffix}${versionSuffix}`;
  const lines: string[] = [header];
  if (r.check.installHint.command) {
    lines.push(`   install: ${pc.cyan(r.check.installHint.command)}`);
  }
  if (r.check.installHint.url) {
    lines.push(`   docs:    ${pc.cyan(r.check.installHint.url)}`);
  }
  return lines.join("\n");
}
