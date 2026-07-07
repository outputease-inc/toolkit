import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Eta } from "eta";
import { generate } from "../agents/generate";
import {
  augmentSkillFrontmatter,
  integrationOwnedSkills,
  type MigrationBlock,
  splitInstructions,
} from "../agents/migrate";
import type { BlockScope, McpServerDef } from "../agents/source-schemas";
import { loadAgentTargets } from "../data/agent-targets-loader";
import type { AgentTargetId } from "../schema/agent-targets";
import { generateMcpJson, resolveAgentStack } from "./agent-context";
import type { RenderedFile, TemplateData } from "./renderer";

/**
 * Scaffold-time neutral-source seed (spec 008, FR-003 / R8 / R10).
 *
 * The published toolkit scaffolds Claude as a *generated peer*, not a privileged
 * static tree: `init` materializes a neutral `.agents/` seed from the scaffold
 * templates, then runs the same generation engine the monorepo dogfoods. Because
 * the scaffold Claude files are Eta-parameterized (project name, framework, pm,
 * scope, spec-kit) while the engine is static, this module does the one seam the
 * engine deliberately lacks: a *pre-interpolation pass*. It renders the two
 * scaffold Eta templates with the concrete scaffold context, splits the rendered
 * CLAUDE.md into ordered scope-tagged blocks (render-whole-then-split — the
 * conditionals are already resolved, so the split is on final text and is
 * byte-preserving), relocates the template skill set into the neutral dialect,
 * and derives the MCP server list from the resolved agent stack. The engine then
 * emits every selected agent's config — Claude included — from that one seed.
 *
 * Byte-identity for a Claude-only scaffold is guaranteed by construction:
 * `splitInstructions` ↔ the instruction emitter's `join("")` round-trips the
 * rendered CLAUDE.md; `skills-copy` reverses the neutral-key augmentation; the
 * MCP shape is the same object the legacy `.mcp.json` used. The generic `.agents/`
 * seed is persisted only when a non-Claude target is selected (a Claude-only
 * scaffold reproduces the pre-feature tree exactly, with no `.agents/`).
 *
 * The seed is materialized into a throwaway temp dir and the engine runs in
 * `dryRun` mode, so this function performs no writes to the scaffold target —
 * it returns `RenderedFile[]` that flow through the normal rollback-tracked,
 * dry-run-aware writer alongside every other scaffold file.
 */

const TOOLKIT_ROOT = path.join(import.meta.dirname ?? ".", "..", "..");
const TEMPLATES_DIR = path.join(TOOLKIT_ROOT, "templates");
const SCAFFOLDING_DIR = path.join(TEMPLATES_DIR, "scaffolding");

const eta = new Eta({
  views: SCAFFOLDING_DIR,
  autoEscape: false,
  varName: "it",
  defaultExtension: ".eta",
});

/**
 * Sections whose content is Claude-specific in the scaffolded CLAUDE.md (they land
 * in CLAUDE.md but not the shared AGENTS.md). Mirrors migrate.ts CLAUDE_SECTIONS for
 * the generic scaffold instruction set. Everything else is `core`.
 */
const SCAFFOLD_CLAUDE_SECTIONS = new Set<string>();

function scaffoldClassify(title: string): BlockScope {
  return SCAFFOLD_CLAUDE_SECTIONS.has(title) ? "claude" : "core";
}

/** Every agent target id the mapping table defines (dataset-driven, R10). */
export function listAgentTargetIds(): AgentTargetId[] {
  return loadAgentTargets().map((t) => t.id);
}

/**
 * Agent ids spec-kit's `--integration` system accepts (verified live, research [C5],
 * 2026-07-02: `specify init --integration <name>` — claude/codex/copilot/cursor/
 * gemini/opencode/windsurf among others).
 */
const SPECKIT_INTEGRATIONS = new Set<AgentTargetId>([
  "claude",
  "codex",
  "gemini",
  "opencode",
  "copilot",
  "cursor",
  "windsurf",
]);

/**
 * The single spec-kit integration to initialize for a selection. spec-kit installs
 * its commands for ONE integration per `specify init` ([C5] — `--integration` is not
 * repeatable), so prefer claude when present (back-compat with the pre-feature
 * scaffold) else the first spec-kit-supported selected target. Multi-harness spec-kit
 * is spec-kit's own concern (research R4, out of this feature's scope). Returns null
 * when the selection has no spec-kit-supported target (spec-kit init is then skipped).
 */
export function primarySpecKitIntegration(targets: AgentTargetId[]): AgentTargetId | null {
  if (targets.includes("claude")) return "claude";
  return targets.find((t) => SPECKIT_INTEGRATIONS.has(t)) ?? null;
}

/**
 * Validate a selection of agent target ids against the mapping table (R10).
 * Deduplicates, preserves order, and reports any ids the dataset doesn't define
 * so `init` can fail fast on a typo rather than silently emit nothing for it.
 */
export function resolveAgentTargets(ids: string[]): {
  valid: AgentTargetId[];
  unknown: string[];
} {
  const known = new Set(listAgentTargetIds());
  const valid: AgentTargetId[] = [];
  const unknown: string[] = [];
  for (const id of ids) {
    if (known.has(id as AgentTargetId)) {
      if (!valid.includes(id as AgentTargetId)) valid.push(id as AgentTargetId);
    } else if (!unknown.includes(id)) {
      unknown.push(id);
    }
  }
  return { valid, unknown };
}

export interface AgentSeedOptions {
  /** Rendered template context (drives the Eta instruction + settings templates). */
  templateData: TemplateData;
  /** Platform key + backend for MCP-server resolution (mirrors the legacy `.mcp.json`). */
  platformKey: string;
  backend?: string;
  /** Selected agent target ids (claude + any combination). */
  targets: AgentTargetId[];
}

export interface AgentSeedResult {
  /** Emitted agent configs + (when multi-agent) the persisted `.agents/` seed. */
  files: RenderedFile[];
  /** True when the selection is Claude-only — `.agents/` is omitted (byte-parity). */
  claudeOnly: boolean;
  exitCode: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Seed writers (byte-format canonical in agents/migrate.ts — kept in lockstep,
// guarded by the scaffold-parity byte gate)
// ---------------------------------------------------------------------------

function writeInstructionBlocks(agentsDir: string, blocks: MigrationBlock[]): void {
  const blocksDir = path.join(agentsDir, "instructions", "blocks");
  fs.mkdirSync(blocksDir, { recursive: true });
  for (const block of blocks) {
    const fm = block.speckit
      ? `scope: ${block.scope}\ntitle: ${block.title ?? "Spec-Kit Context"}\nspeckit: true`
      : `scope: ${block.scope}\ntitle: ${block.title ?? "Preamble"}`;
    fs.writeFileSync(path.join(blocksDir, block.filename), `---\n${fm}\n---\n${block.body}`);
  }
  fs.writeFileSync(
    path.join(agentsDir, "instructions", "order.json"),
    `${JSON.stringify(
      blocks.map((b) => b.filename),
      null,
      2,
    )}\n`,
  );
}

/** Recursively list POSIX-relative file paths under a directory. */
function listFiles(root: string, rel = ""): string[] {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(root, childRel));
    else out.push(childRel);
  }
  return out;
}

function copyDir(sourceDir: string, destDir: string): void {
  if (!fs.existsSync(sourceDir)) return;
  for (const rel of listFiles(sourceDir)) {
    const src = path.join(sourceDir, ...rel.split("/"));
    const dest = path.join(destDir, ...rel.split("/"));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

/**
 * Partition the scaffold `.claude/` template tree into the neutral source: each
 * non-owned `skills/<name>/SKILL.md` becomes a neutral skill; every other file
 * (owned skills, extra skill assets, hooks, agents, docs, local hookify rules)
 * passes through verbatim under `targets/claude/`. `settings.json` is skipped —
 * the caller supplies the Eta-rendered variant.
 */
function partitionClaudeTemplateTree(
  agentsDir: string,
  templatesRoot: string = TEMPLATES_DIR,
): void {
  const claudeTemplateDir = path.join(templatesRoot, ".claude");
  const owned = integrationOwnedSkills(templatesRoot);
  for (const rel of listFiles(claudeTemplateDir)) {
    if (rel === "settings.json") continue; // Eta-rendered separately.
    const skillMatch = rel.match(/^skills\/([^/]+)\/SKILL\.md$/);
    const name = skillMatch?.[1] ?? "";
    const isNeutralSkill = skillMatch && !owned.has(name);
    const src = path.join(claudeTemplateDir, rel);
    if (isNeutralSkill) {
      const original = fs.readFileSync(src, "utf-8");
      const fenceEnd = original.indexOf("\n---", 4);
      const rawFm = original.slice(4, fenceEnd);
      const bodyStart = original.indexOf("\n", fenceEnd + 1) + 1;
      const body = original.slice(bodyStart);
      // Template skills exclude OE-internal ones, so none are Claude-scoped here.
      const newFm = augmentSkillFrontmatter(rawFm, body, { targetsClaude: false });
      const dest = path.join(agentsDir, "skills", name, "SKILL.md");
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, `---\n${newFm}\n---\n${body}`);
    } else {
      const dest = path.join(agentsDir, "targets", "claude", ...rel.split("/"));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }
}

function copyCodexTargetTemplates(agentsDir: string, templatesRoot: string = TEMPLATES_DIR): void {
  const sourceDir = path.join(templatesRoot, ".codex");
  if (!fs.existsSync(sourceDir)) return;
  copyDir(sourceDir, path.join(agentsDir, "targets", "codex"));
}

function copySpecKitSkillsToCodexTarget(
  agentsDir: string,
  templatesRoot: string = TEMPLATES_DIR,
): void {
  const ownedSkills = integrationOwnedSkills(templatesRoot);
  const codexSkillsDir = path.join(agentsDir, "targets", "codex", "skills");

  for (const skillName of ownedSkills) {
    if (!skillName.startsWith("speckit-")) continue;

    const sourceSkill = path.join(templatesRoot, ".claude", "skills", skillName, "SKILL.md");
    if (!fs.existsSync(sourceSkill)) continue;

    const dest = path.join(codexSkillsDir, skillName, "SKILL.md");
    if (fs.existsSync(dest)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(sourceSkill, dest);
  }
}

/**
 * Materialize the toolkit-owned neutral source (neutral skills + Claude passthrough
 * tree) into `agentsDir`, derived from `<templatesRoot>/.claude`. Shared by the scaffold
 * fold (`buildAgentFiles`, installed templates) and the `.agents`-aware update path
 * (fetched staging templates). Never writes `instructions/` (project-owned) or `mcp/`
 * (stack-derived / user-owned). `settings.json` is Eta-parameterized + user-tunable, so
 * it is gated: the scaffold passes `includeSettings: true` (with `templateData`); the
 * update passes `false`.
 */
export function materializeToolkitSource(
  agentsDir: string,
  opts: { includeSettings: boolean; templateData?: TemplateData; templatesRoot?: string },
): void {
  const templatesRoot = opts.templatesRoot ?? TEMPLATES_DIR;
  partitionClaudeTemplateTree(agentsDir, templatesRoot);
  copyCodexTargetTemplates(agentsDir, templatesRoot);
  copySpecKitSkillsToCodexTarget(agentsDir, templatesRoot);
  if (opts.includeSettings) {
    if (!opts.templateData) {
      throw new Error("materializeToolkitSource: includeSettings requires templateData");
    }
    const settings = eta.render("claude/.claude/settings.json.eta", opts.templateData);
    const dest = path.join(agentsDir, "targets", "claude", "settings.json");
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, settings);
  }
}

/** Derive the neutral MCP server list from the resolved agent stack (order-preserving). */
function mcpServersFromStack(platformKey: string, backend?: string): McpServerDef[] {
  const stack = resolveAgentStack(platformKey, backend);
  const { mcpServers } = generateMcpJson(stack);
  return Object.entries(mcpServers).map(([name, cfg]) => {
    const server: McpServerDef = { name, transport: cfg.type as McpServerDef["transport"] };
    server.command = cfg.command;
    server.args = cfg.args;
    return server;
  });
}

/**
 * Materialize the neutral `.agents/` seed for the scaffold context and generate
 * every selected target's config. Returns `RenderedFile[]` (no writes to the
 * scaffold target). A Claude-only selection returns just the emitted Claude files
 * (no `.agents/`); any non-Claude target additionally returns the `.agents/` seed
 * so the scaffolded project has a working generate/check loop.
 */
export function buildAgentFiles(opts: AgentSeedOptions): AgentSeedResult {
  const claudeOnly = opts.targets.length === 1 && opts.targets[0] === "claude";
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "oe-agent-seed-"));
  const agentsDir = path.join(tmpRoot, ".agents");

  try {
    // 1. Instructions: render the scaffold CLAUDE.md Eta, split the concrete text.
    const claudeMd = eta.render("claude/CLAUDE.md.eta", opts.templateData);
    writeInstructionBlocks(agentsDir, splitInstructions(claudeMd, scaffoldClassify));

    // 2. Skills + Claude passthrough tree (verbatim) + settings.json from its Eta.
    materializeToolkitSource(agentsDir, {
      includeSettings: true,
      templateData: opts.templateData,
    });

    // 3. MCP servers from the resolved agent stack.
    const servers = mcpServersFromStack(opts.platformKey, opts.backend);
    if (servers.length > 0) {
      const mcpDir = path.join(agentsDir, "mcp");
      fs.mkdirSync(mcpDir, { recursive: true });
      fs.writeFileSync(path.join(mcpDir, "servers.json"), `${JSON.stringify(servers, null, 2)}\n`);
    }

    // 4. Generate every selected target's config from the one seed (in-memory).
    const result = generate({ agentsDir, repoRoot: tmpRoot, targets: opts.targets, dryRun: true });

    const files: RenderedFile[] = result.emitted.map((f) => ({
      relativePath: f.path,
      content: f.content,
    }));

    if (!claudeOnly) {
      // Persist the neutral source + generate-owned meta so the scaffolded project
      // has a working `agents generate`/`agents check` loop.
      for (const rel of listFiles(agentsDir)) {
        files.push({
          relativePath: `.agents/${rel}`,
          content: fs.readFileSync(path.join(agentsDir, rel), "utf-8"),
        });
      }
      for (const m of result.meta) {
        files.push({ relativePath: m.path, content: m.content });
      }
      if (result.manifest) {
        files.push({
          relativePath: ".agents/generated.manifest.json",
          content: `${JSON.stringify(result.manifest, null, 2)}\n`,
        });
      }
    }

    return { files, claudeOnly, exitCode: result.exitCode, errors: result.errors };
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}
