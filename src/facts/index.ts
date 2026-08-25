/**
 * What this package contains, as data. The landing page and any other consumer
 * that describes the toolkit reads from here instead of restating it, so a
 * description cannot drift from the thing it describes.
 *
 * Every function reads a source that ships in the npm tarball (`src/`, `data/`,
 * `templates/` are all in package.json#files), so this works from an installed
 * package, not only from the monorepo.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Eta } from "eta";
import pkg from "../../package.json" with { type: "json" };
import { CLI_COMMANDS, type CliCommandInfo } from "../cli/commands/registry";
import { loadAgentStacks } from "../data/agent-stacks-loader";
import { loadAgentTargets } from "../data/agent-targets-loader";
import { getOptionalPluginEntries, resolveAgentStack } from "../scaffold/agent-context";
import { resolveStack } from "../scaffold/context";
import { getPreset, listPresets as listPresetDefs } from "../tree/presets";
import { findLeafByPath } from "../tree/traversal";

const PACKAGE_ROOT = join(import.meta.dir, "..", "..");
const CLAUDE_DIR = join(PACKAGE_ROOT, "templates", ".claude");
const SKILLS_DIR = join(CLAUDE_DIR, "skills");
const HOOKS_DIR = join(CLAUDE_DIR, "hooks");
const SUBAGENTS_DIR = join(CLAUDE_DIR, "agents");
const DOCS_DIR = join(PACKAGE_ROOT, "templates", "docs");

/**
 * The settings a scaffolded project actually receives.
 *
 * NOT `templates/.claude/settings.json`. That file is OutputEase's own mirrored
 * configuration; `deduplicateFiles` in `scaffold/renderer.ts` lets the Eta
 * render below win at the same output path, so this template is what `init`
 * writes. The two disagree on both halves: permissions are package-manager
 * specific here, and every hook past PreToolUse is gated on Bun.
 */
const SCAFFOLD_SETTINGS_ETA = join(
  PACKAGE_ROOT,
  "templates",
  "scaffolding",
  "claude",
  ".claude",
  "settings.json.eta",
);

/** Package managers `outputease init --pm` accepts. `bun` is the CLI default. */
export type PackageManagerName = "bun" | "npm" | "yarn" | "pnpm";

export const DEFAULT_PACKAGE_MANAGER: PackageManagerName = "bun";

export type ShippedSkill = {
  /** Directory name, which is also the slash command: `/<slug>`. */
  slug: string;
  /** `description:` from the SKILL.md frontmatter. */
  description: string;
};

export type ShippedHook = {
  /** File name inside `.claude/hooks/`, e.g. `auto-format.js`. */
  file: string;
  /** Lifecycle events `settings.json` registers it on. Empty means it ships unwired. */
  events: string[];
  /**
   * Tool matchers per event, in the same order as `events`. An event with no
   * matcher (Stop, SessionStart) contributes an empty string, so the two arrays
   * stay index-aligned.
   */
  matchers: string[];
};

/**
 * Hook events in the order they fire across a session, so a consumer can render
 * the wiring as the timeline it is rather than in whatever order JSON.parse
 * happened to yield. Events outside this list sort last, alphabetically.
 */
export const HOOK_EVENT_ORDER: readonly string[] = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "Stop",
];

export type ShippedSubagent = {
  /** `name:` from the agent's frontmatter, which is also its `subagent_type`. */
  name: string;
  /** `description:` from the agent's frontmatter. */
  description: string;
  /** `tools:` line, verbatim. Empty when the agent inherits every tool. */
  tools: string;
};

/**
 * How many permission rules the scaffolded `settings.json` starts with. Counts
 * only: the rules themselves are a starting posture a project owner is free to
 * edit, so quoting them would read as a guarantee the file cannot make.
 */
export type PermissionPosture = {
  allow: number;
  deny: number;
  ask: number;
};

/** The resolved plugin + MCP picture for one project shape. */
export type InitStackFacts = {
  platformKey: string;
  backend: string;
  /** Wired without asking, because condition and platform both matched. */
  autoInstalled: AgentStackFact[];
  /** The init multiselect pool, in the picker's own tier order. */
  optional: AgentStackFact[];
  /** Entries that contribute a server to the generated `.mcp.json`. */
  mcpServers: string[];
};

/** One row of the plugin + MCP catalogue `outputease init` resolves against. */
export type AgentStackFact = {
  tool: string;
  purpose: string;
  /** `plugin` or `mcp-server`. */
  category: string;
  /** `always-included`, `auto-included`, or `selectable`. */
  selectionMode: string;
  /** What has to be true for it to apply, e.g. `always`, `has_frontend`, `backend:supabase`. */
  condition: string;
  url: string | null;
  /** True when the entry also contributes an MCP server to the generated `.mcp.json`. */
  hasMcp: boolean;
};

export type PresetFact = {
  name: string;
  description: string;
  defaultName: string;
  leafId: string;
};

export type AgentTargetFact = {
  id: string;
  displayName: string;
};

export const toolkitVersion: string = pkg.version;

export function listCliCommands(): CliCommandInfo[] {
  return [...CLI_COMMANDS];
}

export function listPresets(): PresetFact[] {
  return listPresetDefs().map((p) => ({
    name: p.name,
    description: p.description,
    defaultName: p.defaultName,
    leafId: p.leafId,
  }));
}

/** First `<key>:` line of a Markdown frontmatter block, or "". */
function frontmatterField(body: string, key: string): string {
  const match = body.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim() ?? "";
}

/** First `description:` line of a SKILL.md frontmatter block, or "". */
function readSkillDescription(skillDir: string): string {
  return frontmatterField(
    readFileSync(join(SKILLS_DIR, skillDir, "SKILL.md"), "utf8"),
    "description",
  );
}

export function listShippedSkills(): ShippedSkill[] {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      slug: entry.name,
      description: readSkillDescription(entry.name),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

type ScaffoldSettings = {
  permissions?: { allow?: unknown[]; deny?: unknown[]; ask?: unknown[] };
  hooks?: Record<string, { matcher?: string; hooks?: { command?: string }[] }[]>;
};

/**
 * Render the scaffold's `settings.json` for one package manager and parse it.
 * Eta's whitespace handling can fuse lines; the result is still valid JSON.
 */
function readScaffoldSettings(pm: PackageManagerName): ScaffoldSettings {
  const eta = new Eta({ autoEscape: false, varName: "it" });
  const rendered = eta.renderString(readFileSync(SCAFFOLD_SETTINGS_ETA, "utf8"), {
    pm: { name: pm },
  });
  return JSON.parse(rendered);
}

/**
 * Every hook file the scaffold copies into `.claude/hooks/`, annotated with the
 * lifecycle events the generated `settings.json` wires it to for `pm`.
 *
 * Directory-first, not settings-first, and that distinction carries real
 * information here: every hook file ships for every package manager, but only
 * the four PreToolUse guards are wired outside Bun, so a non-Bun render leaves
 * eight hooks present with an empty `events`. Reading the settings file alone
 * would silently drop them.
 */
export function listShippedHooks(pm: PackageManagerName = DEFAULT_PACKAGE_MANAGER): ShippedHook[] {
  const settings = readScaffoldSettings(pm);
  const wiring = new Map<string, { events: string[]; matchers: string[] }>();

  for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
    for (const group of groups) {
      for (const hook of group.hooks ?? []) {
        const file = hook.command?.match(/hooks\/([\w.-]+\.js)/)?.[1];
        if (!file) continue;
        const entry = wiring.get(file) ?? { events: [], matchers: [] };
        entry.events.push(event);
        entry.matchers.push(group.matcher ?? "");
        wiring.set(file, entry);
      }
    }
  }

  return readdirSync(HOOKS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => ({
      file: entry.name,
      events: wiring.get(entry.name)?.events ?? [],
      matchers: wiring.get(entry.name)?.matchers ?? [],
    }))
    .sort((a, b) => a.file.localeCompare(b.file));
}

/**
 * The engineering-handbook templates seeded into `docs/`, by file name. A
 * standalone or monorepo scaffold gets all of them; a workspace-scoped one gets
 * none (see `getStaticTemplateGroups`).
 */
export function listDocTemplates(): string[] {
  return readdirSync(DOCS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
}

export function listShippedSubagents(): ShippedSubagent[] {
  return readdirSync(SUBAGENTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => {
      const body = readFileSync(join(SUBAGENTS_DIR, entry.name), "utf8");
      return {
        name: frontmatterField(body, "name") || entry.name.replace(/\.md$/, ""),
        description: frontmatterField(body, "description"),
        tools: frontmatterField(body, "tools"),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listPermissionPosture(
  pm: PackageManagerName = DEFAULT_PACKAGE_MANAGER,
): PermissionPosture {
  const permissions = readScaffoldSettings(pm).permissions ?? {};
  return {
    allow: permissions.allow?.length ?? 0,
    deny: permissions.deny?.length ?? 0,
    ask: permissions.ask?.length ?? 0,
  };
}

/**
 * The whole plugin + MCP catalogue, dataset order preserved. `init` resolves a
 * subset of this per project: see `resolveAgentStack` for how `condition` is
 * evaluated and `getOptionalPluginEntries` for which rows reach the picker.
 */
export function listAgentStackEntries(): AgentStackFact[] {
  return loadAgentStacks().map((entry) => ({
    tool: entry.tool,
    purpose: entry.purpose,
    category: entry.category,
    selectionMode: entry.selectionMode,
    condition: entry.condition,
    url: entry.url,
    hasMcp: entry.hasMcp,
  }));
}

/**
 * What `outputease init` actually wires on one resolved path, split the way the
 * installer treats it: `autoInstalled` needs no answer from the user, `optional`
 * is the multiselect pool in the picker's own tier order.
 *
 * Resolved rather than read off the dataset on purpose. `selectionMode` alone
 * over-promises: `resolveAgentStack` also filters on `condition` and on the
 * platform map, and two conditions in the dataset (`has_e2e_tests`,
 * `has_analytics`) are never activated by any caller, so entries carrying them
 * are unreachable today. Reporting the resolved set can under-claim; reporting
 * the raw dataset would claim things that never install.
 */
export function resolveInitStack(platformKey: string, backend?: string): InitStackFacts {
  const resolved = resolveAgentStack(platformKey, backend);
  const optionalTools = new Set(getOptionalPluginEntries(resolved).map((e) => e.tool));
  const toFact = (entry: (typeof resolved)[number]): AgentStackFact => ({
    tool: entry.tool,
    purpose: entry.purpose,
    category: entry.category,
    selectionMode: entry.selectionMode,
    condition: entry.condition,
    url: entry.url,
    hasMcp: entry.hasMcp,
  });
  return {
    platformKey,
    backend: backend ?? "none",
    autoInstalled: resolved.filter((e) => e.selectionMode !== "selectable").map(toFact),
    optional: getOptionalPluginEntries(resolved).map(toFact),
    // An entry is only an MCP server in the generated .mcp.json when it carries
    // an mcpConfig; `hasMcp` alone is looser (notion sets it with no config).
    mcpServers: resolved
      .filter((e) => e.mcpConfig && !optionalTools.has(e.tool))
      .map((e) => e.tool),
  };
}

export function listAgentTargets(): AgentTargetFact[] {
  return loadAgentTargets().map((t) => ({ id: t.id, displayName: t.displayName }));
}

/**
 * The tools a preset actually scaffolds, by name. This is the same resolution
 * the scaffolder performs, so a page claiming a preset ships a tool can be
 * checked against it. Throws on an unknown preset, matching the CLI.
 */
export function resolvePresetStack(name: string): string[] {
  const preset = getPreset(name);
  if (!preset) {
    throw new Error(
      `Unknown preset "${name}". Available: ${listPresetDefs()
        .map((p) => p.name)
        .join(", ")}`,
    );
  }
  const leaf = findLeafByPath(preset.leafId);
  if (!leaf) {
    throw new Error(`Preset "${name}" references unknown leaf "${preset.leafId}"`);
  }
  return resolveStack(leaf, preset.additiveRoutes).tools.map((t) => t.tool);
}

/** Directories the preset's framework config declares, e.g. ["app", "public"]. */
export function listPresetDirectories(name: string): string[] {
  const preset = getPreset(name);
  if (!preset) return [];
  const leaf = findLeafByPath(preset.leafId);
  if (!leaf) return [];
  return resolveStack(leaf, preset.additiveRoutes).frameworkConfig.directories;
}
