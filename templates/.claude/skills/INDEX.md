# Skills — Workflow Chains & Creation Guide

> Skill names and descriptions are auto-discovered by Claude Code from each `SKILL.md` frontmatter (see [skills docs](https://code.claude.com/docs/en/skills)). This file does **not** re-list them — it documents how skills compose and how to add new ones.

## Workflow Chains

### New Feature Development (day-scale — superpowers backbone)

1. `/capture` → quick-record an idea to TODO.md
2. `/develop-idea` → thin wrapper: resolves the TODO entry, then `superpowers:brainstorming` designs it; scope gate picks `[Ready: Direct]` (day-scale) or `[Ready: Spec]` (multi-session → `/speckit-specify`)
3. `superpowers:writing-plans` → implementation plan in `docs/superpowers/plans/`
4. `superpowers:subagent-driven-development` (same session) or `superpowers:executing-plans` (fresh session) → implement task-by-task with `superpowers:test-driven-development`; reach for **scaffold-feature** / **create-migration** / **add-zod-schema** / **new-component** / **gen-test** / **a11y-review** as implementation tools inside tasks
5. `superpowers:verification-before-completion` → evidence via `/dev-check`
6. `superpowers:requesting-code-review` → pre-merge multi-lens pass
7. `superpowers:finishing-a-development-branch` → integrate (or `/checkpoint` mid-stream)

### New Feature Development (multi-session — spec-kit)

1. `/capture` → `/develop-idea` → scope gate lands `[Ready: Spec]`
2. `/speckit-specify` → `clarify` → `plan` → `tasks` → `analyze` → `implement`
3. Moment-based superpowers skills still apply inside implementation (systematic-debugging, test-driven-development, verification-before-completion)

### New Database Entity

1. **scaffold-feature** → orchestrates the full chain
2. `/dev-check` → verify

Manual:

1. **create-migration**
2. **add-zod-schema**
3. **gen-test** (Zod schemas)
4. `/dev-check`

### Pre-PR Quality Check

1. **a11y-review**
2. `/security-review`
3. `/dev-check`

## Creating a New Skill

1. Copy `_TEMPLATE.md` to `skills/<skill-name>/SKILL.md`
2. Fill frontmatter (`name`, `description`); description should include trigger keywords
3. Follow template structure: Usage → Procedure → Output Format → Examples → Notes
4. Keep under 500 lines (move reference material to sibling files; link from SKILL.md)
5. Forward slashes in all paths

### Naming

kebab-case action: `a11y-review`, `new-component`, `create-migration`.

> **Notation**: everything is a skill in `.claude/skills/` now. **bold** names and slash
> names both refer to skills; a leading slash just means "invoke it as a slash command." The session
> rituals (`quickstart`, `checkpoint`, `dev-check`, `develop-idea`, `capture`, `load-context`,
> `resume`, `security-review`, `session-end`, `add-app`, `add-package`) were formerly
> `.claude/commands/` and are now skills; most carry `disable-model-invocation: true` so they run
> only when you type them. Model-invocable exceptions: `develop-idea` and `speckit-archive`
> (handoff targets from `/quickstart` and `/session-end`), `dev-check` (verification evidence
> step), and `security-review` (audit on demand).

## Notes

- Claude Code loads skill names always; descriptions up to 1% of context window (configurable via `skillListingBudgetFraction` setting). Run `/doctor` to check budget.
- Skill body only loads when invoked. Keep `SKILL.md` body lean — every line is recurring token cost once loaded.
- Live change detection: edits to `SKILL.md` apply within the current session without restart.

## Related

- `.claude/agents/` — agent definitions; see `.claude/docs/AGENTS-INDEX.md` for workflow patterns
- `.claude/docs/PLUGINS-INDEX.md` — plugin-provided skills (install recipes)
- `_TEMPLATE.md` — skill scaffolding template
