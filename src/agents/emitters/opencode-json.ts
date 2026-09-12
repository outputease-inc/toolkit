import type { EmittedFile, Emitter } from "../types";
import { toOpencodeMcp } from "./mcp-shapes";
import { BLOCKS_SOURCE, jsonFile, MCP_SOURCE, serversForTarget } from "./shared";

/**
 * OpenCode `opencode.json` emitter (spec 008, R3/R5). Single owner of the whole
 * file: both `instructions-opencode-json` (addendum) and `mcp-opencode-json`
 * families resolve to the same builder, so generate dedupes the identical output.
 * Instructions come from AGENTS.md natively (opencode reads it), so `instructions`
 * only references opencode-scoped blocks when any exist — and because the
 * opencode config schema defines `instructions` as "additional instruction FILES
 * or patterns", each scoped block is emitted to `.opencode/instructions/<block>.md`
 * and the array carries those paths (never raw block bodies).
 */

const OPENCODE_PATH = "opencode.json";
const INSTRUCTIONS_DIR = ".opencode/instructions";

function buildOpencodeJson(ctx: Parameters<Emitter>[0]): EmittedFile[] {
  const opencodeBlocks = ctx.source.blocks.filter((b) => b.frontmatter.scope === "opencode");
  const files: EmittedFile[] = opencodeBlocks.map((b) => ({
    path: `${INSTRUCTIONS_DIR}/${b.filename}`,
    // Body verbatim — no trimming or re-wrapping, so the byte comparison stays checkable.
    content: b.body,
    target: ctx.target.id,
    family: "instructions-opencode-json",
    source: `${BLOCKS_SOURCE}/${b.filename}`,
  }));

  const config: Record<string, unknown> = { $schema: "https://opencode.ai/config.json" };
  if (opencodeBlocks.length > 0) {
    config.instructions = opencodeBlocks.map((b) => `${INSTRUCTIONS_DIR}/${b.filename}`);
  }
  config.mcp = toOpencodeMcp(serversForTarget(ctx));
  files.push({
    path: OPENCODE_PATH,
    content: jsonFile(config),
    target: ctx.target.id,
    family: "mcp-opencode-json",
    source: MCP_SOURCE,
  });
  return files;
}

export const instructionsOpencodeJson: Emitter = (ctx) => buildOpencodeJson(ctx);
export const mcpOpencodeJson: Emitter = (ctx) => buildOpencodeJson(ctx);
