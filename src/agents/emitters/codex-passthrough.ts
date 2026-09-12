import type { EmittedFile, Emitter } from "../types";

/**
 * Codex passthrough emitter. Files under `.agents/targets/codex/` are emitted
 * verbatim to `.codex/` so Codex hooks, rules, and custom agents stay generated
 * outputs instead of hand-edited project config.
 */
export const codexPassthrough: Emitter = (ctx): EmittedFile[] =>
  ctx.source.codexPassthrough.map((file) => ({
    path: `.codex/${file.relPath}`,
    content: file.content,
    target: "codex",
    family: "codex-passthrough",
    source: `.agents/targets/codex/${file.relPath}`,
  }));
