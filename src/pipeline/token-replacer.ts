/**
 * Token lister: counts [TOKEN] placeholders across template files. Surfaced via
 * runListTokens for the shipped setup-placeholders.js inspector. (The mutating
 * replace path was removed in 0.2.0 with the rest of the legacy pipeline.)
 */

import { readFileSafe, walk } from "./utils";

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
