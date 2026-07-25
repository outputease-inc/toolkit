import { loadAgentStacks } from "../data/agent-stacks-loader";
import type { AgentStackEntry } from "../schema/agent-stacks";

/**
 * Resolve the agent stack for a given project context.
 *
 * Filters `agent-stacks.json` by active conditions and platform flags,
 * paralleling how `resolveStack()` in `context.ts` filters dev-stacks.
 */
export function resolveAgentStack(platformKey: string, backend?: string): AgentStackEntry[] {
  const allAgents = loadAgentStacks();

  // Build active conditions based on project context
  const activeConditions = new Set<string>(["always", "optional"]);

  // Platform-specific conditions
  if (platformKey !== "tooling") {
    activeConditions.add("has_frontend");
  }

  // Backend-specific conditions
  if (backend === "supabase") {
    activeConditions.add("backend:supabase");
  }

  // Filter agents by condition and platform
  return allAgents.filter((agent) => {
    const conditionMatch = activeConditions.has(agent.condition);
    const platformMatch = agent.platforms[platformKey as keyof typeof agent.platforms] === true;
    return conditionMatch && platformMatch;
  });
}

/**
 * Get install commands for non-selectable plugins (always-included + auto-included).
 * Ordered by tier (lowest first).
 */
export function getPluginInstallCommands(agents: AgentStackEntry[]): string[] {
  return agents
    .filter(
      (a) =>
        a.category === "plugin" &&
        (a.selectionMode === "always-included" || a.selectionMode === "auto-included"),
    )
    .sort((a, b) => Number(a.tier) - Number(b.tier))
    .map((a) => a.installCommand);
}

/**
 * Get MCP server configurations for non-selectable MCP entries.
 * Returns a record keyed by tool name with the MCP config object.
 */
export function getMcpConfigs(
  agents: AgentStackEntry[],
): Record<string, { type: string; command: string; args: string[] }> {
  const configs: Record<string, { type: string; command: string; args: string[] }> = {};
  for (const agent of agents) {
    if (
      agent.mcpConfig &&
      (agent.selectionMode === "always-included" || agent.selectionMode === "auto-included")
    ) {
      configs[agent.tool] = {
        type: agent.mcpConfig.type,
        command: agent.mcpConfig.command,
        args: agent.mcpConfig.args,
      };
    }
  }
  return configs;
}

/**
 * Generate a `.mcp.json` content object from resolved MCP configs.
 */
export function generateMcpJson(agents: AgentStackEntry[]): {
  mcpServers: Record<string, { type: string; command: string; args: string[] }>;
} {
  return { mcpServers: getMcpConfigs(agents) };
}

/**
 * Get selectable plugin entries (the optional pool), ordered by tier.
 */
export function getOptionalPluginEntries(agents: AgentStackEntry[]): AgentStackEntry[] {
  return agents
    .filter((a) => a.category === "plugin" && a.selectionMode === "selectable")
    .sort((a, b) => Number(a.tier) - Number(b.tier));
}

/**
 * Render the install lines for one plugin: a marketplace-add line first when
 * the plugin lives outside claude-plugins-official (deduped via `seen`),
 * then the install command. `prefix` comments the lines out ("# ") for the
 * optional block.
 */
function pluginInstallLines(entry: AgentStackEntry, seen: Set<string>, prefix: string): string[] {
  const lines: string[] = [];
  if (entry.marketplace && !seen.has(entry.marketplace)) {
    seen.add(entry.marketplace);
    lines.push(`${prefix}claude plugin marketplace add ${entry.marketplace}`);
  }
  lines.push(`${prefix}${entry.installCommand}`);
  return lines;
}

/**
 * Generate the install-claude-plugins.sh script content from resolved agents.
 */
export function generatePluginInstallScript(
  agents: AgentStackEntry[],
  selectedPlugins: string[] = [],
): string {
  const requiredEntries = agents
    .filter(
      (a) =>
        a.category === "plugin" &&
        (a.selectionMode === "always-included" || a.selectionMode === "auto-included"),
    )
    .sort((a, b) => Number(a.tier) - Number(b.tier));

  const optional = getOptionalPluginEntries(agents);
  const selectedSet = new Set(selectedPlugins);
  const picked = optional.filter((a) => selectedSet.has(a.tool));
  const unpicked = optional.filter((a) => !selectedSet.has(a.tool));

  const seenActive = new Set<string>();
  const activeLines = [...requiredEntries, ...picked].flatMap((a) =>
    pluginInstallLines(a, seenActive, ""),
  );
  const seenCommented = new Set<string>();
  const optionalLines = unpicked.flatMap((a) => pluginInstallLines(a, seenCommented, "# "));

  const lines = [
    "#!/usr/bin/env bash",
    "# Auto-generated: Install recommended Claude Code plugins",
    '# Run this inside a Claude Code session or prefix with "claude"',
    "#",
    "# On Windows without Git Bash/WSL this .sh will not run natively — paste the",
    "# `claude ...` commands below directly into a Claude Code session instead.",
    "",
    "set -euo pipefail",
    "",
    ...activeLines,
    ...(optionalLines.length > 0
      ? ["", "# Optional plugins (uncomment to install)", ...optionalLines]
      : []),
    "",
    'echo "All plugins installed."',
    "",
  ];
  return lines.join("\n");
}
