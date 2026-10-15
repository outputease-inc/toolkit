import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const SCRATCH_DIRS = new Set([".outputease-staging", ".outputease-tmp", ".oe-scratch"]);

const TMP_PREFIX_RE = /^\.tmp-/;

export type CleanupReport = {
  removed: string[];
};

export async function cleanupScratch(targetPath: string): Promise<CleanupReport> {
  const removed: string[] = [];
  let entries: string[];
  try {
    entries = await readdir(targetPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { removed };
    }
    throw err;
  }

  for (const name of entries) {
    const matchesTmp = TMP_PREFIX_RE.test(name);
    const matchesScratch = SCRATCH_DIRS.has(name);
    if (!(matchesTmp || matchesScratch)) {
      continue;
    }
    const full = join(targetPath, name);
    try {
      const info = await stat(full);
      if (info.isDirectory() || info.isFile()) {
        await rm(full, { recursive: true, force: true });
        removed.push(name);
      }
    } catch {
      // Race / permission — skip silently. cleanup is best-effort.
    }
  }

  return { removed };
}
