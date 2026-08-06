# Agents — Workflow Integration Guide

> Agent names and descriptions are auto-discovered by Claude Code from each agent's frontmatter in `.claude/agents/`. This file does **not** re-list them — it documents proactive triggering, chaining, and conflict resolution.

Code review and security review draw on:

- **built-in `/code-review` + `/simplify`** — inline review of the working diff (`/code-review`
  is effort-tuned for bugs/security; `/simplify` is cleanup-only). Start here for local review.
- **`superpowers:requesting-code-review` skill** — orchestrates the local agents for a pre-PR pass.
- **`security-guidance` plugin** — cross-cutting security guidance; optional lens for `/security-review` (the skill's own discovery + parallel surface passes are self-sufficient).
- **coderabbit GitHub App** — external; runs automatically on opened PRs. Not an installed local
  plugin, so it is not invoked from any skill — it just reviews the PR once it exists.

> The superpowers plugin is optional (`claude plugin install superpowers@claude-plugins-official`).
> Where a row below names a `superpowers:*` skill and the plugin is absent, invoke the local agents
> directly and follow the same discipline manually.
>
> For "which review tool when," see `.claude/docs/REVIEW-TOOLS.md`.

> **Model Selection**: All four local agents use `sonnet`. Their tasks are pattern-matching oriented and don't require the cost of `opus`.

---

## Proactive Triggering Matrix

> Process skills route first — see CLAUDE.md "Process Skill Routing". The
> matrix below covers agent/tool dispatch within that flow.
>
> Every chain and matrix row below that ends at a pull request assumes one is
> warranted. Whether it is -- and where the work is edited, and whether you may
> commit or push at all -- is CLAUDE.md's **Git Workflow** section (three axes,
> five PR triggers). Routine work lands as a direct commit to `main` and never
> reaches a coderabbit review. Commits themselves go through `/commit`, the one
> commit implementation every git ritual routes through; pushing and opening a PR
> need explicit instruction. This file states none of that policy -- it only names
> which reviewer to reach for.

| Trigger / Context | Primary Tool | Follow-up |
|-------------------|--------------|-----------|
| **Bug report / test failure** | `superpowers:systematic-debugging` (before any fix) | test-writer (regression test) |
| **New UI component** | test-writer | accessibility-reviewer, i18n-reviewer |
| **Security concern** | `/security-review` skill | `/code-review` (working diff) |
| **New API endpoint** | `/security-review` skill | test-writer |
| **Translation work** | i18n-reviewer | test-writer |
| **Form creation** | accessibility-reviewer | i18n-reviewer, test-writer |
| **Pre-PR checklist** | `superpowers:requesting-code-review` | a11y, i18n, dependency-auditor |
| **Auth changes** | `/security-review` skill | test-writer |
| **package.json changes** | dependency-auditor | coderabbit GitHub App on PR |
| **Pre-deployment** | `/security-review` + all local reviewers | -- |

---

## Decision Flow

```
What kind of work is this?
|
+-- User-facing UI?
|   YES --> accessibility-reviewer --> i18n-reviewer --> test-writer
|
+-- Security or auth related?
|   YES --> /security-review skill (surface-pass fan-out; security-guidance + /code-review when available) --> test-writer
|
+-- API or data layer?
|   YES --> /security-review skill --> test-writer
|
+-- Translation / content?
|   YES --> i18n-reviewer --> test-writer
|
+-- Dependencies changed?
|   YES --> dependency-auditor
|
+-- Ready for PR?
    YES --> superpowers:requesting-code-review (orchestrates local agents)
         + coderabbit GitHub App reviews automatically once the PR is opened

ALWAYS END WITH: test-writer (if code was created or modified)
```

---

## Common Workflows

### New Component

**Chain**: `test-writer` --> `accessibility-reviewer` --> open PR (coderabbit GitHub App reviews)

1. **test-writer**: Generate unit and accessibility tests
2. **accessibility-reviewer**: Validate WCAG 2.1 AA compliance
3. **Push and open PR**: the coderabbit GitHub App runs its automated review on GitHub

### Security Concern

**Chain**: `/security-review` skill --> `test-writer` --> coderabbit GitHub App on PR

1. **`/security-review`**: Discovers the project's security surfaces, then runs parallel
   surface-scoped OWASP Top 10 passes — `security-guidance` as an extra lens and a focused
   built-in `/code-review` diff pass when available
2. **test-writer**: Generate tests covering security-critical paths
3. **coderabbit GitHub App**: Automated review once the PR opens

### Pre-PR Checklist

**Chain**: `superpowers:requesting-code-review` (coordinates local agents)

1. **superpowers:requesting-code-review**: Orchestrates the local agents
2. **accessibility-reviewer**: If UI components were modified
3. **i18n-reviewer**: If user-facing strings were changed
4. **dependency-auditor**: If `package.json` files changed
5. **coderabbit GitHub App** (on PR open): Automated GitHub review with security + style + bugs

### Dependency Health Check

**Chain**: `dependency-auditor` --> coderabbit GitHub App on PR

1. **dependency-auditor**: Audit workspace protocol, version conflicts, orphans, peer deps
2. **coderabbit GitHub App**: Picks up the change in its automated PR quality gate

---

## Skills That Invoke Agents

| Agent | Invoked By | Context |
|-------|-----------|---------|
| accessibility-reviewer | **a11y-review** skill (Step 1) | Static analysis delegation |
| test-writer | **gen-test** skill (Step 4) | Test file creation |
| i18n-reviewer | PR workflow | No direct skill invocation. Its Step 0 defers key parity, empty values, ICU placeholders and the em-dash ban to `apps/portage/src/i18n/catalogs.test.ts`, which runs in CI; the agent covers what that test does not — placeholder text, untranslated copies, source-language leakage, and code-usage cross-reference |
| dependency-auditor | PR workflow | No direct skill invocation |

> For skill details, see `.claude/skills/INDEX.md`.

---

## Conflict Resolution

When multiple agents produce contradictory recommendations:

1. **Security** always wins over convenience or style
2. **Accessibility** wins over performance optimizations
3. **Test coverage** recommendations are advisory, not blocking

---

> The 5 local agents (`accessibility-reviewer`, `test-writer`, `i18n-reviewer`,
> `dependency-auditor`, `release-leak-scanner`) occupy narrow domains that no plugin this
> repository *depends on* covers — the five declared in `.agents/plugins.json`. It previously
> scoped that claim to the plugin agents that happened to be **installed**, verified against a
> 2026-07-01 config audit: machine state asserted from a dated snapshot, and the roster has
> changed twice since. Whether a given machine carries something that overlaps is answered by
> `/plugin`, not here (FR-025). For individual agent details, see each agent's frontmatter in `.claude/agents/`.
