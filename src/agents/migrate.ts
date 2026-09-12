import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { stripNeutralKeys } from "./emitters/shared";
import { generate } from "./generate";
import type { BlockScope, McpServerDef } from "./source-schemas";

export { stripNeutralKeys };

/**
 * One-time migration (spec 008, R12). Moves the hand-authored CLAUDE.md + `.claude/`
 * + `.mcp.json` into the neutral `.agents/` source, runs generate, and proves the
 * result is byte-identical to the pre-migration tree (only declared normalizations
 * allowed). Refuses to run once `.agents/` exists.
 *
 * The pure pieces (splitInstructions, augmentSkillFrontmatter) are unit-tested;
 * executeMigration does the IO + the git-based byte-identity gate.
 */

// ---------------------------------------------------------------------------
// Instruction splitting (pure, byte-identity preserving)
// ---------------------------------------------------------------------------

export interface MigrationBlock {
  filename: string;
  scope: BlockScope;
  title: string | null;
  body: string;
  speckit: boolean;
}

const SPECKIT_START = "<!-- SPECKIT START -->";

/** Char offsets of every top-level `## ` heading, ignoring fenced code blocks. */
function sectionStarts(text: string): number[] {
  const starts: number[] = [];
  let inFence = false;
  let pos = 0;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trimStart();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) inFence = !inFence;
    if (!inFence && line.startsWith("## ")) starts.push(pos);
    pos += line.length + (i < lines.length - 1 ? 1 : 0);
  }
  return starts;
}

function headingTitle(sectionText: string): string {
  const nl = sectionText.indexOf("\n");
  const firstLine = nl === -1 ? sectionText : sectionText.slice(0, nl);
  return firstLine.replace(/^##\s+/, "").trimEnd();
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

/**
 * Split CLAUDE.md into ordered, scope-tagged blocks such that concatenating every
 * block body in order reproduces the original byte-for-byte. The SPECKIT marker
 * block is split out of its containing section as a distinguished `speckit` block.
 */
export function splitInstructions(
  text: string,
  classify: (title: string) => BlockScope,
): MigrationBlock[] {
  const starts = sectionStarts(text);
  const segments: { title: string | null; body: string }[] = [];

  if (starts.length === 0) {
    segments.push({ title: null, body: text });
  } else {
    const first = starts[0] ?? 0;
    if (first > 0) segments.push({ title: null, body: text.slice(0, first) });
    for (let i = 0; i < starts.length; i++) {
      const body = text.slice(starts[i] ?? 0, starts[i + 1] ?? text.length);
      segments.push({ title: headingTitle(body), body });
    }
  }

  const withSpeckit: { title: string | null; body: string; speckit: boolean }[] = [];
  for (const seg of segments) {
    const idx = seg.body.indexOf(SPECKIT_START);
    if (idx > 0) {
      withSpeckit.push({ title: seg.title, body: seg.body.slice(0, idx), speckit: false });
      withSpeckit.push({ title: null, body: seg.body.slice(idx), speckit: true });
    } else if (idx === 0) {
      withSpeckit.push({ title: seg.title, body: seg.body, speckit: true });
    } else {
      withSpeckit.push({ ...seg, speckit: false });
    }
  }

  return withSpeckit.map((seg, i) => {
    const scope: BlockScope = seg.speckit
      ? "claude"
      : seg.title === null
        ? "core"
        : classify(seg.title);
    const slug = seg.speckit ? "speckit" : seg.title === null ? "preamble" : slugify(seg.title);
    return {
      filename: `${String(i).padStart(2, "0")}-${slug}.md`,
      scope,
      title: seg.title,
      body: seg.body,
      speckit: seg.speckit,
    };
  });
}

// ---------------------------------------------------------------------------
// Skill frontmatter augmentation (pure)
// ---------------------------------------------------------------------------

/**
 * Append the neutral-only routing keys to a skill's raw frontmatter:
 * - `args: substituted` when the body uses `$ARGUMENTS`
 * - `targets: [claude]` for OE-internal skills
 * Appending (rather than reordering) keeps the Claude copy byte-identical after
 * `stripNeutralKeys` removes them again.
 */
export function augmentSkillFrontmatter(
  rawFrontmatter: string,
  body: string,
  opts: { targetsClaude: boolean },
): string {
  const additions: string[] = [];
  if (opts.targetsClaude) additions.push("targets: [claude]");
  if (body.includes("$ARGUMENTS")) additions.push("args: substituted");
  return additions.length > 0 ? `${rawFrontmatter}\n${additions.join("\n")}` : rawFrontmatter;
}

// ---------------------------------------------------------------------------
// Classification defaults + ownership (spec 008 R0/R4)
// ---------------------------------------------------------------------------

/** Sections whose content is Claude-specific (scope claude); everything else is core. */
export const CLAUDE_SECTIONS = new Set(["Cowork Artifacts", "Agents & Skills"]);

/** OE-internal skills that migrate but stay Claude-scoped (targets: [claude]). */
export const OE_INTERNAL_SKILLS = new Set([
  "maintenance",
  "staleness-audit",
  "add-app",
  "add-package",
]);

export function defaultClassify(title: string): BlockScope {
  return CLAUDE_SECTIONS.has(title) ? "claude" : "core";
}

/**
 * Skills owned by a spec-kit integration or extension manifest — passthrough,
 * kept in generated `.claude/` (R4 ownership rule). Derived, never hardcoded:
 * the manifest-tracked skills + the git-extension `speckit-git-*` commands.
 */
export function integrationOwnedSkills(repoRoot: string): Set<string> {
  const owned = new Set<string>();
  const manifestPath = path.join(repoRoot, ".specify", "integrations", "claude.manifest.json");
  if (fs.existsSync(manifestPath)) {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    for (const match of raw.matchAll(/skills\/([a-z0-9-]+)\//g)) {
      if (match[1]) owned.add(match[1]);
    }
  }
  const gitCmdDir = path.join(repoRoot, ".specify", "extensions", "git", "commands");
  if (fs.existsSync(gitCmdDir)) {
    for (const file of fs.readdirSync(gitCmdDir)) {
      const m = file.match(/^speckit\.git\.([a-z0-9-]+)\.md$/);
      if (m) owned.add(`speckit-git-${m[1]}`);
    }
  }
  return owned;
}

// ---------------------------------------------------------------------------
// Migration execution (IO + git-based byte-identity gate)
// ---------------------------------------------------------------------------

export interface MigrationOptions {
  repoRoot: string;
  classify?: (title: string) => BlockScope;
  dryRun?: boolean;
}

export interface MigrationRecordRow {
  file: string;
  verdict: "identical" | "justified";
  normalization?: string;
}

export interface MigrationResult {
  exitCode: 0 | 1 | 3;
  record: MigrationRecordRow[];
  unexplained: string[];
  errors: string[];
}

function git(repoRoot: string, args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf-8" });
}

function mcpServersFromDotMcp(text: string): McpServerDef[] {
  const parsed = JSON.parse(text) as { mcpServers?: Record<string, Record<string, unknown>> };
  const out: McpServerDef[] = [];
  for (const [name, cfg] of Object.entries(parsed.mcpServers ?? {})) {
    const transport = (cfg.type as McpServerDef["transport"]) ?? "stdio";
    const server: McpServerDef = { name, transport };
    if (typeof cfg.command === "string") server.command = cfg.command;
    if (Array.isArray(cfg.args)) server.args = cfg.args as string[];
    if (cfg.env && typeof cfg.env === "object") server.env = cfg.env as Record<string, string>;
    if (typeof cfg.url === "string") server.url = cfg.url;
    if (cfg.headers && typeof cfg.headers === "object") {
      server.headers = cfg.headers as Record<string, string>;
    }
    out.push(server);
  }
  return out;
}

/**
 * Files whose regenerated form is expected to differ from the pre-migration
 * original by a declared, benign normalization (not an unexplained diff).
 */
const DECLARED_NORMALIZATIONS: Record<string, string> = {
  ".mcp.json": "json-canonical (2-space, one array element per line)",
};

export function executeMigration(opts: MigrationOptions): MigrationResult {
  const { repoRoot } = opts;
  const classify = opts.classify ?? defaultClassify;
  const agentsDir = path.join(repoRoot, ".agents");

  if (fs.existsSync(agentsDir)) {
    return {
      exitCode: 3,
      record: [],
      unexplained: [],
      errors: [".agents/ already exists — migration has already run (refusing to overwrite)"],
    };
  }

  // 1. Split CLAUDE.md into blocks.
  const claudeMdPath = path.join(repoRoot, "CLAUDE.md");
  const claudeMd = fs.readFileSync(claudeMdPath, "utf-8");
  const blocks = splitInstructions(claudeMd, classify);
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

  // 2. Partition tracked .claude/ files: neutral skills vs passthrough.
  const owned = integrationOwnedSkills(repoRoot);
  const tracked = git(repoRoot, ["ls-files", ".claude"]).split("\n").filter(Boolean);
  for (const rel of tracked) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) continue;
    const skillMatch = rel.match(/^\.claude\/skills\/([^/]+)\/SKILL\.md$/);
    const isNeutralSkill = skillMatch && !owned.has(skillMatch[1] ?? "");
    if (isNeutralSkill && skillMatch) {
      const name = skillMatch[1] ?? "";
      const original = fs.readFileSync(abs, "utf-8");
      const fenceEnd = original.indexOf("\n---", 4);
      const rawFm = original.slice(4, fenceEnd);
      const bodyStart = original.indexOf("\n", fenceEnd + 1) + 1;
      const body = original.slice(bodyStart);
      const newFm = augmentSkillFrontmatter(rawFm, body, {
        targetsClaude: OE_INTERNAL_SKILLS.has(name),
      });
      const dest = path.join(agentsDir, "skills", name, "SKILL.md");
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, `---\n${newFm}\n---\n${body}`);
    } else {
      const dest = path.join(agentsDir, "targets", "claude", rel.slice(".claude/".length));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(abs, dest);
    }
  }

  // 3. Migrate .mcp.json -> .agents/mcp/servers.json.
  const mcpPath = path.join(repoRoot, ".mcp.json");
  if (fs.existsSync(mcpPath)) {
    const servers = mcpServersFromDotMcp(fs.readFileSync(mcpPath, "utf-8"));
    fs.mkdirSync(path.join(agentsDir, "mcp"), { recursive: true });
    fs.writeFileSync(
      path.join(agentsDir, "mcp", "servers.json"),
      `${JSON.stringify(servers, null, 2)}\n`,
    );
  }

  // 4. Snapshot the pre-generate content of every pre-existing file the migration
  //    touches, THEN generate. Comparing regenerated-vs-pre-migration content (not
  //    vs git HEAD) makes the gate the true byte-identity claim, immune to any
  //    unrelated uncommitted changes already in the working tree.
  const migratedFiles = ["CLAUDE.md", ".mcp.json", ...tracked];
  const preContent = new Map<string, string>();
  for (const rel of migratedFiles) {
    const abs = path.join(repoRoot, ...rel.split("/"));
    if (fs.existsSync(abs)) preContent.set(rel, fs.readFileSync(abs, "utf-8"));
  }

  const gen = generate({ agentsDir, repoRoot });
  if (gen.exitCode !== 0) {
    return { exitCode: 1, record: [], unexplained: [], errors: gen.errors };
  }

  // 5. Byte-identity gate: every changed migrated file must be a declared normalization.
  const record: MigrationRecordRow[] = [];
  const unexplained: string[] = [];
  for (const [rel, before] of preContent) {
    const abs = path.join(repoRoot, ...rel.split("/"));
    const after = fs.existsSync(abs) ? fs.readFileSync(abs, "utf-8") : "";
    if (after === before) {
      record.push({ file: rel, verdict: "identical" });
      continue;
    }
    const norm = DECLARED_NORMALIZATIONS[rel];
    if (norm) {
      record.push({ file: rel, verdict: "justified", normalization: norm });
    } else {
      unexplained.push(rel);
      record.push({ file: rel, verdict: "justified", normalization: "UNEXPLAINED" });
    }
  }

  writeMigrationRecord(repoRoot, record, unexplained);

  return {
    exitCode: unexplained.length === 0 ? 0 : 1,
    record,
    unexplained,
    errors:
      unexplained.length === 0
        ? []
        : [`byte-identity gate failed: ${unexplained.length} unexplained diff(s)`],
  };
}

function writeMigrationRecord(
  repoRoot: string,
  record: MigrationRecordRow[],
  unexplained: string[],
): void {
  const lines = [
    "# Migration Record: Agent-Agnostic Toolkit",
    "",
    "One-time proof that the neutral source regenerates the pre-migration tree with",
    "only declared normalizations (spec 008, FR-005/SC-002).",
    "",
    "## Declared normalizations",
    "",
    "- `json-canonical`: JSON reformatted to 2-space indent with one array element per line.",
    "- `arguments-frontmatter`: neutral-only `args`/`targets` keys appended to migrated skills",
    "  (stripped from the Claude copy, so `.claude/` skills stay byte-identical).",
    "",
    "## Changed pre-existing files",
    "",
    "| File | Verdict |",
    "|------|---------|",
    ...record.map(
      (r) =>
        `| ${r.file} | ${r.verdict === "justified" && r.normalization !== "UNEXPLAINED" ? `justified(${r.normalization})` : r.normalization === "UNEXPLAINED" ? "**UNEXPLAINED**" : "identical"} |`,
    ),
    "",
    unexplained.length === 0
      ? "**Gate: PASS** — zero unexplained diffs."
      : `**Gate: FAIL** — ${unexplained.length} unexplained diff(s): ${unexplained.join(", ")}`,
    "",
  ];
  const dir = path.join(repoRoot, "specs", "008-agent-agnostic-toolkit");
  if (fs.existsSync(dir)) {
    fs.writeFileSync(path.join(dir, "migration-record.md"), lines.join("\n"));
  }
}
