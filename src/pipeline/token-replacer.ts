/**
 * Token Replacer -- Phase 4 of the setup pipeline.
 *
 * Standard [TOKEN] find-replace across all files.
 * Extracted and enhanced from the original setup-placeholders.js.
 */

import * as path from "node:path";
import { readFileSafe, walk, writeFileAtomic } from "./utils";

// ---- Types ------------------------------------------------------------------

/** Result of a token replacement run. */
export interface ReplaceTokensResult {
  filesChanged: number;
  totalReplacements: number;
  remaining: Map<string, string[]>;
}

/**
 * Replace all tokens in toolkit template files.
 * @param root - toolkit root directory
 * @param tokenMap - token name -> replacement value
 * @param apply - if false, dry-run mode
 */
export function replaceTokens(
  root: string,
  tokenMap: Map<string, string>,
  apply: boolean,
): ReplaceTokensResult {
  const files = walk(root);
  let totalReplacements = 0;
  let filesChanged = 0;
  const remaining = new Map<string, string[]>();

  // Convert token map to sorted entries (longer tokens first to avoid partial matches)
  const entries = [...tokenMap.entries()].sort((a, b) => b[0].length - a[0].length);

  for (const filePath of files) {
    const content = readFileSafe(filePath);
    if (content === null) continue;

    let changed = content;
    let fileCount = 0;

    for (const [tokenName, value] of entries) {
      const token = `[${tokenName}]`;
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "g");
      const matches = changed.match(regex);
      if (matches) {
        fileCount += matches.length;
        // Escape special characters for JSON files
        const isJson = filePath.endsWith(".json");
        const safeValue = isJson
          ? value
              .replace(/\\/g, "\\\\")
              .replace(/"/g, '\\"')
              .replace(/\n/g, "\\n")
              .replace(/\r/g, "\\r")
              .replace(/\t/g, "\\t")
          : value;
        changed = changed.replace(regex, () => safeValue);
      }
    }

    if (fileCount > 0) {
      totalReplacements += fileCount;
      filesChanged++;
      if (apply) {
        writeFileAtomic(filePath, changed);
      }
    }

    // Check for remaining unfilled placeholders
    const leftover = changed.match(/\[[A-Z][A-Z0-9_]*\]/g);
    if (leftover) {
      remaining.set(path.relative(root, filePath), [...new Set(leftover)]);
    }
  }

  return { filesChanged, totalReplacements, remaining };
}

/**
 * List all tokens found across toolkit template files.
 * @param root - toolkit root directory
 * @returns token -> count
 */
export function listTokens(root: string): Map<string, number> {
  const files = walk(root);
  const tokenCounts = new Map<string, number>();

  for (const filePath of files) {
    const content = readFileSafe(filePath);
    if (content === null) continue;
    const matches = content.match(/\[[A-Z][A-Z0-9_]*\]/g);
    if (matches) {
      for (const m of matches) {
        tokenCounts.set(m, (tokenCounts.get(m) || 0) + 1);
      }
    }
  }

  return tokenCounts;
}
