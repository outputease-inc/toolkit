import { stringify as stringifyToml } from "smol-toml";
import type { McpServerDef } from "../source-schemas";

/**
 * Pure MCP shape transforms (spec 008, R5 / data-model §4). One neutral
 * `McpServerDef` renders into each vendor's shape. Emitters wrap these to write
 * the concrete files; keeping the transforms pure makes them unit-testable and
 * reusable (e.g. apply reuses `toMcpServersObject` for the Windsurf user-global).
 */

type Entry = Record<string, unknown>;

/** Standard `mcpServers`-style entry (Claude, Cursor, Gemini, Copilot): explicit `type`. */
function serverEntry(server: McpServerDef): Entry {
  if (server.transport === "stdio") {
    const entry: Entry = { type: "stdio", command: server.command, args: server.args ?? [] };
    if (server.env) entry.env = server.env;
    return entry;
  }
  const entry: Entry = { type: server.transport, url: server.url };
  if (server.headers) entry.headers = server.headers;
  return entry;
}

function byName(servers: McpServerDef[], make: (s: McpServerDef) => Entry): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const server of servers) out[server.name] = make(server);
  return out;
}

/** Claude `.mcp.json` / Cursor `.cursor/mcp.json`: `{ mcpServers: { … } }`. */
export function toMcpServersObject(servers: McpServerDef[]): { mcpServers: Record<string, Entry> } {
  return { mcpServers: byName(servers, serverEntry) };
}

/** Just the `mcpServers` map value (merged into Gemini settings.json). */
export function toGeminiMcpServers(servers: McpServerDef[]): Record<string, Entry> {
  return byName(servers, serverEntry);
}

/** Copilot VS Code `.vscode/mcp.json`: top-level `servers` key (NOT `mcpServers`). */
export function toServersObject(servers: McpServerDef[]): { servers: Record<string, Entry> } {
  return { servers: byName(servers, serverEntry) };
}

/** OpenCode `opencode.json` `mcp` value: `type: local`, command-as-array, `environment`. */
export function toOpencodeMcp(servers: McpServerDef[]): Record<string, Entry> {
  return byName(servers, (server) => {
    if (server.transport === "stdio") {
      const entry: Entry = {
        type: "local",
        command: [server.command, ...(server.args ?? [])],
      };
      if (server.env) entry.environment = server.env;
      return entry;
    }
    const entry: Entry = { type: "remote", url: server.url };
    if (server.headers) entry.headers = server.headers;
    return entry;
  });
}

/** Codex `.codex/config.toml`: `[mcp_servers.<name>]` TOML, optional leading caveat comment. */
export function toCodexToml(servers: McpServerDef[], scopeCaveat?: string | null): string {
  const table: Record<string, Entry> = {};
  for (const server of servers) {
    if (server.transport === "stdio") {
      const entry: Entry = { command: server.command, args: server.args ?? [] };
      if (server.env) entry.env = server.env;
      table[server.name] = entry;
    } else {
      const entry: Entry = { url: server.url };
      if (server.headers) entry.headers = server.headers;
      table[server.name] = entry;
    }
  }
  const body = stringifyToml({ mcp_servers: table });
  const header = scopeCaveat ? `# ${scopeCaveat}\n\n` : "";
  return `${header}${body}\n`;
}
