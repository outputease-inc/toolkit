import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
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

/**
 * Per-file undo record captured before a write, so a mid-loop failure can be
 * rolled back to leave the project tree exactly as it was.
 */
type Undo =
  | { kind: "created"; targetAbs: string }
  | { kind: "modified"; targetAbs: string; original: Buffer };

/**
 * Apply the planned actions to the project tree atomically-per-file with
 * whole-batch rollback.
 *
 * Each write goes to a sibling temp file then `rename`s over the target (an
 * atomic replace on the same filesystem), so no target is ever observed
 * half-written. Before each write the prior content of a pre-existing target is
 * captured; if any later action throws, every file written so far is restored
 * (originals rewritten, newly-created files removed) before the error
 * propagates — so an interrupted `outputease update` never leaves a partially
 * migrated `.claude/` / `.specify/` tree.
 */
export async function commitActions(
  actions: PlannedAction[],
  opts: CommitOptions,
): Promise<CommitResult> {
  const scope = opts.scope ?? UPDATE_SCOPE;
  const written: string[] = [];
  const skipped: string[] = [];
  const undo: Undo[] = [];

  try {
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

      // Capture prior content (if any) so a later failure can restore it.
      const original = await readFile(targetAbs).catch((err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") return undefined;
        throw err;
      });

      // Stage to a sibling temp, then atomically rename over the target.
      const tmp = `${targetAbs}.tmp-${process.pid}-${undo.length}`;
      await copyFile(action.sourcePath, tmp);
      try {
        await rename(tmp, targetAbs);
      } catch (err) {
        await rm(tmp, { force: true }).catch(() => {});
        throw err;
      }

      undo.push(
        original === undefined
          ? { kind: "created", targetAbs }
          : { kind: "modified", targetAbs, original },
      );
      written.push(action.targetPath);
    }

    return { written, skipped };
  } catch (err) {
    // Roll back in LIFO order: restore modified originals, remove created files.
    for (let i = undo.length - 1; i >= 0; i--) {
      const entry = undo[i]!;
      try {
        if (entry.kind === "modified") {
          await writeFile(entry.targetAbs, entry.original);
        } else {
          await rm(entry.targetAbs, { force: true });
        }
      } catch {
        // Best-effort rollback — continue with the remaining entries.
      }
    }
    throw err;
  }
}
