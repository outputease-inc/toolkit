import type { EmittedFile, Emitter } from "../types";

/**
 * Claude passthrough emitter (spec 008, R8). Every file under
 * `.agents/targets/claude/` is emitted verbatim to `.claude/` — hooks, settings,
 * subagents, docs, and the integration-owned skills. Byte-identical by
 * construction, which is what makes the migration proof trivial for this subtree.
 */
export const claudePassthrough: Emitter = (ctx): EmittedFile[] =>
  ctx.source.claudePassthrough.map((file) => ({
    path: `.claude/${file.relPath}`,
    content: file.content,
    target: "claude",
    family: "claude-passthrough",
    source: `.agents/targets/claude/${file.relPath}`,
  }));
