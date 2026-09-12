import type { EmittedFile, Emitter, EmitterContext } from "../types";
import { BLOCKS_SOURCE } from "./shared";

/**
 * IDE instruction addendum emitters (spec 008, R3). The IDE agents read AGENTS.md
 * natively for the core; these emit only the TARGET-SCOPED blocks into each IDE's
 * addendum surface (like GEMINI.md). Nothing is emitted when no target-scoped
 * blocks exist.
 * - Cursor: `.cursor/rules/*.mdc` with `alwaysApply: true`
 * - Windsurf: `.windsurf/rules/*.md` with `trigger: always_on` (12k char cap)
 * - Copilot: `.github/copilot-instructions.md`
 */

function scopedBody(ctx: EmitterContext): string {
  return ctx.source.blocks
    .filter((b) => b.frontmatter.scope === ctx.target.id)
    .map((b) => b.body)
    .join("");
}

export const instructionsMdcRule: Emitter = (ctx): EmittedFile[] => {
  const addendum = ctx.target.instructions.addendum;
  const body = scopedBody(ctx);
  if (!addendum || !body) return [];
  return [
    {
      path: addendum.placement,
      content: `---\nalwaysApply: true\n---\n${body}`,
      target: ctx.target.id,
      family: "instructions-mdc-rule",
      source: BLOCKS_SOURCE,
    },
  ];
};

export const instructionsWindsurfRule: Emitter = (ctx): EmittedFile[] => {
  const addendum = ctx.target.instructions.addendum;
  let body = scopedBody(ctx);
  if (!addendum || !body) return [];
  const header = "---\ntrigger: always_on\n---\n";
  const cap = addendum.charLimit;
  if (cap && header.length + body.length > cap) {
    const marker = "\n<!-- truncated at Windsurf rule char cap -->\n";
    body = `${body.slice(0, Math.max(0, cap - header.length - marker.length))}${marker}`;
  }
  return [
    {
      path: addendum.placement,
      content: `${header}${body}`,
      target: ctx.target.id,
      family: "instructions-windsurf-rule",
      source: BLOCKS_SOURCE,
    },
  ];
};

export const instructionsCopilotMd: Emitter = (ctx): EmittedFile[] => {
  const addendum = ctx.target.instructions.addendum;
  const body = scopedBody(ctx);
  if (!addendum || !body) return [];
  return [
    {
      path: addendum.placement,
      content: body,
      target: ctx.target.id,
      family: "instructions-copilot-md",
      source: BLOCKS_SOURCE,
    },
  ];
};
