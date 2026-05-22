/**
 * File Operations -- Phase 5 of the setup pipeline.
 *
 * Handles:
 * - settings.local.json generation from example template
 * - .mcp.json mutation (github MCP rename/remove, package runner swap)
 * - .gitignore pattern uncommenting based on tech stack
 * - Hookify rule enablement after successful token replacement
 * - Line ending normalization (done by writeFileAtomic in utils.ts)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolkitConfig } from "./config-loader";
import { readFileSafe, writeFileAtomic } from "./utils";

// ---- Types ------------------------------------------------------------------

/** Result of running file operations. */
export interface FileOperationsResult {
  operations: string[];
}

/** Shape of an MCP server entry in .mcp.json. */
interface McpServerEntry {
  args?: string[];
  [key: string]: unknown;
}

/** Shape of the parsed .mcp.json file. */
interface McpJson {
  mcpServers?: Record<string, McpServerEntry>;
  [key: string]: unknown;
}

// ---- .gitignore pattern map -------------------------------------------------
// Maps runtime/framework names to .gitignore patterns to uncomment.

export const GITIGNORE_PATTERNS: Record<string, string[]> = {
  // Runtime-based
  node: ["node_modules/", "dist/", "build/"],
  bun: ["node_modules/", "dist/", "build/"],
  python: ["__pycache__/"],
  rust: ["target/"],
  go: ["vendor/"],

  // Framework-specific (case-insensitive matching)
  "next.js": [".next/"],
  nextjs: [".next/"],
  astro: [".astro/"],
  nuxt: [".nuxt/"],
  sveltekit: [".svelte-kit/"],
};

/**
 * Run all file operations.
 * @param root - toolkit root directory
 * @param config - parsed config object
 * @param apply - if false, dry-run mode
 */
export function runFileOperations(
  root: string,
  config: ToolkitConfig,
  apply: boolean,
): FileOperationsResult {
  const operations: string[] = [];

  // 5a. Generate settings.local.json
  const settingsOp = generateSettingsLocal(root, config, apply);
  if (settingsOp) operations.push(settingsOp);

  // 5b. Mutate .mcp.json
  const mcpOps = mutateMcpJson(root, config, apply);
  operations.push(...mcpOps);

  // 5c. Uncomment .gitignore patterns
  const gitignoreOp = uncommentGitignore(root, config, apply);
  if (gitignoreOp) operations.push(gitignoreOp);

  // 5d. Enable hookify rules
  const hookifyOps = enableHookifyRules(root, apply);
  operations.push(...hookifyOps);

  return { operations };
}

/**
 * 5a. Generate .claude/settings.local.json from the example template.
 */
function generateSettingsLocal(root: string, config: ToolkitConfig, apply: boolean): string | null {
  const formatter = config.commands.formatter;
  if (!formatter) return null;

  const examplePath = path.join(root, ".claude/settings.local.json.example");
  const outputPath = path.join(root, ".claude/settings.local.json");

  const content = readFileSafe(examplePath);
  if (!content) return null;

  // Extract only the JSON block (everything from first { to last })
  const jsonStart = content.indexOf("{");
  if (jsonStart === -1) return null;

  let jsonContent = content.slice(jsonStart);

  // Replace the placeholder
  jsonContent = jsonContent.replace(/\[FORMATTER_COMMAND\]/g, formatter);

  // Validate it's valid JSON
  try {
    JSON.parse(jsonContent);
  } catch {
    return "[warn] settings.local.json: generated content is not valid JSON";
  }

  if (apply) {
    writeFileAtomic(outputPath, jsonContent);
  }

  return `Generated .claude/settings.local.json with formatter: ${formatter}`;
}

/**
 * 5b. Mutate .mcp.json -- rename/remove github entry, swap package runner.
 */
function mutateMcpJson(root: string, config: ToolkitConfig, apply: boolean): string[] {
  const mcpPath = path.join(root, ".mcp.json");
  const content = readFileSafe(mcpPath);
  if (!content) return [];

  const operations: string[] = [];
  let parsed: McpJson;
  try {
    parsed = JSON.parse(content) as McpJson;
  } catch {
    return ["[warn] .mcp.json: failed to parse JSON"];
  }

  const mcpServers = (parsed.mcpServers || parsed) as Record<string, McpServerEntry>;

  // Handle github MCP entry
  if (mcpServers["github-REPLACE-OR-REMOVE"] !== undefined) {
    if (config.features.has_github_mcp && config.optional.github_mcp_url) {
      // Rename key to "github"
      mcpServers.github = mcpServers["github-REPLACE-OR-REMOVE"];
      delete mcpServers["github-REPLACE-OR-REMOVE"];
      operations.push("Renamed github-REPLACE-OR-REMOVE to github in .mcp.json");
    } else {
      // Remove entry
      delete mcpServers["github-REPLACE-OR-REMOVE"];
      operations.push("Removed github-REPLACE-OR-REMOVE from .mcp.json");
    }
  }

  // Swap package runner if not npx (only in args arrays to avoid corrupting other values)
  const runner = config.features.package_runner;
  if (runner && runner !== "npx") {
    const servers = (parsed.mcpServers || parsed) as Record<string, McpServerEntry>;
    let swapped = false;
    for (const serverConfig of Object.values(servers)) {
      if (Array.isArray(serverConfig.args)) {
        for (let i = 0; i < serverConfig.args.length; i++) {
          if (serverConfig.args[i] === "npx") {
            serverConfig.args[i] = runner as string;
            swapped = true;
          }
        }
      }
    }
    if (swapped) {
      operations.push(`Replaced npx with ${runner} in .mcp.json`);
    }
  }

  if (operations.length > 0 && apply) {
    writeFileAtomic(mcpPath, JSON.stringify(parsed, null, 2));
  }

  return operations;
}

/**
 * 5c. Uncomment .gitignore patterns matching the tech stack.
 */
function uncommentGitignore(root: string, config: ToolkitConfig, apply: boolean): string | null {
  const gitignorePath = path.join(root, ".gitignore");
  const content = readFileSafe(gitignorePath);
  if (!content) return null;

  // Collect patterns to uncomment based on runtime and framework
  const toUncomment = new Set<string>();

  const runtime = (config.tech_stack.runtime || "").toLowerCase();
  const framework = (config.tech_stack.framework || "").toLowerCase();

  for (const [key, patterns] of Object.entries(GITIGNORE_PATTERNS)) {
    if (runtime === key || framework === key) {
      for (const p of patterns) toUncomment.add(p);
    }
  }

  if (toUncomment.size === 0) return null;

  const lines = content.split("\n");
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    // Match commented-out patterns like "# node_modules/"
    const commentMatch = line.match(/^#\s*(.+)/);
    if (commentMatch?.[1]) {
      const pattern = commentMatch[1].trim();
      if (toUncomment.has(pattern)) {
        lines[i] = pattern; // Uncomment
        changed = true;
      }
    }
  }

  if (!changed) return null;

  if (apply) {
    writeFileAtomic(gitignorePath, lines.join("\n"));
  }

  return `Uncommented .gitignore patterns: ${[...toUncomment].join(", ")}`;
}

/**
 * 5d. Enable hookify rules that have no remaining placeholder tokens.
 */
function enableHookifyRules(root: string, apply: boolean): string[] {
  const claudeDir = path.join(root, ".claude");
  const operations: string[] = [];

  let entries: string[];
  try {
    entries = fs.readdirSync(claudeDir);
  } catch {
    return operations;
  }

  const hookifyFiles = entries.filter(
    (f) => f.startsWith("hookify.require-") && f.endsWith(".md") && !f.includes("TEMPLATE"),
  );

  for (const file of hookifyFiles) {
    const filePath = path.join(claudeDir, file);
    const content = readFileSafe(filePath);
    if (!content) continue;

    // Skip if already enabled
    if (/enabled:\s*true/i.test(content)) continue;

    // Check if any placeholder tokens remain (frontmatter + body)
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) continue;

    const hasPlaceholders = /\[[A-Z][A-Z0-9_]*\]/.test(content);

    if (hasPlaceholders) {
      operations.push(`[warn] ${file}: has unfilled placeholders, leaving disabled`);
      continue;
    }

    // Enable the rule
    const updated = content.replace(/enabled:\s*false/i, "enabled: true");

    if (apply) {
      writeFileAtomic(filePath, updated);
    }

    operations.push(`Enabled ${file}`);
  }

  return operations;
}
