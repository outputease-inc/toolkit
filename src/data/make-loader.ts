import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Build a lazy, cached loader for a bundled dataset JSON under `data/`.
 * Shared by the dev-stacks and agent-stacks loaders (previously verbatim
 * duplicates). The path resolves relative to this module's dir, which sits in
 * `src/data/` alongside the per-dataset loaders.
 */
export function makeStackLoader<T>(
  filename: string,
  schema: { parse(data: unknown): T[] },
): { load(): T[]; getPath(): string } {
  const dataPath = path.resolve(import.meta.dirname ?? ".", "..", "..", "data", filename);
  let cache: T[] | null = null;

  return {
    load(): T[] {
      if (cache) return cache;
      const raw = fs.readFileSync(dataPath, "utf-8");
      cache = schema.parse(JSON.parse(raw));
      return cache;
    },
    getPath(): string {
      return dataPath;
    },
  };
}
