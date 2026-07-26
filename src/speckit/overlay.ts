import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SPECKIT_REF } from "./pin";

/**
 * Post-fetch overlay: re-applies OutputEase's archive-aware feature numbering
 * to the spec-kit scripts that `specify init` (and `specify extension add git`)
 * write into a project.
 *
 * The toolkit ships no spec-kit script body. Only the OE-authored lines in the
 * rules below travel, injected by anchor into the freshly fetched vanilla file.
 * Anchors face exactly `SPECKIT_REF` (see `./pin`); a cosmetic upstream reflow
 * is expected to break them, which is why every failure shape is loud.
 */

/** One anchored sub-edit. Edits inside a rule are applied in array order. */
export interface OverlayEdit {
  /** Must match exactly `expect` times in the vanilla file. */
  anchor: RegExp;
  /** 1 for inserts, 3 for the git-extension call-site swaps. */
  expect: number;
  /** Replacement text for the matched region. */
  apply: (m: RegExpMatchArray) => string;
}

export interface OverlayRule {
  /** Project-relative path, POSIX separators. */
  file: string;
  /**
   * Governs the *absent file* case ONLY. It never relaxes a file that is
   * present but unpatchable — that is always a hard failure.
   */
  required: boolean;
  /** Already-applied detector; drives idempotency and post-write verification. */
  probe: RegExp;
  edits: OverlayEdit[];
}

/** An edit's anchor did not match exactly `expect` times. */
export class OverlayAnchorError extends Error {
  constructor(
    readonly file: string,
    readonly editIndex: number,
    readonly expected: number,
    readonly found: number,
  ) {
    super(
      `anchor not found in ${file} (edit ${editIndex}: expected ${expected} match(es), found ${found})`,
    );
    this.name = "OverlayAnchorError";
  }
}

/** Every edit applied, but the probe still does not match. */
export class OverlayVerifyError extends Error {
  constructor(readonly file: string) {
    super(`overlay applied to ${file} but the probe did not match afterwards`);
    this.name = "OverlayVerifyError";
  }
}

/** Fresh global clone, so `lastIndex` never leaks between calls. */
function globalize(re: RegExp): RegExp {
  return new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
}

/** Count non-overlapping matches of `re` in `source`. */
export function countMatches(source: string, re: RegExp): number {
  return [...source.matchAll(globalize(re))].length;
}

/**
 * Apply one rule to file text. Pure — no I/O.
 *
 * Splices with slice/concat rather than `String.prototype.replace`, so `$&`,
 * `$1`, `$$` and the bash `$(...)` / `$((...))` payloads are never
 * reinterpreted as replacement patterns.
 */
export function applyOverlay(source: string, rule: OverlayRule): string {
  if (countMatches(source, rule.probe) > 0) return source;

  let out = source;
  for (const [index, edit] of rule.edits.entries()) {
    const matches = [...out.matchAll(globalize(edit.anchor))];
    if (matches.length !== edit.expect) {
      throw new OverlayAnchorError(rule.file, index, edit.expect, matches.length);
    }
    let next = "";
    let cursor = 0;
    for (const match of matches) {
      const start = match.index ?? 0;
      next += out.slice(cursor, start) + edit.apply(match);
      cursor = start + match[0].length;
    }
    out = next + out.slice(cursor);
  }

  if (countMatches(out, rule.probe) === 0) {
    throw new OverlayVerifyError(rule.file);
  }
  return out;
}

/**
 * R1 — core bash. Calls upstream's own `get_highest_from_specs` a second time
 * against `archive/specs/` and folds the max; it never duplicates upstream's
 * scan body. Anchor verified: 1 match in vanilla v0.12.3.
 */
export const R1_CORE_BASH: OverlayRule = {
  file: ".specify/scripts/bash/create-new-feature.sh",
  // `specify init --script sh` writes bash only and `--script ps` writes
  // powershell only, so exactly one of R1/R2 exists in any real project.
  // Absence is therefore normal; a PRESENT-but-unpatchable file is not, and
  // that case fails loud regardless of this flag.
  required: false,
  probe: /^ {8}HIGHEST_ARCHIVED=\$\(get_highest_from_specs "\$REPO_ROOT\/archive\/specs"\)$/m,
  edits: [
    {
      anchor: /^ {8}HIGHEST=\$\(get_highest_from_specs "\$SPECS_DIR"\)$/m,
      expect: 1,
      apply: (m) =>
        [
          "        # LOCAL PATCH (archive-aware numbering): finished specs move to",
          "        # archive/specs/, so the scan must cover both trees or archived numbers",
          "        # get reused. Diverges from upstream spec-kit -- reapply after upgrades;",
          "        # guarded by packages/toolkit/src/__tests__/speckit-numbering.test.ts.",
          "        # Keep in parity with the PowerShell twin.",
          m[0],
          '        HIGHEST_ARCHIVED=$(get_highest_from_specs "$REPO_ROOT/archive/specs")',
          '        if [ "$HIGHEST_ARCHIVED" -gt "$HIGHEST" ]; then',
          "            HIGHEST=$HIGHEST_ARCHIVED",
          "        fi",
        ].join("\n"),
    },
  ],
};

/**
 * R2 — core powershell. NOTE: the comment payload carries a real em-dash
 * (U+2014), matching the live patched file byte for byte. Do not replace it
 * with `--`; the equivalence test in overlay.test.ts will fail.
 * Anchor verified: 1 match in vanilla v0.12.3.
 */
export const R2_CORE_PWSH: OverlayRule = {
  file: ".specify/scripts/powershell/create-new-feature.ps1",
  required: false,
  probe:
    /^ {8}\$highestArchived = Get-HighestNumberFromSpecs -SpecsDir \(Join-Path \$repoRoot 'archive\/specs'\)$/m,
  edits: [
    {
      anchor: /^ {8}\$Number = \(Get-HighestNumberFromSpecs -SpecsDir \$specsDir\) \+ 1$/m,
      expect: 1,
      apply: () =>
        [
          "        # LOCAL PATCH (archive-aware numbering): finished specs move to",
          "        # archive/specs/, so the scan must cover both trees or archived numbers",
          "        # get reused. Diverges from upstream spec-kit — reapply after upgrades;",
          "        # guarded by packages/toolkit/src/__tests__/speckit-numbering.test.ts.",
          "        $highestActive = Get-HighestNumberFromSpecs -SpecsDir $specsDir",
          "        $highestArchived = Get-HighestNumberFromSpecs -SpecsDir (Join-Path $repoRoot 'archive/specs')",
          "        $Number = [Math]::Max($highestActive, $highestArchived) + 1",
        ].join("\n"),
    },
  ],
};

/**
 * R3 — git-extension bash (the path /speckit-specify actually exercises via
 * its before_specify hook). Two edits, and the ORDER MATTERS: the call-site
 * swap runs first, because the wrapper inserted by edit 1 itself calls
 * `get_highest_from_specs`. Insert-first would make edit 0 see 4 matches
 * instead of 3 (loud failure) — and if it somehow did not, the wrapper would
 * recurse forever. Anchors verified: 3 call sites, 1 insert point.
 */
export const R3_EXT_BASH: OverlayRule = {
  file: ".specify/extensions/git/scripts/bash/create-new-feature-branch.sh",
  // The git extension is opt-in (`specify extension add git`), so absence is
  // routine. Present-but-unpatchable still fails loud.
  required: false,
  probe: /^get_highest_from_all_specs\(\) \{$/m,
  edits: [
    {
      anchor: /\$\(get_highest_from_specs "\$(?:specs_dir|SPECS_DIR)"\)/g,
      expect: 3,
      apply: (m) => m[0].replace("get_highest_from_specs", "get_highest_from_all_specs"),
    },
    {
      anchor: /^# Function to get highest number from git branches$/m,
      expect: 1,
      apply: (m) =>
        [
          "# LOCAL PATCH (archive-aware numbering): finished specs move to archive/specs/,",
          "# so the scan must cover both trees or archived numbers get reused. Diverges",
          "# from upstream spec-kit -- reapply after upgrades; guarded by",
          "# packages/toolkit/src/__tests__/speckit-numbering.test.ts.",
          "# Keep in parity with the PowerShell twin and the core create-new-feature.sh.",
          "get_highest_from_all_specs() {",
          '    local specs_dir="$1"',
          '    local highest=$(get_highest_from_specs "$specs_dir")',
          '    local archived=$(get_highest_from_specs "$(dirname "$specs_dir")/archive/specs")',
          '    if [ "$archived" -gt "$highest" ]; then',
          "        highest=$archived",
          "    fi",
          '    echo "$highest"',
          "}",
          "",
          m[0],
        ].join("\n"),
    },
  ],
};

/**
 * R4 — git-extension powershell. Same swap-then-insert ordering as R3; the
 * wrapper body contains two `Get-HighestNumberFromSpecs -SpecsDir` calls, so
 * insert-first would make edit 0 see 5 matches instead of 3.
 * Anchors verified: 3 call sites, 1 insert point.
 */
export const R4_EXT_PWSH: OverlayRule = {
  file: ".specify/extensions/git/scripts/powershell/create-new-feature-branch.ps1",
  required: false,
  probe: /^function Get-HighestNumberFromAllSpecs \{$/m,
  edits: [
    {
      anchor: /Get-HighestNumberFromSpecs -SpecsDir/g,
      expect: 3,
      apply: (m) => m[0].replace("Get-HighestNumberFromSpecs", "Get-HighestNumberFromAllSpecs"),
    },
    {
      anchor: /^function Get-HighestNumberFromNames \{$/m,
      expect: 1,
      apply: (m) =>
        [
          "# LOCAL PATCH (archive-aware numbering): finished specs move to archive/specs/,",
          "# so the scan must cover both trees or archived numbers get reused. Diverges",
          "# from upstream spec-kit -- reapply after upgrades; guarded by",
          "# packages/toolkit/src/__tests__/speckit-numbering.test.ts.",
          "# Keep in parity with the bash twin and the core create-new-feature.ps1.",
          "function Get-HighestNumberFromAllSpecs {",
          "    param([string]$SpecsDir)",
          "",
          "    $highestActive = Get-HighestNumberFromSpecs -SpecsDir $SpecsDir",
          "    $archiveDir = Join-Path (Split-Path -Parent $SpecsDir) 'archive/specs'",
          "    $highestArchived = Get-HighestNumberFromSpecs -SpecsDir $archiveDir",
          "    return [Math]::Max($highestActive, $highestArchived)",
          "}",
          "",
          m[0],
        ].join("\n"),
    },
  ],
};

/** Every rule, in the order `applyOverlayToDir` walks them. */
export const OVERLAY_RULES: readonly OverlayRule[] = [
  R1_CORE_BASH,
  R2_CORE_PWSH,
  R3_EXT_BASH,
  R4_EXT_PWSH,
];

export type OverlayStatus = "applied" | "already" | "skipped" | "anchorMissing" | "verifyFailed";

export interface OverlayFileResult {
  file: string;
  status: OverlayStatus;
  /** Human-readable detail. Absent only on `applied` / `already`. */
  detail?: string;
}

export interface OverlayReport {
  results: OverlayFileResult[];
  /** Lines for `PostInstallResult.errors`; empty exactly when `ok`. */
  errors: string[];
  ok: boolean;
}

const FAILED: ReadonlySet<OverlayStatus> = new Set<OverlayStatus>([
  "anchorMissing",
  "verifyFailed",
]);

function report(results: OverlayFileResult[]): OverlayReport {
  const errors = results
    .filter((result) => FAILED.has(result.status))
    .map(
      (result) =>
        `archive-aware numbering NOT applied: ${result.detail ?? result.status} ` +
        "Feature numbering will reuse archived numbers once archive/specs/ exists. " +
        "Re-run: outputease speckit verify",
    );
  return { results, errors, ok: errors.length === 0 };
}

/** Absent-file outcome. This is the ONLY place `rule.required` is consulted. */
function absentResult(rule: OverlayRule): OverlayFileResult {
  return rule.required
    ? {
        file: rule.file,
        status: "anchorMissing",
        detail: `file not found: ${rule.file} (expected spec-kit ${SPECKIT_REF}).`,
      }
    : { file: rule.file, status: "skipped", detail: "not installed" };
}

/**
 * Apply every rule to a project directory, in place.
 *
 * A file that is PRESENT but unpatchable is always a hard failure, whatever
 * `rule.required` says — `required` covers absence only. A present-but-
 * unpatchable git extension silently yielding vanilla numbering is the sharpest
 * correctness edge in this design and must not be reachable.
 *
 * Never throws for an overlay-shaped failure; it reports. `init` degrades
 * rather than aborts, matching the existing post-install posture.
 */
export function applyOverlayToDir(
  projectDir: string,
  rules: readonly OverlayRule[] = OVERLAY_RULES,
): OverlayReport {
  const results: OverlayFileResult[] = [];

  for (const rule of rules) {
    const abs = join(projectDir, ...rule.file.split("/"));

    if (!existsSync(abs)) {
      results.push(absentResult(rule));
      continue;
    }

    const source = readFileSync(abs, "utf8");
    if (countMatches(source, rule.probe) > 0) {
      results.push({ file: rule.file, status: "already" });
      continue;
    }

    let patched: string;
    try {
      patched = applyOverlay(source, rule);
    } catch (err) {
      if (err instanceof OverlayAnchorError) {
        results.push({
          file: rule.file,
          status: "anchorMissing",
          detail: `${err.message} (expected spec-kit ${SPECKIT_REF}).`,
        });
        continue;
      }
      if (err instanceof OverlayVerifyError) {
        results.push({ file: rule.file, status: "verifyFailed", detail: `${err.message}.` });
        continue;
      }
      throw err;
    }

    // Truncating write; the scripts' executable bit is preserved.
    writeFileSync(abs, patched, "utf8");

    if (countMatches(readFileSync(abs, "utf8"), rule.probe) === 0) {
      results.push({
        file: rule.file,
        status: "verifyFailed",
        detail: `probe did not match after writing ${rule.file}.`,
      });
      continue;
    }

    results.push({ file: rule.file, status: "applied" });
  }

  return report(results);
}

/**
 * Probe-only inspection for `outputease speckit verify`. Writes nothing.
 *
 * A present file whose anchors are intact but whose patch is absent reports
 * `verifyFailed` — the file is not in the verified state, and calling it
 * `anchorMissing` would be untrue.
 */
export function verifyOverlay(
  projectDir: string,
  rules: readonly OverlayRule[] = OVERLAY_RULES,
): OverlayReport {
  const results: OverlayFileResult[] = [];

  for (const rule of rules) {
    const abs = join(projectDir, ...rule.file.split("/"));

    if (!existsSync(abs)) {
      results.push(absentResult(rule));
      continue;
    }

    const source = readFileSync(abs, "utf8");
    if (countMatches(source, rule.probe) > 0) {
      results.push({ file: rule.file, status: "already" });
      continue;
    }

    const broken = rule.edits.findIndex(
      (edit) => countMatches(source, edit.anchor) !== edit.expect,
    );
    if (broken === -1) {
      results.push({
        file: rule.file,
        status: "verifyFailed",
        detail: `overlay not applied to ${rule.file}; anchors are intact.`,
      });
      continue;
    }

    const anchorError = new OverlayAnchorError(
      rule.file,
      broken,
      rule.edits[broken]?.expect ?? 0,
      countMatches(source, rule.edits[broken]?.anchor ?? /$^/),
    );
    results.push({
      file: rule.file,
      status: "anchorMissing",
      detail: `${anchorError.message} (expected spec-kit ${SPECKIT_REF}).`,
    });
  }

  return report(results);
}
