import { paint, role } from "../colors/brand-ansi";
import type { UpdateRunSummary } from "./types";

export function renderSummary(summary: UpdateRunSummary): string {
  const counts = countActions(summary);
  const divergeLabel = summary.versionDiverged ? " (diverged from installed)" : "";
  const resultText = summary.result;
  const styledResult =
    summary.result === "success"
      ? role(resultText, "success")
      : summary.result === "error"
        ? role(resultText, "error")
        : role(resultText, "info");
  const lines = [
    paint("outputease update — summary", "lilac"),
    "───────────────────────────",
    `Toolkit installed: ${summary.installedToolkitVersion}`,
    `Upstream SHA:      ${summary.upstreamSha}`,
    `Marker version:    ${summary.markerVersion}${divergeLabel}`,
    "",
    "Planned actions:",
    `  ${paint("+", "paleCyan")}  ${counts.added} added`,
    `  ~  ${counts.updatedClean} updated (clean)`,
    `  ${paint("!", "salmon")}  ${counts.overwritten} updated (overwritten — local edits replaced)`,
    `  ⊘  ${counts.skipped} skipped (local edits preserved)`,
    `  •  ${counts.unchanged} unchanged`,
    "",
    `Result: ${styledResult}`,
  ];
  return lines.join("\n");
}

export type ActionCounts = {
  added: number;
  updatedClean: number;
  overwritten: number;
  skipped: number;
  unchanged: number;
  outOfScope: number;
};

export function countActions(summary: Pick<UpdateRunSummary, "actions">): ActionCounts {
  const counts: ActionCounts = {
    added: 0,
    updatedClean: 0,
    overwritten: 0,
    skipped: 0,
    unchanged: 0,
    outOfScope: 0,
  };
  for (const a of summary.actions) {
    if (a.kind === "add") {
      counts.added += 1;
    } else if (a.kind === "update") {
      if (!a.hadLocalEdits) {
        counts.updatedClean += 1;
      } else if (a.resolution === "overwrite") {
        counts.overwritten += 1;
      } else {
        counts.skipped += 1;
      }
    } else if (a.kind === "skip") {
      if (a.reason === "unchanged") {
        counts.unchanged += 1;
      } else if (a.reason === "user-skipped") {
        counts.skipped += 1;
      } else {
        counts.outOfScope += 1;
      }
    }
  }
  return counts;
}
