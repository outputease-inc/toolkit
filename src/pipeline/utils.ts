/**
 * Shared utilities for the setup-placeholders pipeline.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** File extensions to process. */
export const EXTENSIONS = new Set([
  ".md",
  ".json",
  ".js",
  ".ts",
  ".yaml",
  ".yml",
  ".toml",
  ".example",
  ".env",
]);

/** Extensionless dotfiles safe to process as text. */
export const DOTFILES = new Set([
  ".env",
  ".env.example",
  ".env.sample",
  ".env.template",
  ".gitignore",
  ".gitattributes",
  ".editorconfig",
  ".prettierrc",
  ".eslintrc",
  ".npmrc",
  ".nvmrc",
  ".node-version",
  ".python-version",
]);

/** Directories and files to skip during walk. */
export const SKIP = new Set([
  "node_modules",
  ".git",
  "lib",
  "setup-placeholders.js",
  "verify-setup.js",
  "toolkit.config.json",
]);

/** Regex matching [UPPER_SNAKE_CASE] placeholder tokens. */
export const TOKEN_REGEX = /\[[A-Z][A-Z0-9_]*\]/g;

/** Hard cap on recursion depth to guard against pathological template trees. */
const MAX_WALK_DEPTH = 32;

/**
 * Recursively walk a directory and return file paths matching EXTENSIONS/DOTFILES.
 * Skips entries in the SKIP set and symbolic links. Throws when recursion
 * exceeds `maxDepth` so a malicious or corrupted tree cannot exhaust the call
 * stack.
 */
export function walk(dir: string, maxDepth = MAX_WALK_DEPTH, depth = 0): string[] {
  if (depth > maxDepth) {
    throw new Error(`walk: directory depth exceeded ${maxDepth} at ${dir}`);
  }
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      results.push(...walk(full, maxDepth, depth + 1));
    } else if (!entry.isSymbolicLink()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (EXTENSIONS.has(ext) || DOTFILES.has(entry.name)) {
        results.push(full);
      }
    }
  }
  return results;
}

/**
 * Read a file safely, returning null on error.
 */
export function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

/**
 * Write content atomically: write to .tmp then rename.
 * Handles Windows EPERM/EEXIST errors on rename.
 */
export function writeFileAtomic(filePath: string, content: string): void {
  // Normalize line endings to LF
  const normalized = content.replace(/\r\n/g, "\n");
  const tmpPath = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tmpPath, normalized, "utf8");
    try {
      fs.renameSync(tmpPath, filePath);
    } catch (renameErr: unknown) {
      // On Windows, renameSync fails (EPERM/EEXIST) when target exists
      const code = (renameErr as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EEXIST") {
        fs.unlinkSync(filePath);
        fs.renameSync(tmpPath, filePath);
      } else {
        throw renameErr;
      }
    }
  } catch (err: unknown) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Delete a file if it exists.
 * @returns true if deleted, false if not found.
 */
export function deleteFile(filePath: string): boolean {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a directory recursively if it exists and is empty (or force).
 * @param force - if true, delete even if not empty.
 * @returns true if deleted, false otherwise.
 */
export function deleteDir(dirPath: string, force = false): boolean {
  try {
    if (force) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    } else {
      fs.rmdirSync(dirPath);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a nested property from an object using a dot-separated path.
 * @param obj - the object to traverse
 * @param dotPath - e.g. "tech_stack.runtime"
 * @returns the value at the path, or undefined if not found
 */
export function getNestedValue(obj: Record<string, unknown>, dotPath: string): unknown {
  return dotPath
    .split(".")
    .reduce(
      (acc: unknown, key: string) =>
        acc !== null &&
        acc !== undefined &&
        typeof acc === "object" &&
        key in (acc as Record<string, unknown>)
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    );
}
