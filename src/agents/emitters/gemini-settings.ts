import type { EmittedFile, Emitter } from "../types";
import { toGeminiMcpServers } from "./mcp-shapes";
import { BLOCKS_SOURCE, jsonFile, MCP_SOURCE, serversForTarget } from "./shared";

/**
 * Gemini emitter (spec 008, R3/R5). Single owner of `.gemini/settings.json`:
 * both `instructions-gemini-settings` (bridge) and `mcp-gemini-settings` families
 * resolve to the same builder (generate dedupes). The bridge points Gemini at
 * AGENTS.md + GEMINI.md via the nested v2 `context.fileName`; GEMINI.md itself is
 * emitted only when gemini-scoped blocks exist.
 */

const SETTINGS_PATH = ".gemini/settings.json";

function buildGeminiOutputs(ctx: Parameters<Emitter>[0]): EmittedFile[] {
  const geminiBlocks = ctx.source.blocks.filter((b) => b.frontmatter.scope === "gemini");
  const settings = {
    context: { fileName: ["AGENTS.md", "GEMINI.md"] },
    mcpServers: toGeminiMcpServers(serversForTarget(ctx)),
  };
  const out: EmittedFile[] = [
    {
      path: SETTINGS_PATH,
      content: jsonFile(settings),
      target: ctx.target.id,
      family: "mcp-gemini-settings",
      source: MCP_SOURCE,
    },
  ];
  if (geminiBlocks.length > 0) {
    out.push({
      path: "GEMINI.md",
      content: geminiBlocks.map((b) => b.body).join(""),
      target: ctx.target.id,
      family: "instructions-gemini-settings",
      source: BLOCKS_SOURCE,
    });
  }
  return out;
}

export const instructionsGeminiSettings: Emitter = (ctx) => buildGeminiOutputs(ctx);
export const mcpGeminiSettings: Emitter = (ctx) => buildGeminiOutputs(ctx);
