import type { EmittedFile, Emitter } from "../types";
import { toMcpServersObject } from "./mcp-shapes";
import { jsonFile, MCP_SOURCE, serversForTarget } from "./shared";

/**
 * Devin Local `.devin/config.json` MCP emitter (spec 008, R5 [C4]). Uses the
 * `mcpServers` shape (committed project scope). Cursor `.cursor/mcp.json` and
 * Copilot `.vscode/mcp.json` reuse the existing mcp-json-mcpServers /
 * mcp-json-servers emitters via their mapping-table entries.
 */
export const mcpDevinJson: Emitter = (ctx): EmittedFile[] => {
  const emit = ctx.target.mcp.emit;
  if (!emit) return [];
  return [
    {
      path: emit.path,
      content: jsonFile(toMcpServersObject(serversForTarget(ctx))),
      target: ctx.target.id,
      family: "mcp-devin-json",
      source: MCP_SOURCE,
    },
  ];
};
