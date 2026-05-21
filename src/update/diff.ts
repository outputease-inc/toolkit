import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { isPathInScope, toStagedPath, UPDATE_SCOPE, type UpdateScope } from "./manifest";
import type { PlannedAction } from "./types";

export type DiffOptions = {
  projectRoot: string;
  stagedRoot: string;
  scope?: UpdateScope;
};

export async function computeDiff(opts: DiffOptions): Promise<PlannedAction[]> {
  const scope = opts.scope ?? UPDATE_SCOPE;
  const actions: PlannedAction[] = [];

  for (const dir of scope.directories) {
    await walkAndCompare(opts.projectRoot, opts.stagedRoot, dir, scope, actions);
  }
  for (const file of scope.rootFiles) {
    await compareFile(opts.projectRoot, opts.stagedRoot, file, scope, actions);
  }

  return actions;
}

async function walkAndCompare(
  projectRoot: string,
  stagedRoot: string,
  scopeDir: string,
  scope: UpdateScope,
  actions: PlannedAction[],
): Promise<void> {
  const stagedDirAbs = join(stagedRoot, toStagedPath(scopeDir, scope));
  const stagedPrefixBase = scope.sourcePrefix ? join(stagedRoot, scope.sourcePrefix) : stagedRoot;
  await walkStaged(stagedDirAbs, stagedPrefixBase, async (stagedAbs) => {
    const rel = toPosix(relative(stagedPrefixBase, stagedAbs));
    if (!isPathInScope(rel, scope)) {
      actions.push({ kind: "skip", targetPath: rel, reason: "out-of-scope" });
      return;
    }
    const projectAbs = join(projectRoot, rel);
    await classifyFile(projectAbs, stagedAbs, rel, actions);
  });
}

async function compareFile(
  projectRoot: string,
  stagedRoot: string,
  rel: string,
  scope: UpdateScope,
  actions: PlannedAction[],
): Promise<void> {
  if (!isPathInScope(rel, scope)) {
    return;
  }
  const stagedAbs = join(stagedRoot, toStagedPath(rel, scope));
  if (!(await pathExists(stagedAbs))) {
    return;
  }
  const projectAbs = join(projectRoot, rel);
  await classifyFile(projectAbs, stagedAbs, rel, actions);
}

async function classifyFile(
  projectAbs: string,
  stagedAbs: string,
  rel: string,
  actions: PlannedAction[],
): Promise<void> {
  const exists = await pathExists(projectAbs);
  if (!exists) {
    actions.push({ kind: "add", targetPath: rel, sourcePath: stagedAbs });
    return;
  }
  const [localBuf, stagedBuf] = await Promise.all([readFile(projectAbs), readFile(stagedAbs)]);
  if (localBuf.equals(stagedBuf)) {
    actions.push({ kind: "skip", targetPath: rel, reason: "unchanged" });
    return;
  }
  actions.push({
    kind: "update",
    targetPath: rel,
    sourcePath: stagedAbs,
    hadLocalEdits: true,
    resolution: "skip",
  });
}

async function walkStaged(
  startAbs: string,
  stagedRoot: string,
  visit: (absPath: string) => Promise<void>,
): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(startAbs);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw err;
  }
  for (const name of entries) {
    const abs = join(startAbs, name);
    const info = await stat(abs);
    if (info.isDirectory()) {
      await walkStaged(abs, stagedRoot, visit);
    } else if (info.isFile()) {
      await visit(abs);
    }
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

function toPosix(p: string): string {
  return p.split(sep).join("/");
}
