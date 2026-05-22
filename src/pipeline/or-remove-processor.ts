/**
 * _OR_REMOVE Processor -- Phase 3 of the setup pipeline.
 *
 * Context-aware removal of [*_OR_REMOVE] tokens.
 * When a feature flag is false or the config value is empty,
 * removes the surrounding structure (table row, bullet, heading+content, etc.)
 * rather than leaving malformed markdown.
 *
 * CRITICAL: This module (Phase 3) must run BEFORE token-replacer (Phase 4).
 * Tokens like [X_OR_REMOVE] would be replaced with values before OR_REMOVE
 * logic could evaluate them.
 */

import * as path from "node:path";
import { readFileSafe, walk, writeFileAtomic } from "./utils";

// ---- Types ------------------------------------------------------------------

/** Context type for a line containing an _OR_REMOVE token. */
type RemovalContext = "table_row" | "bullet" | "heading" | "tree_line" | "inline";

/** A single file's processing result. */
export interface OrRemoveFileResult {
  file: string;
  removals: number;
}

/** Result of processing all files. */
export interface OrRemoveResult {
  processed: OrRemoveFileResult[];
}

/** Result of processing a single file's content. */
export interface ProcessFileContentResult {
  content: string;
  removals: number;
}

// ---- Feature-flag mapping for _OR_REMOVE tokens -----------------------------
// Maps token name -> feature flag that controls it.
// Tokens not listed here are removed when their value is empty.

export const OR_REMOVE_FLAGS: Record<string, string> = {
  DATABASE_OR_REMOVE: "has_database",
  AUTH_PROVIDER_OR_REMOVE: "has_auth",
  MFA_SUPPORT_OR_REMOVE: "has_mfa",
  ADDITIONAL_ROLES_OR_REMOVE: "has_auth",
  ADDITIONAL_ROUTE_RULES_OR_REMOVE: "has_auth",
  ADDITIONAL_AUTH_VARS_OR_REMOVE: "has_auth",
  STAGING_ENV_OR_REMOVE: "has_staging_env",
  STAGING_DOMAIN_OR_REMOVE: "has_staging_env",
  WWW_DOMAIN_OR_REMOVE: "has_staging_env",
  DEPENDABOT_OR_RENOVATE_OR_REMOVE: "has_dependabot",
  TEST_INTEGRATION_COMMAND_OR_REMOVE: "has_integration_tests",
  TEST_E2E_COMMAND_OR_REMOVE: "has_e2e_tests",
  TYPECHECK_COMMAND_OR_REMOVE: "has_typecheck",
  FORMAT_ON_SAVE_OR_REMOVE: "has_format_on_save",
  SMOKE_TEST_COMMAND_OR_REMOVE: "has_staging_env",
  ENV_TEST_OR_REMOVE: "has_e2e_tests",
};

// ---- Inline removal hints ---------------------------------------------------
// For tokens embedded inline (not on their own line), specify what to strip.

const INLINE_HINTS: Record<string, string> = {
  HEADER_ACTIONS_OR_REMOVE: ", [HEADER_ACTIONS_OR_REMOVE]",
  ENV_TEST_OR_REMOVE: " [ENV_TEST_OR_REMOVE]",
  CODE_SPLIT_OR_REMOVE: " [CODE_SPLIT_OR_REMOVE]",
  BUNDLE_BUDGET_TOOL_OR_REMOVE: "[BUNDLE_BUDGET_TOOL_OR_REMOVE]",
};

/**
 * Determine if an _OR_REMOVE token should be removed.
 * @param tokenName - e.g. "DATABASE_OR_REMOVE"
 * @param features - config.features
 * @param tokenMap - resolved token values
 * @returns true if the token should trigger removal
 */
export function shouldRemove(
  tokenName: string,
  features: Record<string, boolean | string>,
  tokenMap: Map<string, string>,
): boolean {
  const flag = OR_REMOVE_FLAGS[tokenName];
  if (flag !== undefined) {
    // Mapped to a feature flag
    return !features[flag];
  }
  // Not mapped -- remove if no value is provided in the token map
  return !tokenMap.has(tokenName);
}

/**
 * Detect the removal context of a line containing an _OR_REMOVE token.
 */
function detectContext(line: string, _tokenName: string, inCodeBlock: boolean): RemovalContext {
  const trimmed = line.trimStart();

  // Table row: starts with |
  if (trimmed.startsWith("|")) return "table_row";

  // Bullet / list item: starts with -, *, or +
  if (/^[-*+]\s/.test(trimmed)) return "bullet";

  // Section heading: starts with ## or ###
  if (/^#{2,4}\s/.test(trimmed)) return "heading";

  // Tree line inside fenced code block
  if (inCodeBlock) return "tree_line";

  return "inline";
}

/**
 * Process all files for _OR_REMOVE tokens.
 * @param root - toolkit root directory
 * @param features - config.features
 * @param tokenMap - resolved token values
 * @param apply - if false, dry-run mode
 */
export function processOrRemove(
  root: string,
  features: Record<string, boolean | string>,
  tokenMap: Map<string, string>,
  apply: boolean,
): OrRemoveResult {
  const files = walk(root);
  const processed: OrRemoveFileResult[] = [];

  for (const filePath of files) {
    const content = readFileSafe(filePath);
    if (!content) continue;

    // Quick check: does the file contain any _OR_REMOVE tokens?
    if (!content.includes("_OR_REMOVE")) continue;

    const result = processFileContent(content, features, tokenMap);
    if (result.removals === 0) continue;

    const rel = path.relative(root, filePath);
    processed.push({ file: rel, removals: result.removals });

    if (apply) {
      writeFileAtomic(filePath, result.content);
    }
  }

  return { processed };
}

/**
 * Process a single file's content for _OR_REMOVE tokens.
 */
export function processFileContent(
  content: string,
  features: Record<string, boolean | string>,
  tokenMap: Map<string, string>,
): ProcessFileContentResult {
  const lines = content.split("\n");
  const result: string[] = [];
  let removals = 0;
  let inCodeBlock = false;
  let skipUntilHeadingLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    // Track fenced code blocks
    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
    }

    // If we're skipping content after a heading removal, check for next heading
    // (only outside code blocks -- a "## " inside a fenced block isn't a real heading)
    if (skipUntilHeadingLevel > 0) {
      const headingMatch = !inCodeBlock ? line.match(/^(#{2,4})\s/) : null;
      if (headingMatch?.[1] && headingMatch[1].length <= skipUntilHeadingLevel) {
        skipUntilHeadingLevel = 0;
        // This line is the next heading -- keep it
      } else {
        // Still in the removed section
        continue;
      }
    }

    // Find _OR_REMOVE tokens in this line
    const orRemoveTokens: string[] = [];
    const tokenMatches = line.matchAll(/\[([A-Z][A-Z0-9_]*_OR_REMOVE[A-Z0-9_]*)\]/g);
    for (const match of tokenMatches) {
      if (match[1]) orRemoveTokens.push(match[1]);
    }

    if (orRemoveTokens.length === 0) {
      result.push(line);
      continue;
    }

    // Check if any token in this line should trigger removal
    const tokensToRemove = orRemoveTokens.filter((t) => shouldRemove(t, features, tokenMap));

    if (tokensToRemove.length === 0) {
      // All _OR_REMOVE tokens on this line have values -- leave line as-is
      // (they'll be replaced by the token-replacer phase)
      result.push(line);
      continue;
    }

    // Determine context and act
    const firstToken = tokensToRemove[0];
    if (!firstToken) continue;
    const context = detectContext(line, firstToken, inCodeBlock);

    switch (context) {
      case "table_row":
      case "bullet":
      case "tree_line":
        // Delete entire line
        removals++;
        break;

      case "heading": {
        // Delete heading + all content until next same-level or higher heading
        const headingMatch = line.match(/^(#{2,4})\s/);
        skipUntilHeadingLevel = headingMatch?.[1] ? headingMatch[1].length : 0;
        removals++;
        break;
      }

      case "inline": {
        // Remove the token text + surrounding delimiters
        let modified: string = line;
        for (const tokenName of tokensToRemove) {
          const hint = INLINE_HINTS[tokenName];
          if (hint) {
            modified = modified.replace(hint, "");
          } else {
            // Generic inline removal: remove [TOKEN] and surrounding comma/space
            modified = modified.replace(new RegExp(`,?\\s*\\[${tokenName}\\]`), "");
          }
        }
        // Only keep the line if it still has meaningful content
        if (modified.trim()) {
          result.push(modified);
        }
        removals++;
        break;
      }
    }
  }

  // Collapse consecutive blank lines to max 1
  const collapsed: string[] = [];
  let prevBlank = false;
  for (const line of result) {
    const isBlank = line.trim() === "";
    if (isBlank && prevBlank) continue;
    collapsed.push(line);
    prevBlank = isBlank;
  }

  return { content: collapsed.join("\n"), removals };
}
