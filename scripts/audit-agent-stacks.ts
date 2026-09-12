#!/usr/bin/env bun
/**
 * Agent-stacks audit script (FR-015).
 *
 * Enumerates live `.claude/{agents,commands,skills,hookify}/` and plugins
 * declared in `.mcp.json`, then diffs against `data/agent-stacks.json`.
 * Reports missing entries (live but not in dataset) and orphans (dataset
 * but not live). Engineer applies edits manually.
 *
 * Run: bun run packages/toolkit/scripts/audit-agent-stacks.ts
 * Re-run `bun run --filter=@outputease/toolkit validate:agents` afterwards.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");
const DATA_PATH = join(__dirname, "..", "data", "agent-stacks.json");

type AgentStackEntry = {
  name: string;
  kind: string;
  [key: string]: unknown;
};

type AgentStacksFile = {
  entries: AgentStackEntry[];
};

type LiveItem = { kind: string; name: string };

function enumerateLive(): LiveItem[] {
  const out: LiveItem[] = [];

  const kinds: Array<{ dir: string; kind: string }> = [
    { dir: ".claude/agents", kind: "agent" },
    { dir: ".claude/commands", kind: "command" },
    { dir: ".claude/skills", kind: "skill" },
    { dir: ".claude/hookify", kind: "hookify-rule" },
  ];

  for (const { dir, kind } of kinds) {
    const full = join(REPO_ROOT, dir);
    if (!existsSync(full)) {
      continue;
    }
    for (const entry of readdirSync(full)) {
      const abs = join(full, entry);
      const info = statSync(abs);
      if (info.isDirectory()) {
        // skills are sub-directories with SKILL.md inside
        if (kind === "skill") {
          out.push({ kind, name: entry });
        }
      } else if (entry.endsWith(".md")) {
        const name = entry.replace(/\.md$/, "").replace(/\.local$/, "");
        out.push({ kind, name });
      }
    }
  }

  // MCP plugins
  const mcpPath = join(REPO_ROOT, ".mcp.json");
  if (existsSync(mcpPath)) {
    try {
      const mcp = JSON.parse(readFileSync(mcpPath, "utf8")) as {
        mcpServers?: Record<string, unknown>;
      };
      for (const name of Object.keys(mcp.mcpServers ?? {})) {
        out.push({ kind: "mcp-server", name });
      }
    } catch {
      // ignore
    }
  }

  return out;
}

function main(): void {
  const data: AgentStacksFile = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  const dataset = new Set(data.entries.map((e) => `${e.kind}:${e.name}`));
  const live = enumerateLive();
  const liveSet = new Set(live.map((i) => `${i.kind}:${i.name}`));

  const missing = live.filter((i) => !dataset.has(`${i.kind}:${i.name}`));
  const orphans = data.entries.filter((e) => !liveSet.has(`${e.kind}:${e.name}`));

  console.log(`Live items: ${live.length}`);
  console.log(`Dataset entries: ${data.entries.length}`);
  console.log(`Missing from dataset: ${missing.length}`);
  for (const m of missing) {
    console.log(`  + ${m.kind}: ${m.name}`);
  }
  console.log(`Orphans in dataset: ${orphans.length}`);
  for (const o of orphans) {
    console.log(`  - ${o.kind}: ${o.name}`);
  }
}

if (import.meta.main) {
  main();
}
