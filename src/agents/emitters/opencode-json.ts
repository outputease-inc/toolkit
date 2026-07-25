import type { EmittedFile, Emitter } from "../types";
import { toOpencodeMcp } from "./mcp-shapes";
import { jsonFile, MCP_SOURCE, serversForTarget } from "./shared";

/**
 * OpenCode `opencode.json` emitter (spec 008, R3/R5). Single owner of the whole
 * file: both `instructions-opencode-json` (addendum) and `mcp-opencode-json`
 * families resolve to the same builder, so generate dedupes the identical output.
 * Instructions come from AGENTS.md natively (opencode reads it), so `instructions`
 * only carries opencode-scoped block bodies when any exist.
 */

const OPENCODE_PATH = "opencode.json";

function buildOpencodeJson(ctx: Parameters<Emitter>[0]): EmittedFile {
  const opencodeBlocks = ctx.source.blocks.filter((b) => b.frontmatter.scope === "opencode");
  const config: Record<string, unknown> = { $schema: "https://opencode.ai/config.json" };
  if (opencodeBlocks.length > 0) {
    config.instructions = opencodeBlocks.map((b) => b.body);
  }
  config.mcp = toOpencodeMcp(serversForTarget(ctx));
  return {
    path: OPENCODE_PATH,
    content: jsonFile(config),
    target: ctx.target.id,
    family: "mcp-opencode-json",
    source: MCP_SOURCE,
  };
}

export const instructionsOpencodeJson: Emitter = (ctx) => [buildOpencodeJson(ctx)];
export const mcpOpencodeJson: Emitter = (ctx) => [buildOpencodeJson(ctx)];
