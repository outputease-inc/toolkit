import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import { loadAgentTargets } from "../data/agent-targets-loader";
import type { AgentTarget, AgentTargetId, EmitterFamily } from "../schema/agent-targets";
import { toCodexToml, toGeminiMcpServers } from "./emitters/mcp-shapes";
import { jsonFile } from "./emitters/shared";
import { loadSource } from "./source";
import type { McpServerDef } from "./source-schemas";

/**
 * User-global apply (spec 008, FR-023). For targets whose MCP config is
 * user-global (Windsurf Cascade `~/.codeium/windsurf/mcp_config.json`, optionally
 * Codex `~/.codex/config.toml`), merges ONLY the servers named in the neutral
 * source, preserving every unmanaged entry. Idempotent (a second run is a no-op);
 * an unparseable user file exits 1 without writing.
 */

export interface ApplyOptions {
  agentsDir: string;
  targets: AgentTargetId[];
  dryRun?: boolean;
  /** Override `~` expansion (for tests). */
  homeDir?: string;
  targetsData?: AgentTarget[];
}

export interface ApplyChange {
  target: string;
  path: string;
  status: "created" | "updated" | "unchanged" | "error";
  detail?: string;
}

export interface ApplyResult {
  exitCode: 0 | 1;
  changes: ApplyChange[];
}

function expandHome(p: string, home: string): string {
  return p.replace(/^~(?=[/\\]|$)/, home);
}

function mergeManaged(
  family: EmitterFamily,
  existing: string | null,
  servers: McpServerDef[],
  scopeCaveat: string | null,
): { content?: string; error?: string } {
  if (family === "mcp-toml-codex") {
    let obj: Record<string, unknown> = {};
    if (existing !== null) {
      try {
        obj = parseToml(existing) as Record<string, unknown>;
      } catch {
        return { error: "user config is not valid TOML" };
      }
    }
    const table = (obj.mcp_servers as Record<string, unknown>) ?? {};
    // Reuse the emitter shape for the managed servers, then merge.
    const managed = parseToml(toCodexToml(servers, scopeCaveat)) as {
      mcp_servers: Record<string, unknown>;
    };
    obj.mcp_servers = { ...table, ...managed.mcp_servers };
    return { content: `${stringifyToml(obj)}\n` };
  }

  // JSON mcpServers shape (Windsurf Cascade, Cursor-style user files).
  let obj: Record<string, unknown> = {};
  if (existing !== null) {
    try {
      obj = JSON.parse(existing) as Record<string, unknown>;
    } catch {
      return { error: "user config is not valid JSON" };
    }
  }
  const mcpServers = (obj.mcpServers as Record<string, unknown>) ?? {};
  obj.mcpServers = { ...mcpServers, ...toGeminiMcpServers(servers) };
  return { content: jsonFile(obj) };
}

export function apply(opts: ApplyOptions): ApplyResult {
  const targetsData = opts.targetsData ?? loadAgentTargets();
  const source = loadSource(opts.agentsDir);
  const home = opts.homeDir ?? os.homedir();
  const changes: ApplyChange[] = [];

  for (const id of opts.targets) {
    const target = targetsData.find((t) => t.id === id);
    const userGlobal = target?.mcp.userGlobal;
    if (!target || !userGlobal) {
      changes.push({ target: id, path: "", status: "error", detail: "no user-global MCP config" });
      continue;
    }
    const filePath = expandHome(userGlobal.path, home);
    const servers = source.mcpServers.filter((s) => !s.targets || s.targets.includes(id));
    const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : null;

    const merged = mergeManaged(userGlobal.family, existing, servers, target.mcp.scopeCaveat);
    if (merged.error) {
      changes.push({ target: id, path: filePath, status: "error", detail: merged.error });
      return { exitCode: 1, changes };
    }
    if (merged.content === existing) {
      changes.push({ target: id, path: filePath, status: "unchanged" });
      continue;
    }
    if (!opts.dryRun) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, merged.content ?? "");
    }
    changes.push({ target: id, path: filePath, status: existing === null ? "created" : "updated" });
  }

  return { exitCode: 0, changes };
}
