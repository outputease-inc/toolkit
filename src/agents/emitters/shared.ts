import type { McpServerDef } from "../source-schemas";
import type { EmitterContext } from "../types";

/** Neutral-source path constants used as manifest `source` pointers. */
export const MCP_SOURCE = ".agents/mcp/servers.json";
export const BLOCKS_SOURCE = ".agents/instructions/blocks";

/** MCP servers applicable to a target (absent `targets` = all mcp-capable). */
export function serversForTarget(ctx: EmitterContext): McpServerDef[] {
  return ctx.source.mcpServers.filter((s) => !s.targets || s.targets.includes(ctx.target.id));
}

/** Canonical committed-JSON form: 2-space indent, trailing newline (matches biome JSON style). */
export function jsonFile(obj: unknown): string {
  return `${JSON.stringify(obj, null, 2)}\n`;
}

/** Neutral-only skill frontmatter keys (routing hints Claude ignores). */
const NEUTRAL_ONLY_KEYS = /^(args|targets):/;

/**
 * Drop the neutral-only routing keys (`args`, `targets`) from a raw frontmatter
 * block. The Claude copy uses this so it is byte-identical to the pre-migration
 * skill (which never had those keys); migration appends them, this removes them.
 */
export function stripNeutralKeys(rawFrontmatter: string): string {
  return rawFrontmatter
    .split("\n")
    .filter((line) => !NEUTRAL_ONLY_KEYS.test(line))
    .join("\n");
}
