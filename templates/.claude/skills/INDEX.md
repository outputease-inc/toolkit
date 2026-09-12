# Skills — Workflow Chains & Creation Guide

> Skill names and descriptions are auto-discovered by Claude Code from each `SKILL.md` frontmatter (see [skills docs](https://code.claude.com/docs/en/skills)). This file does **not** re-list them — it documents how skills compose and how to add new ones.

## Workflow Chains

### Project Onboarding (first run of a fresh scaffold)

1. `/first-run` → one-time guided setup: install deps, fill env vars, connect MCP servers, verify boot (surfaced by the scaffold's `## First-Run Setup` block; writes a `.outputease-first-run` marker so it retires itself)
2. `/quickstart` → the recurring per-session ritual from then on

### New Feature Development (day-scale — superpowers backbone)

> The superpowers plugin is optional (`claude plugin install superpowers@claude-plugins-official`).
> Without it, follow the same discipline manually: design before building, plan before executing,
> root-cause before fixing, evidence before "done".

1. `/capture` → quick-record an idea to TODO.md
2. `/develop-idea` → thin wrapper: resolves the TODO entry, then `superpowers:brainstorming` designs it; scope gate picks `[Ready: Direct]` (day-scale) or `[Ready: Spec]` (multi-session → `/speckit-specify`, if spec-kit is installed via `outputease speckit init`)
3. `superpowers:writing-plans` → implementation plan in `docs/superpowers/plans/`
4. `superpowers:subagent-driven-development` (same session) or `superpowers:executing-plans` (fresh session) → implement task-by-task with `superpowers:test-driven-development`; reach for **new-component** / **gen-test** / **a11y-review** as implementation tools inside tasks
5. `superpowers:verification-before-completion` → evidence via `/dev-check`
6. `superpowers:requesting-code-review` → pre-merge multi-lens pass
7. `superpowers:finishing-a-development-branch` → integrate (or `/checkpoint` mid-stream). How
   it lands — direct commit vs pull request, branch naming, push form — is CLAUDE.md's **Git
   Workflow** section; this chain does not restate it

### New Feature Development (multi-session — spec-kit)

1. `/capture` → `/develop-idea` → scope gate lands `[Ready: Spec]`
2. `/speckit-specify` → `clarify` → `plan` → `tasks` → `analyze` → `implement` (requires spec-kit; run `outputease speckit init` if it is not installed)
3. Moment-based superpowers skills still apply inside implementation (systematic-debugging, test-driven-development, verification-before-completion)
4. `/speckit-archive` → once the feature ships and its branch is merged, move the spec to `archive/specs/` (`/session-end` flags qualifying specs; run it explicitly)

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

kebab-case action: `a11y-review`, `new-component`, `gen-test`.

> **Notation**: everything is a skill in `.claude/skills/` now. **bold** names and slash
> names both refer to skills; a leading slash just means "invoke it as a slash command." The session
> rituals (`quickstart`, `continue`, `commit`, `checkpoint`, `dev-check`, `session-end`,
> `load-context`, `capture`, `develop-idea`, `security-review`) were formerly
> `.claude/commands/` and are now skills; `commit` is the one implementation of "make a commit"
> that the other git rituals route through. Which of them carry
> `disable-model-invocation: true` is stated once, in CLAUDE.md's **Session Workflow** table —
> read it there rather than from a copy here. `add-app` and `add-package` are not session
> rituals, so that table does not list them; neither carries the flag.

## Notes

- Claude Code loads skill names always; descriptions up to 1% of context window (configurable via `skillListingBudgetFraction` setting). Run `/doctor` to check budget.
- Skill body only loads when invoked. Keep `SKILL.md` body lean — every line is recurring token cost once loaded.
- Live change detection: edits to `SKILL.md` apply within the current session without restart.

## Related

- `.claude/agents/` — agent definitions; see `.claude/docs/AGENTS-INDEX.md` for workflow patterns
- `_TEMPLATE.md` — skill scaffolding template
