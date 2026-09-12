import type { EmittedFile, Emitter } from "../types";
import { toCodexToml } from "./mcp-shapes";
import { MCP_SOURCE, serversForTarget } from "./shared";

/**
 * Codex `.codex/config.toml` MCP emitter (spec 008, R5 [C3]). The trust-gating
 * caveat (`mcp.scopeCaveat`) is rendered as a leading TOML comment.
 */
export const mcpTomlCodex: Emitter = (ctx): EmittedFile[] => {
  const emit = ctx.target.mcp.emit;
  if (!emit) return [];
  const developerInstructions = ctx.source.blocks
    .filter((block) => block.frontmatter.scope === "codex")
    .map((block) => block.body)
    .join("")
    .trim();
  return [
    {
      path: emit.path,
      content: toCodexToml(
        serversForTarget(ctx),
        ctx.target.mcp.scopeCaveat,
        developerInstructions,
      ),
      target: ctx.target.id,
      family: "mcp-toml-codex",
      source: MCP_SOURCE,
    },
  ];
};
