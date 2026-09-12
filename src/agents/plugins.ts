import fs from "node:fs";
import path from "node:path";
import {
  type DeclaredPlugin,
  declaredPluginSchema,
  declaredPluginsFileSchema,
} from "./source-schemas";

/**
 * Declared plugin dependencies (spec 010 US8, decision S12, FR-021/FR-025).
 *
 * `.agents/plugins.json` is the repository's own answer to "what third-party plugins does this
 * workflow depend on, and why". The operator-facing catalogue in `PLUGINS-INDEX.md` is rendered
 * from it, so the two can no longer disagree — and the roster can no longer drift, because it
 * no longer claims to describe machine state at all.
 *
 * NOT MODELLED: installation. What is installed lives in `~/.claude/plugins/`, is machine-local,
 * is absent in CI, and is the user's to add or remove. The old "Installed plugins (19)" claim
 * (against 14 actually installed) is deleted rather than guarded, per FR-025 and
 * contracts/derived-assertions.md "Not registered, and why".
 *
 * DISTINCT FROM `packages/toolkit/data/agent-stacks.json`, which is the selectable catalogue
 * shipped downstream. That answers "what may a scaffolded project choose?"; this answers "what
 * does THIS repository depend on?". Conflating them would put machine-local state into
 * published data.
 */

export const DECLARED_PLUGINS_REL = ".agents/plugins.json";

/**
 * Region markers in the authored `PLUGINS-INDEX.md`. Everything between them is generated; the
 * rest of the document is authored passthrough. The markers are HTML comments so they render as
 * nothing, and they name their own source so an operator who opens the emitted file learns where
 * to make the edit `protect-generated.js` would otherwise merely block.
 */
export const PLUGIN_CATALOGUE_BEGIN = `<!-- GENERATED:declared-plugins BEGIN — rendered from ${DECLARED_PLUGINS_REL}; edit that file, then \`bun run agents:generate\` -->`;
export const PLUGIN_CATALOGUE_END = "<!-- GENERATED:declared-plugins END -->";

export type { DeclaredPlugin };
export { declaredPluginSchema, declaredPluginsFileSchema };

export function loadDeclaredPlugins(repoRoot: string): DeclaredPlugin[] {
  const abs = path.join(repoRoot, DECLARED_PLUGINS_REL);
  if (!fs.existsSync(abs)) {
    throw new Error(
      `declared plugin dependencies not found at ${abs}; see archive/specs/010-dev-workflow-audit/data-model.md.`,
    );
  }
  return declaredPluginsFileSchema.parse(JSON.parse(fs.readFileSync(abs, "utf-8")));
}

/** A table cell may not break the row. Pipes are escaped; nothing else is rewritten. */
function cell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

/**
 * The catalogue table, sorted by name so the output is a function of the declaration's CONTENT
 * and not of its key order — an entry inserted in the middle of the JSON must not reshuffle the
 * document.
 *
 * Returned WITHOUT the markers, and with a leading and trailing newline, so the emitter can
 * splice it between them without deciding on spacing.
 */
export function renderPluginCatalogue(plugins: DeclaredPlugin[]): string {
  const rows = [...plugins]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => `| ${cell(p.name)} | ${cell(p.role)} | ${cell(p.tieBreak)} |`);
  return [
    "",
    "| Plugin | Role | Tie-break against what OE owns |",
    "|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}

/**
 * Substitute the generated region into an authored document. Returns the text unchanged when it
 * carries no BEGIN marker, so this is safe to run over every passthrough file.
 *
 * Throws when a document opens the region and never closes it: a half-marked file would silently
 * pass its content through as if it were authored, which is the failure this region exists to
 * make impossible.
 */
export function injectPluginCatalogue(text: string, plugins: DeclaredPlugin[]): string {
  const start = text.indexOf(PLUGIN_CATALOGUE_BEGIN);
  if (start === -1) return text;
  const afterBegin = start + PLUGIN_CATALOGUE_BEGIN.length;
  const end = text.indexOf(PLUGIN_CATALOGUE_END, afterBegin);
  if (end === -1) {
    throw new Error(
      `a document opens the declared-plugin region but never closes it (missing ${PLUGIN_CATALOGUE_END})`,
    );
  }
  return text.slice(0, afterBegin) + renderPluginCatalogue(plugins) + text.slice(end);
}
