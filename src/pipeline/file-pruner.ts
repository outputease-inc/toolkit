/**
 * File Pruner -- Phase 2 of the setup pipeline.
 *
 * Deletes whole files and directories based on feature flags.
 * After deletion, cleans up references in INDEX.md and AGENTS-INDEX.md.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { deleteDir, deleteFile, readFileSafe, writeFileAtomic } from "./utils";

// ---- Types ------------------------------------------------------------------

/** Result of a prune operation. */
export interface PruneResult {
  deleted: string[];
  cleaned: string[];
}

// ---- Feature-flag-to-file manifest ------------------------------------------
// When a feature flag is false, these files are deleted.

export const FILE_MANIFEST: Record<string, string[]> = {
  has_frontend: [
    "docs/design.md",
    "docs/performance.md",
    "docs/infrastructure.md",
    ".claude/skills/a11y-review/SKILL.md",
    ".claude/skills/new-component/SKILL.md",
    ".claude/agents/accessibility-reviewer.md",
    ".claude/agents/i18n-reviewer.md",
  ],
  has_auth: ["docs/auth.md"],
  has_database: ["docs/database.md"],
  has_ci: ["docs/cicd.md"],
};

/**
 * Prune files based on feature flags.
 * @param root - toolkit root directory
 * @param features - the features section of config
 * @param apply - if false, dry-run mode
 */
export function pruneFiles(
  root: string,
  features: Record<string, boolean | string>,
  apply: boolean,
): PruneResult {
  const deleted: string[] = [];
  const cleaned: string[] = [];

  for (const [flag, files] of Object.entries(FILE_MANIFEST)) {
    // If feature is enabled, keep files
    if (features[flag]) continue;

    for (const relPath of files) {
      const fullPath = path.join(root, relPath);
      if (!fs.existsSync(fullPath)) continue;

      if (apply) {
        deleteFile(fullPath);

        // If we deleted a SKILL.md, try to remove the now-empty parent dir
        if (relPath.endsWith("SKILL.md")) {
          const parentDir = path.dirname(fullPath);
          deleteDir(parentDir); // only succeeds if empty
        }
      }

      deleted.push(relPath);
    }
  }

  // Clean up INDEX.md references to deleted files
  if (deleted.length > 0) {
    const indexCleaned = cleanIndexReferences(root, deleted, apply);
    cleaned.push(...indexCleaned);

    const agentsCleaned = cleanAgentsIndex(root, deleted, apply);
    cleaned.push(...agentsCleaned);
  }

  return { deleted, cleaned };
}

/**
 * Remove table rows from INDEX.md that reference deleted files.
 */
function cleanIndexReferences(root: string, deletedFiles: string[], apply: boolean): string[] {
  const indexPath = path.join(root, "INDEX.md");
  const content = readFileSafe(indexPath);
  if (!content) return [];

  const cleaned: string[] = [];
  const lines = content.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    let shouldRemoveLine = false;
    for (const deleted of deletedFiles) {
      // Match table rows containing the deleted filename
      const basename = path.basename(deleted);
      if (line.includes("|") && line.includes(basename)) {
        shouldRemoveLine = true;
        break;
      }
    }
    if (!shouldRemoveLine) {
      result.push(line);
    }
  }

  if (result.length < lines.length) {
    if (apply) {
      writeFileAtomic(indexPath, result.join("\n"));
    }
    cleaned.push("INDEX.md");
  }

  return cleaned;
}

/**
 * Remove references from AGENTS-INDEX.md for deleted agent files.
 */
function cleanAgentsIndex(root: string, deletedFiles: string[], apply: boolean): string[] {
  const agentsIndexPath = path.join(root, ".claude/docs/AGENTS-INDEX.md");
  const content = readFileSafe(agentsIndexPath);
  if (!content) return [];

  const deletedAgents = deletedFiles
    .filter((f) => f.startsWith(".claude/agents/"))
    .map((f) => path.basename(f, ".md"));

  if (deletedAgents.length === 0) return [];

  const lines = content.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    let shouldRemoveLine = false;
    for (const agent of deletedAgents) {
      if (line.includes(agent)) {
        shouldRemoveLine = true;
        break;
      }
    }
    if (!shouldRemoveLine) {
      result.push(line);
    }
  }

  if (result.length < lines.length) {
    if (apply) {
      writeFileAtomic(agentsIndexPath, result.join("\n"));
    }
    return [".claude/docs/AGENTS-INDEX.md"];
  }

  return [];
}
