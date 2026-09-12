import { stringify as stringifyToml } from "smol-toml";
import type { EmittedFile, Emitter } from "../types";

/**
 * Gemini command-wrapper emitter (spec 008, R4). For each `args: substituted`
 * skill, emits `.gemini/commands/<name>.toml` whose `prompt` embeds Gemini's
 * `{{args}}` placeholder (rewritten from the neutral `$ARGUMENTS`). Skills scoped
 * away from gemini via `targets` are skipped.
 */
export const commandsTomlGemini: Emitter = (ctx): EmittedFile[] => {
  const wrapper = ctx.target.skills.wrapper;
  if (!wrapper) return [];
  return ctx.source.skills
    .filter((s) => s.frontmatter.args === "substituted")
    .filter((s) => !s.frontmatter.targets || s.frontmatter.targets.includes(ctx.target.id))
    .map((skill) => {
      const prompt = skill.body.replaceAll("$ARGUMENTS", "{{args}}");
      const toml = stringifyToml({ description: skill.frontmatter.description, prompt });
      return {
        path: `${wrapper.dir}/${skill.dirName}.toml`,
        content: `${toml}\n`,
        target: ctx.target.id,
        family: "commands-toml-gemini",
        source: `.agents/skills/${skill.dirName}/SKILL.md`,
      };
    });
};
