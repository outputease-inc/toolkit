import { isCancel, note, select } from "@clack/prompts";
import { renderDiff } from "./diff-view";
import type { PlannedAction } from "./types";

export type ConflictResolution = "overwrite" | "skip" | "apply-all" | "skip-all" | "abort";

export type PromptOptions = {
  /**
   * When true (non-TTY or --yes), every dirty update resolves to "skip"
   * without prompting.
   */
  nonInteractive: boolean;
  projectRoot: string;
};

export type PromptDeps = {
  select?: typeof select;
  isCancel?: typeof isCancel;
  note?: typeof note;
};

export type ResolvedAction = PlannedAction;

export async function resolveConflicts(
  actions: PlannedAction[],
  opts: PromptOptions,
  deps: PromptDeps = {},
): Promise<{ resolved: ResolvedAction[]; aborted: boolean }> {
  const selectImpl = deps.select ?? select;
  const isCancelImpl = deps.isCancel ?? isCancel;
  const noteImpl = deps.note ?? note;
  if (opts.nonInteractive) {
    return { resolved: actions.map(toNonInteractiveResolution), aborted: false };
  }

  const resolved: ResolvedAction[] = [];
  let bulkResolution: "apply-all" | "skip-all" | null = null;

  for (const action of actions) {
    if (action.kind !== "update" || !action.hadLocalEdits) {
      resolved.push(action);
      continue;
    }

    if (bulkResolution === "apply-all") {
      resolved.push({ ...action, resolution: "overwrite" });
      continue;
    }
    if (bulkResolution === "skip-all") {
      resolved.push({ ...action, resolution: "skip" });
      continue;
    }

    const choice = await promptOne(action, opts.projectRoot, {
      selectImpl,
      isCancelImpl,
      noteImpl,
    });
    if (choice === "abort") {
      return { resolved, aborted: true };
    }
    if (choice === "apply-all") {
      bulkResolution = "apply-all";
      resolved.push({ ...action, resolution: "overwrite" });
      continue;
    }
    if (choice === "skip-all") {
      bulkResolution = "skip-all";
      resolved.push({ ...action, resolution: "skip" });
      continue;
    }
    resolved.push({ ...action, resolution: choice });
  }

  return { resolved, aborted: false };
}

function toNonInteractiveResolution(action: PlannedAction): ResolvedAction {
  if (action.kind === "update" && action.hadLocalEdits) {
    return { ...action, resolution: "skip" };
  }
  return action;
}

type PromptOneImpls = {
  selectImpl: typeof select;
  isCancelImpl: typeof isCancel;
  noteImpl: typeof note;
};

async function promptOne(
  action: Extract<PlannedAction, { kind: "update" }>,
  projectRoot: string,
  impls: PromptOneImpls,
): Promise<ConflictResolution> {
  const { selectImpl, isCancelImpl, noteImpl } = impls;
  while (true) {
    const result = await selectImpl({
      message: `File ${action.targetPath} was modified locally.`,
      options: [
        { value: "overwrite", label: "overwrite — replace with upstream" },
        { value: "skip", label: "skip — keep local (will be flagged in summary)" },
        { value: "view-diff", label: "view diff" },
        { value: "apply-all", label: "apply all remaining" },
        { value: "skip-all", label: "skip all remaining" },
      ],
    });
    if (isCancelImpl(result)) {
      return "abort";
    }
    if (result === "view-diff") {
      const patch = await renderDiff({
        targetPath: action.targetPath,
        localPath: `${projectRoot}/${action.targetPath}`,
        stagedPath: action.sourcePath,
      });
      noteImpl(patch, "diff");
      continue;
    }
    return result as ConflictResolution;
  }
}
