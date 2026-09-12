import { readFile } from "node:fs/promises";
import { createTwoFilesPatch } from "diff";

export type DiffViewOptions = {
  targetPath: string;
  localPath: string;
  stagedPath: string;
  contextLines?: number;
};

export async function renderDiff(opts: DiffViewOptions): Promise<string> {
  const { targetPath, localPath, stagedPath, contextLines = 3 } = opts;
  const [local, upstream] = await Promise.all([safeRead(localPath), safeRead(stagedPath)]);
  return createTwoFilesPatch(
    `${targetPath} (local)`,
    `${targetPath} (upstream)`,
    local,
    upstream,
    undefined,
    undefined,
    { context: contextLines },
  );
}

async function safeRead(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw err;
  }
}
