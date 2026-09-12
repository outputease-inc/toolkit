import type { EmittedFile, Emitter } from "../types";

/**
 * OpenCode passthrough emitter. Files under `.agents/targets/opencode/` are
 * emitted verbatim to `.opencode/` so OpenCode plugins and target-owned docs
 * stay generated outputs instead of hand-edited project config.
 */
export const opencodePassthrough: Emitter = (ctx): EmittedFile[] =>
  ctx.source.opencodePassthrough.map((file) => ({
    path: `.opencode/${file.relPath}`,
    content: file.content,
    target: "opencode",
    family: "opencode-passthrough",
    source: `.agents/targets/opencode/${file.relPath}`,
  }));
