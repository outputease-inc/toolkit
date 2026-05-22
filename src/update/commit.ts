import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isPathInScope, UPDATE_SCOPE, type UpdateScope } from "./manifest";
import type { PlannedAction } from "./types";

export type CommitOptions = {
  projectRoot: string;
  scope?: UpdateScope;
};

export type CommitResult = {
  written: string[];
  skipped: string[];
};

export async function commitActions(
  actions: PlannedAction[],
  opts: CommitOptions,
): Promise<CommitResult> {
  const scope = opts.scope ?? UPDATE_SCOPE;
  const written: string[] = [];
  const skipped: string[] = [];

  for (const action of actions) {
    if (!isPathInScope(action.targetPath, scope)) {
      skipped.push(action.targetPath);
      continue;
    }
    if (action.kind === "skip") {
      skipped.push(action.targetPath);
      continue;
    }
    if (action.kind === "update" && action.resolution === "skip") {
      skipped.push(action.targetPath);
      continue;
    }

    const targetAbs = join(opts.projectRoot, action.targetPath);
    await mkdir(dirname(targetAbs), { recursive: true });
    await copyFile(action.sourcePath, targetAbs);
    written.push(action.targetPath);
  }

  return { written, skipped };
}
