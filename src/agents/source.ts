import * as fs from "node:fs";
import * as path from "node:path";
import type {
  DeclaredPlugin,
  InstructionBlockFrontmatter,
  McpServerDef,
  NeutralSkillFrontmatter,
} from "./source-schemas";
import {
  declaredPluginsFileSchema,
  instructionBlockFrontmatterSchema,
  instructionOrderSchema,
  mcpServersFileSchema,
  neutralSkillSchema,
} from "./source-schemas";

/**
 * Neutral-source loader (spec 008, contracts/neutral-source.md). Reads the
 * hand-edited `.agents/` tree, parses frontmatter with a minimal flat splitter
 * (no YAML dependency — R9), then Zod-validates. Raw frontmatter + body are
 * preserved verbatim so emitters can reproduce byte-identical passthrough output.
 */

export interface InstructionBlockFile {
  filename: string;
  frontmatter: InstructionBlockFrontmatter;
  rawFrontmatter: string;
  body: string;
}

export interface NeutralSkillFile {
  dirName: string;
  frontmatter: NeutralSkillFrontmatter;
  rawFrontmatter: string;
  body: string;
}

export interface PassthroughFile {
  /** POSIX path relative to a `.agents/targets/<target>/` passthrough root. */
  relPath: string;
  content: string;
}

export interface SourceModel {
  blocks: InstructionBlockFile[];
  order: string[];
  skills: NeutralSkillFile[];
  mcpServers: McpServerDef[];
  claudePassthrough: PassthroughFile[];
  codexPassthrough: PassthroughFile[];
  opencodePassthrough: PassthroughFile[];
  /** Declared plugin dependencies (spec 010 US8). Empty where the project declares none. */
  declaredPlugins: DeclaredPlugin[];
}

// ---------------------------------------------------------------------------
// Frontmatter parsing (minimal flat splitter — R9, no YAML dep)
// ---------------------------------------------------------------------------

/** Split a `---`-fenced file into its raw frontmatter block and its body. */
export function splitFrontmatter(text: string): { rawFrontmatter: string; body: string } {
  if (!text.startsWith("---\n")) {
    throw new Error("file does not begin with a frontmatter fence (---)");
  }
  const rest = text.slice(4);
  const close = rest.match(/\n---(\n|$)/);
  if (!close || close.index === undefined) {
    throw new Error("unterminated frontmatter (missing closing ---)");
  }
  return {
    rawFrontmatter: rest.slice(0, close.index),
    body: rest.slice(close.index + close[0].length),
  };
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseScalar(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((item) => stripQuotes(item.trim()));
  }
  return stripQuotes(trimmed);
}

/** Parse a raw frontmatter block into a flat record (scalars, booleans, inline arrays, `|`/`>` blocks). */
export function parseFrontmatterFields(rawFrontmatter: string): Record<string, unknown> {
  const lines = rawFrontmatter.split("\n");
  const out: Record<string, unknown> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined || line.trim() === "") continue;
    const match = line.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (!match || match[1] === undefined) continue; // continuation lines handled by the block-scalar branch
    const key = match[1];
    const rest = match[2] ?? "";

    if (rest === "|" || rest === ">" || rest === "|-" || rest === ">-") {
      const literal = rest.startsWith("|");
      const block: string[] = [];
      let next = lines[i + 1];
      while (next !== undefined && (next.startsWith("  ") || next.trim() === "")) {
        block.push(next.replace(/^ {2}/, ""));
        i++;
        next = lines[i + 1];
      }
      while (block.length > 0 && (block[block.length - 1] ?? "").trim() === "") block.pop();
      out[key] = literal ? block.join("\n") : block.join(" ");
      continue;
    }

    out[key] = parseScalar(rest);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

function loadInstructionBlocks(agentsDir: string): {
  blocks: InstructionBlockFile[];
  order: string[];
} {
  const blocksDir = path.join(agentsDir, "instructions", "blocks");
  const orderPath = path.join(agentsDir, "instructions", "order.json");

  const order = instructionOrderSchema.parse(JSON.parse(fs.readFileSync(orderPath, "utf-8")));

  const onDisk = fs.existsSync(blocksDir)
    ? fs.readdirSync(blocksDir).filter((f) => f.endsWith(".md"))
    : [];

  // order.json must list every block exactly once (and nothing extra).
  const orderSet = new Set(order);
  if (orderSet.size !== order.length) {
    throw new Error("instructions/order.json contains duplicate entries");
  }
  for (const file of onDisk) {
    if (!orderSet.has(file)) {
      throw new Error(`instructions/order.json is missing block "${file}"`);
    }
  }
  for (const listed of order) {
    if (!onDisk.includes(listed)) {
      throw new Error(`instructions/order.json lists "${listed}" but no such block file exists`);
    }
  }

  const blocks = order.map((filename) => {
    const text = fs.readFileSync(path.join(blocksDir, filename), "utf-8");
    const { rawFrontmatter, body } = splitFrontmatter(text);
    const frontmatter = instructionBlockFrontmatterSchema.parse(
      parseFrontmatterFields(rawFrontmatter),
    );

    // title must match the block's single `##` heading.
    const heading = body.match(/^##\s+(.+?)\s*$/m);
    if (heading && heading[1] !== frontmatter.title) {
      throw new Error(
        `block "${filename}" title "${frontmatter.title}" does not match its heading "${heading[1]}"`,
      );
    }
    return { filename, frontmatter, rawFrontmatter, body };
  });

  return { blocks, order };
}

function loadSkills(agentsDir: string): NeutralSkillFile[] {
  const skillsDir = path.join(agentsDir, "skills");
  if (!fs.existsSync(skillsDir)) return [];

  const dirs = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  return dirs.map((dirName) => {
    const text = fs.readFileSync(path.join(skillsDir, dirName, "SKILL.md"), "utf-8");
    const { rawFrontmatter, body } = splitFrontmatter(text);
    const fields = parseFrontmatterFields(rawFrontmatter);
    // Validate the whole skill (frontmatter shape + dirName equality + $ARGUMENTS rule).
    const parsed = neutralSkillSchema.parse({ frontmatter: fields, body, dirName });
    return { dirName, frontmatter: parsed.frontmatter, rawFrontmatter, body };
  });
}

/**
 * Declared plugin dependencies. ABSENT IS EMPTY, not an error: a scaffolded downstream project
 * declares none, and the catalogue that consumes this is OE-internal and payload-excluded. The
 * guard that a declaration EXISTS where one is required lives in `declared-plugins.test.ts`,
 * which is the only place that knows this repository is that case.
 */
function loadDeclaredPlugins(agentsDir: string): DeclaredPlugin[] {
  const pluginsPath = path.join(agentsDir, "plugins.json");
  if (!fs.existsSync(pluginsPath)) return [];
  return declaredPluginsFileSchema.parse(JSON.parse(fs.readFileSync(pluginsPath, "utf-8")));
}

function loadMcpServers(agentsDir: string): McpServerDef[] {
  const mcpPath = path.join(agentsDir, "mcp", "servers.json");
  if (!fs.existsSync(mcpPath)) return [];
  return mcpServersFileSchema.parse(JSON.parse(fs.readFileSync(mcpPath, "utf-8")));
}

function listFilesRecursive(root: string, rel = ""): string[] {
  const dirPath = path.join(root, rel);
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(root, childRel));
    } else {
      files.push(childRel);
    }
  }
  return files;
}

function loadTargetPassthrough(
  agentsDir: string,
  target: "claude" | "codex" | "opencode",
): PassthroughFile[] {
  const targetDir = path.join(agentsDir, "targets", target);
  if (!fs.existsSync(targetDir)) return [];
  return listFilesRecursive(targetDir)
    .sort()
    .map((relPath) => ({
      relPath,
      content: fs.readFileSync(path.join(targetDir, relPath), "utf-8"),
    }));
}

/**
 * Load and validate the entire neutral source at `agentsDir` (the `.agents/` root).
 * Throws on any structural or authoring-rule violation.
 */
export function loadSource(agentsDir: string): SourceModel {
  const { blocks, order } = loadInstructionBlocks(agentsDir);
  return {
    blocks,
    order,
    skills: loadSkills(agentsDir),
    mcpServers: loadMcpServers(agentsDir),
    claudePassthrough: loadTargetPassthrough(agentsDir, "claude"),
    codexPassthrough: loadTargetPassthrough(agentsDir, "codex"),
    opencodePassthrough: loadTargetPassthrough(agentsDir, "opencode"),
    declaredPlugins: loadDeclaredPlugins(agentsDir),
  };
}
