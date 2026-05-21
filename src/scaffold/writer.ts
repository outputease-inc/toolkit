import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { RollbackEntry } from "../schema/scaffold";
import type { RenderedFile } from "./renderer";

/**
 * Manages filesystem mutations and supports LIFO rollback on error.
 */
export class RollbackManager {
  private entries: RollbackEntry[] = [];

  trackFileCreated(path: string): void {
    this.entries.push({ type: "file-created", path });
  }

  trackDirCreated(path: string): void {
    this.entries.push({ type: "dir-created", path });
  }

  trackFileModified(path: string, originalContent: string): void {
    this.entries.push({ type: "file-modified", path, originalContent });
  }

  /**
   * Rollback all tracked mutations in LIFO order.
   */
  rollback(): void {
    const { rmSync } = require("node:fs") as typeof import("node:fs");
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i]!;
      try {
        switch (entry.type) {
          case "file-created":
            if (existsSync(entry.path)) rmSync(entry.path);
            break;
          case "dir-created":
            if (existsSync(entry.path)) rmSync(entry.path, { recursive: true });
            break;
          case "file-modified":
            if (entry.originalContent !== undefined) {
              writeFileSync(entry.path, entry.originalContent, "utf-8");
            }
            break;
        }
      } catch {
        // Best-effort rollback — continue with remaining entries
      }
    }
  }

  get trackedEntries(): RollbackEntry[] {
    return [...this.entries];
  }
}

export interface WriteOptions {
  targetDir: string;
  dryRun: boolean;
}

/**
 * Register a SIGINT handler that triggers rollback and exits with code 130.
 * Returns a cleanup function to remove the handler.
 */
export function registerSigintHandler(rollback: RollbackManager): () => void {
  const handler = () => {
    rollback.rollback();
    process.exit(130);
  };
  process.on("SIGINT", handler);
  return () => process.removeListener("SIGINT", handler);
}

/**
 * Validate the target directory before writing.
 * Throws if critical files exist in standalone mode.
 */
export function validateTargetDir(targetDir: string, scope: string): void {
  if (scope === "monorepo" || scope === "workspace-app" || scope === "workspace-package") {
    return; // Workspace modes handle their own validation
  }

  if (!existsSync(targetDir)) return;

  const entries = readdirSync(targetDir);
  if (entries.length === 0) return;

  const criticalFiles = ["package.json", "turbo.json"];
  const found = entries.filter((e) => criticalFiles.includes(e));
  if (found.length > 0) {
    throw new Error(
      `Target directory already contains ${found.join(", ")}. Use workspace mode or choose a different directory.`,
    );
  }
}

/**
 * Write rendered files to the target directory.
 * Tracks all mutations for rollback. Returns the scaffold result metadata.
 */
export function writeFiles(
  files: RenderedFile[],
  options: WriteOptions,
  rollback: RollbackManager,
): { filesCreated: string[]; dirsCreated: string[] } {
  const filesCreated: string[] = [];
  const dirsCreated = new Set<string>();

  const targetRoot = resolve(options.targetDir);

  for (const file of files) {
    const fullPath = join(options.targetDir, file.relativePath);
    const resolvedPath = resolve(fullPath);
    if (resolvedPath !== targetRoot && !resolvedPath.startsWith(targetRoot + sep)) {
      throw new Error(`Path traversal blocked: ${file.relativePath}`);
    }
    const dir = dirname(fullPath);

    if (!options.dryRun) {
      try {
        // Create directory if needed
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
          // Track all new directories from targetDir down
          let trackDir = dir;
          while (trackDir !== options.targetDir && !dirsCreated.has(trackDir)) {
            dirsCreated.add(trackDir);
            rollback.trackDirCreated(trackDir);
            trackDir = dirname(trackDir);
          }
        }

        writeFileSync(fullPath, file.content, "utf-8");
        rollback.trackFileCreated(fullPath);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ENOSPC") {
          throw new Error(`Disk full: cannot write ${file.relativePath}`);
        }
        if (code === "EACCES" || code === "EPERM") {
          throw new Error(`Permission denied: cannot write ${file.relativePath}`);
        }
        throw err;
      }
    }

    filesCreated.push(file.relativePath);
  }

  return {
    filesCreated,
    dirsCreated: [...dirsCreated].map((d) => relative(options.targetDir, d)),
  };
}
