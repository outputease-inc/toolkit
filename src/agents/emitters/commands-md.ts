import type { EmittedFile, Emitter } from "../types";

/**
 * OpenCode command-wrapper emitter (spec 008, R4). For each `args: substituted`
 * skill, emits `.opencode/commands/<name>.md` — OpenCode substitutes `$ARGUMENTS`
 * natively, so the body is kept verbatim under a minimal frontmatter. Skills
 * scoped away from opencode via `targets` are skipped.
 */
export const commandsMdOpencode: Emitter = (ctx): EmittedFile[] => {
  const wrapper = ctx.target.skills.wrapper;
  if (!wrapper) return [];
  return ctx.source.skills
    .filter((s) => s.frontmatter.args === "substituted")
    .filter((s) => !s.frontmatter.targets || s.frontmatter.targets.includes(ctx.target.id))
    .map((skill) => ({
      path: `${wrapper.dir}/${skill.dirName}.md`,
      content: `---\ndescription: ${JSON.stringify(skill.frontmatter.description)}\n---\n${skill.body}`,
      target: ctx.target.id,
      family: "commands-md-opencode",
      source: `.agents/skills/${skill.dirName}/SKILL.md`,
    }));
};
