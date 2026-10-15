import type { InstructionBlockFile } from "../source";
import type { EmittedFile, Emitter } from "../types";

/**
 * Instruction assembly emitters (spec 008, R2; amended by spec 010 US7).
 *
 * - `AGENTS.md` = the `core`-scoped block bodies in order, path-scoped or not.
 * - `CLAUDE.md` = the core + claude block bodies (incl. the SPECKIT block) in
 *   the original order, MINUS any block carrying `paths:`.
 * - `.claude/rules/<block>.md` = one file per path-scoped core/claude block.
 *
 * `CLAUDE.md` is therefore no longer a superset of `AGENTS.md`, and no longer
 * byte-identical to the pre-migration file: a `core`-scoped, path-scoped
 * block's bytes stay in `AGENTS.md` and leave `CLAUDE.md`. The replacement
 * identity is the four properties in
 * `archive/specs/010-dev-workflow-audit/contracts/block-frontmatter.md` (guarantee 4).
 *
 * The block bodies carry their own spacing, so assembly is a plain
 * concatenation (no injected separators) — which is why a filtered-out block
 * must remove exactly its body and nothing else.
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

/**
 * `.claude/rules/<block>.md` — path-scoped blocks, deferred off the always-loaded
 * claude surface. `<block>` is the `order.json` filename with `.md` removed and
 * the ordering prefix kept, so the mapping is derived from `order.json` and no
 * naming table exists that could drift (contract guarantee 3).
 */
export const claudeRules: Emitter = (ctx): EmittedFile[] =>
  ctx.source.blocks
    .filter(
      (b) =>
        b.frontmatter.paths !== undefined &&
        (b.frontmatter.scope === "core" || b.frontmatter.scope === "claude"),
    )
    .map((b) => ({
      path: `.claude/rules/${b.filename}`,
      // Body copied verbatim below the emitted frontmatter — no trimming,
      // re-wrapping or re-indenting, or the byte comparison stops being checkable.
      content: `---\npaths: [${(b.frontmatter.paths ?? []).map((p) => `"${p}"`).join(", ")}]\n---\n\n${b.body}`,
      target: "claude" as const,
      family: "claude-rules" as const,
      source: `${BLOCKS_SOURCE}/${b.filename}`,
    }));

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

/**
 * CLAUDE.md — core + claude blocks (incl. the claude-scoped SPECKIT block) in
 * order, MINUS the path-scoped ones, which `claudeRules` defers instead.
 * `instructionsAgentsMd` keeps them: codex, gemini and opencode have no
 * deferral mechanism, so bytes removed there would be deleted rather than
 * deferred. Both surfaces must not carry them, or contract guarantee 4 fails.
 */
export const instructionsClaudeMd: Emitter = (ctx): EmittedFile[] => {
  const content = assemble(
    ctx.source.blocks,
    (b) =>
      (b.frontmatter.scope === "core" || b.frontmatter.scope === "claude") &&
      b.frontmatter.paths === undefined,
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
