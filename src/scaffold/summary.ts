import pc from "picocolors";
import type { PackageManagerConfig, ScaffoldResult } from "../schema/scaffold";
import { detectScriptType } from "./post-install";

/**
 * Display the post-scaffold summary to stdout.
 */
export function displaySummary(result: ScaffoldResult, pm: PackageManagerConfig): void {
  if (!result.success) {
    console.error(pc.red(`\nError: ${result.error}`));
    return;
  }

  const fileCount = result.filesCreated.length;
  const _dirCount = result.dirsCreated.length;
  const duration = (result.durationMs / 1000).toFixed(1);

  console.log("");
  console.log(pc.green(`  Created ${fileCount} files in ./${result.projectName}`));
  console.log(pc.dim(`  Done in ${duration}s`));
  console.log("");
  console.log("  Next steps:");
  console.log(pc.cyan(`    cd ${result.projectName}`));
  console.log(pc.cyan(`    ${pm.install}`));
  console.log(pc.cyan(`    ${pm.run} dev`));

  // First-run onboarding nudge (only when a first-run skill was actually emitted).
  if (result.filesCreated.some((f) => f.includes("first-run"))) {
    console.log("");
    console.log("  First time here? Ask your agent to run first-run setup");
    console.log("  (Claude Code: /first-run) to configure env vars, connect MCP");
    console.log("  servers, and verify the app boots.");
  }

  // Show spec-kit status
  if (result.postInstall?.specifyInitRan) {
    console.log("");
    console.log(pc.green("  spec-kit ready — start with: specify spec <feature-name>"));
  } else if (result.postInstall?.errors && result.postInstall.errors.length > 0) {
    console.log("");
    console.log(pc.yellow("  spec-kit setup incomplete. Errors:"));
    for (const err of result.postInstall.errors) {
      // Indent multi-line errors so they're readable in transcripts.
      const indented = err
        .split("\n")
        .map((line) => `    ${pc.dim(line)}`)
        .join("\n");
      console.log(indented);
    }
    console.log("");
    console.log(pc.yellow("  Install manually:"));
    console.log(
      pc.dim("    uv tool install specify-cli --from git+https://github.com/github/spec-kit.git"),
    );
    console.log(
      pc.dim(`    specify init --integration claude --script ${detectScriptType()} --here`),
    );
  }

  console.log("");
}

/**
 * Display a dry-run preview: ASCII tree of files that would be generated.
 */
export function displayDryRunSummary(result: ScaffoldResult): void {
  console.log("");
  console.log(pc.yellow("  Dry run — no files written"));
  console.log("");
  console.log(`  ${pc.bold(result.projectName)}/`);
  console.log(formatAsciiTree(result.filesCreated));
  console.log("");

  const fileCount = result.filesCreated.length;
  const dirCount = countDirs(result.filesCreated);
  console.log(pc.dim(`  ${fileCount} files, ${dirCount} directories would be created`));

  const tools = result.stack.tools.map((t) => t.tool);
  const notable = buildStackSummary(tools);
  if (notable.length > 0) {
    console.log("");
    console.log(`  Stack: ${pc.cyan(notable.join(", "))}`);
  }

  if (result.postInstall) {
    console.log(pc.dim("  Would install: uv + spec-kit and run specify init"));
  }

  console.log("");
}

/**
 * Format file paths as an ASCII tree view.
 */
export function formatAsciiTree(filePaths: string[]): string {
  const sorted = [...filePaths].sort();
  const lines: string[] = [];

  interface TreeNode {
    children: Map<string, TreeNode>;
  }

  // Build tree structure
  const root: TreeNode = { children: new Map() };
  for (const filePath of sorted) {
    const parts = filePath.split(/[/\\]/);
    let current = root;
    for (const part of parts) {
      if (!current.children.has(part)) {
        current.children.set(part, { children: new Map() });
      }
      current = current.children.get(part)!;
    }
  }

  // Render tree
  function render(node: TreeNode, prefix: string): void {
    const entries = [...node.children.entries()];
    for (let i = 0; i < entries.length; i++) {
      const [name, child] = entries[i]!;
      const isLast = i === entries.length - 1;
      const connector = isLast ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 ";
      const childPrefix = isLast ? "    " : "\u2502   ";
      const isDir = child.children.size > 0;
      lines.push(`${prefix}${connector}${isDir ? `${name}/` : name}`);
      if (isDir) {
        render(child, `${prefix}${childPrefix}`);
      }
    }
  }

  render(root, "  ");
  return lines.join("\n");
}

/**
 * Count unique directories from a list of file paths.
 */
function countDirs(filePaths: string[]): number {
  const dirs = new Set<string>();
  for (const filePath of filePaths) {
    const parts = filePath.split(/[/\\]/);
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join("/"));
    }
  }
  return dirs.size;
}

/**
 * Build a stack summary (list of key tool names) for display in README etc.
 */
export function buildStackSummary(toolNames: string[]): string[] {
  // Filter to notable tools (skip infra/devtime-only tools for the summary)
  const notable = [
    "Next.js",
    "Astro",
    "React",
    "Tailwind CSS",
    "TypeScript",
    "Biome",
    "Bun",
    "Node.js",
    "pnpm",
    "Vitest",
    "Drizzle ORM",
    "Supabase",
    "Neon",
    "BetterAuth",
    "Cloudflare R2",
    "Zod",
    "Tauri",
    "Capacitor",
  ];
  return toolNames.filter((name) => notable.includes(name));
}
