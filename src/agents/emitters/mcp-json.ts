import type { EmittedFile, Emitter } from "../types";
import { toMcpServersObject, toServersObject } from "./mcp-shapes";
import { jsonFile, MCP_SOURCE, serversForTarget } from "./shared";

/**
 * JSON MCP config emitters (spec 008, R5).
 * - `mcp-json-mcpServers`: Claude `.mcp.json` + Cursor `.cursor/mcp.json` (`mcpServers` key).
 * - `mcp-json-servers`: Copilot `.vscode/mcp.json` (top-level `servers` key).
 * Output path comes from the target's `mcp.emit.path` (data-driven).
 */

export const mcpJsonMcpServers: Emitter = (ctx): EmittedFile[] => {
  const emit = ctx.target.mcp.emit;
  if (!emit) return [];
  return [
    {
      path: emit.path,
      content: jsonFile(toMcpServersObject(serversForTarget(ctx))),
      target: ctx.target.id,
      family: "mcp-json-mcpServers",
      source: MCP_SOURCE,
    },
  ];
};

export const mcpJsonServers: Emitter = (ctx): EmittedFile[] => {
  const emit = ctx.target.mcp.emit;
  if (!emit) return [];
  return [
    {
      path: emit.path,
      content: jsonFile(toServersObject(serversForTarget(ctx))),
      target: ctx.target.id,
      family: "mcp-json-servers",
      source: MCP_SOURCE,
    },
  ];
};
