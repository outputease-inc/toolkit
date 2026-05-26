# Skills — Workflow Chains & Creation Guide

> Skill names and descriptions are auto-discovered by Claude Code from each `SKILL.md` frontmatter (see [skills docs](https://code.claude.com/docs/en/skills)). This file does **not** re-list them — it documents how skills compose and how to add new ones.

## Workflow Chains

### New Feature Development

1. `/capture` → quick-record an idea to TODO.md
2. `/develop-idea` → brainstorm and plan; at readiness pick `[Ready: Direct]` (this branch) or `[Ready: Spec]` (`/speckit-specify`)
3. **scaffold-feature** → full-stack entity (db + types + UI + tests)
4. **a11y-review** → verify accessibility
5. `/checkpoint` → save progress

Manual step-by-step:

1. `/develop-idea`
2. **create-migration** (if data layer)
3. **add-zod-schema**
4. **new-component**
5. **gen-test**
6. **a11y-review**
7. `/checkpoint`

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

### Documentation Maintenance

1. **maintenance** → audit
2. Fix issues interactively
3. `/checkpoint`

### Toolkit Dataset Hygiene

1. **staleness-audit**
2. `bun run validate` (47 structural rules)
3. `/checkpoint`

## Creating a New Skill

1. Copy `_TEMPLATE.md` to `skills/<skill-name>/SKILL.md`
2. Fill frontmatter (`name`, `description`); description should include trigger keywords
3. Follow template structure: Usage → Procedure → Output Format → Examples → Notes
4. Keep under 500 lines (move reference material to sibling files; link from SKILL.md)
5. Forward slashes in all paths

### Naming

kebab-case action: `a11y-review`, `new-component`, `db-migration`.

> **Notation**: **bold** = skill (`.claude/skills/`). `/slash` = command (`.claude/commands/`).

## Notes

- Claude Code loads skill names always; descriptions up to 1% of context window (configurable via `skillListingBudgetFraction` setting). Run `/doctor` to check budget.
- Skill body only loads when invoked. Keep `SKILL.md` body lean — every line is recurring token cost once loaded.
- Live change detection: edits to `SKILL.md` apply within the current session without restart.

## Related

- `.claude/agents/` — agent definitions; see `.claude/docs/AGENTS-INDEX.md` for workflow patterns
- `.claude/docs/PLUGINS-INDEX.md` — plugin-provided skills (install recipes)
- `_TEMPLATE.md` — skill scaffolding template
