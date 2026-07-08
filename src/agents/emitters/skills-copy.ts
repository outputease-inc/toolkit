import type { EmittedFile, Emitter } from "../types";
import { stripNeutralKeys } from "./shared";

/**
 * Skills copy emitter (spec 008, R4). Copies each neutral skill to the target's
 * `skills.copyPath` (Claude `.claude/skills/`). The neutral-only routing keys
 * (`args`, `targets`) are stripped from the frontmatter — Claude ignores them, so
 * dropping them makes the Claude copy byte-identical to the pre-migration skill.
 * The body (including any `$ARGUMENTS`) is copied verbatim; Claude substitutes it.
 */
export const skillsCopy: Emitter = (ctx): EmittedFile[] => {
  const copyPath = ctx.target.skills.copyPath;
  if (!copyPath) return [];
  return ctx.source.skills
    .filter((s) => !s.frontmatter.targets || s.frontmatter.targets.includes(ctx.target.id))
    .map((skill) => ({
      path: `${copyPath}/${skill.dirName}/SKILL.md`,
      content: `---\n${stripNeutralKeys(skill.rawFrontmatter)}\n---\n${skill.body}`,
      target: ctx.target.id,
      family: "skills-copy",
      source: `.agents/skills/${skill.dirName}/SKILL.md`,
    }));
};
