import type { InstructionBlockFile } from "../source";
import type { EmittedFile, Emitter } from "../types";

/**
 * Instruction assembly emitters (spec 008, R2).
 *
 * - `AGENTS.md` = the `core`-scoped block bodies in order.
 * - `CLAUDE.md` = ALL block bodies (core + claude + the SPECKIT block) in the
 *   original order — byte-identical to the pre-migration file because assembly
 *   preserves the interleaving. The block bodies carry their own spacing, so the
 *   assembly is a plain concatenation (no injected separators).
 */

const BLOCKS_SOURCE = ".agents/instructions/blocks";

function assemble(
  blocks: InstructionBlockFile[],
  keep: (b: InstructionBlockFile) => boolean,
): string {
  return blocks
    .filter(keep)
    .map((b) => b.body)
    .join("");
}

/** AGENTS.md — the shared instruction core (core-scoped blocks only). */
export const instructionsAgentsMd: Emitter = (ctx): EmittedFile[] => {
  const content = assemble(ctx.source.blocks, (b) => b.frontmatter.scope === "core");
  return [
    {
      path: "AGENTS.md",
      content,
      target: "shared",
      family: "instructions-agentsmd",
      source: BLOCKS_SOURCE,
    },
  ];
};

/** CLAUDE.md — core + claude blocks (incl. the claude-scoped SPECKIT block) in order. */
export const instructionsClaudeMd: Emitter = (ctx): EmittedFile[] => {
  const content = assemble(
    ctx.source.blocks,
    (b) => b.frontmatter.scope === "core" || b.frontmatter.scope === "claude",
  );
  return [
    {
      path: "CLAUDE.md",
      content,
      target: "claude",
      family: "instructions-claudemd",
      source: BLOCKS_SOURCE,
    },
  ];
};
