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
import pkg from "../../package.json" with { type: "json" };
import { CLI_COMMANDS, type CliCommandInfo } from "../cli/commands/registry";
import { loadAgentTargets } from "../data/agent-targets-loader";
import { resolveStack } from "../scaffold/context";
import { getPreset, listPresets as listPresetDefs } from "../tree/presets";
import { findLeafByPath } from "../tree/traversal";

const PACKAGE_ROOT = join(import.meta.dir, "..", "..");
const SKILLS_DIR = join(PACKAGE_ROOT, "templates", ".claude", "skills");

export type ShippedSkill = {
  /** Directory name, which is also the slash command: `/<slug>`. */
  slug: string;
  /** `description:` from the SKILL.md frontmatter. */
  description: string;
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

/** First `description:` line of a SKILL.md frontmatter block, or "". */
function readSkillDescription(skillDir: string): string {
  const body = readFileSync(join(SKILLS_DIR, skillDir, "SKILL.md"), "utf8");
  const match = body.match(/^description:\s*(.+)$/m);
  return match?.[1]?.trim() ?? "";
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
