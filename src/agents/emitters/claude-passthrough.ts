import { injectPluginCatalogue } from "../plugins";
import type { EmittedFile, Emitter } from "../types";

/**
 * Claude passthrough emitter (spec 008, R8). Every file under
 * `.agents/targets/claude/` is emitted verbatim to `.claude/` — hooks, settings,
 * subagents, docs, and the integration-owned skills. Byte-identical by
 * construction, which is what makes the migration proof trivial for this subtree.
 *
 * ONE EXCEPTION, spec 010 US8: a passthrough document may carry the declared-plugin region,
 * whose contents are rendered from `.agents/plugins.json` (FR-021). `injectPluginCatalogue`
 * returns every other file unchanged, so "verbatim" still describes the whole tree apart from
 * the bytes between those two markers.
 *
 * The region is spliced HERE rather than emitted as a file of its own so the catalogue stays in
 * the operator-facing document that already carries the local asset counts. The authored source
 * is never written by generation, which is what keeps those counts' derived assertions resolving
 * to a file a human may edit (contracts/derived-assertions.md, "Failure output shape").
 */
export const claudePassthrough: Emitter = (ctx): EmittedFile[] =>
  ctx.source.claudePassthrough.map((file) => ({
    path: `.claude/${file.relPath}`,
    content: injectPluginCatalogue(file.content, ctx.source.declaredPlugins),
    target: "claude",
    family: "claude-passthrough",
    source: `.agents/targets/claude/${file.relPath}`,
  }));
