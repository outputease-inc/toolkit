# Agents — Workflow Integration Guide

> Agent names and descriptions are auto-discovered by Claude Code from each agent's frontmatter in `.claude/agents/`. This file does **not** re-list them — it documents proactive triggering, chaining, and conflict resolution.

Code review and security review are handled by plugins:

- **coderabbit** plugin (`coderabbit:code-review` skill, runs automatically on GitHub PRs)
- **security-guidance** plugin (cross-cutting security guidance)
- **superpowers** plugin (`superpowers:requesting-code-review` skill orchestrates the local agents)

> **Model Selection**: All four local agents use `sonnet`. Their tasks are pattern-matching oriented and don't require the cost of `opus`.

---

## Proactive Triggering Matrix

| Trigger / Context | Primary Tool | Follow-up |
|-------------------|--------------|-----------|
| **New UI component** | test-writer | accessibility-reviewer, i18n-reviewer |
| **Security concern** | `/security-review` command | coderabbit:code-review skill |
| **New API endpoint** | `/security-review` command | test-writer |
| **Translation work** | i18n-reviewer | test-writer |
| **Form creation** | accessibility-reviewer | i18n-reviewer, test-writer |
| **Pre-PR checklist** | `superpowers:requesting-code-review` | a11y, i18n, dependency-auditor |
| **Auth changes** | `/security-review` command | test-writer |
| **package.json changes** | dependency-auditor | coderabbit on PR |
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
|   YES --> /security-review command (uses coderabbit + security-guidance) --> test-writer
|
+-- API or data layer?
|   YES --> /security-review command --> test-writer
|
+-- Translation / content?
|   YES --> i18n-reviewer --> test-writer
|
+-- Dependencies changed?
|   YES --> dependency-auditor
|
+-- Ready for PR?
    YES --> superpowers:requesting-code-review (orchestrates local agents)
         + coderabbit runs automatically on GitHub PR

ALWAYS END WITH: test-writer (if code was created or modified)
```

---

## Common Workflows

### New Component

**Chain**: `test-writer` --> `accessibility-reviewer` --> open PR (coderabbit reviews)

1. **test-writer**: Generate unit and accessibility tests
2. **accessibility-reviewer**: Validate WCAG 2.1 AA compliance
3. **Push and open PR**: coderabbit runs automated review on GitHub

### Security Concern

**Chain**: `/security-review` command --> `test-writer` --> coderabbit on PR

1. **`/security-review`**: Drives the OWASP Top 10 audit using coderabbit:code-review + security-guidance
2. **test-writer**: Generate tests covering security-critical paths
3. **coderabbit**: Final automated review when PR opens

### Pre-PR Checklist

**Chain**: `superpowers:requesting-code-review` (coordinates local agents)

1. **superpowers:requesting-code-review**: Orchestrates the surviving local agents
2. **accessibility-reviewer**: If UI components were modified
3. **i18n-reviewer**: If user-facing strings were changed
4. **dependency-auditor**: If `package.json` files changed
5. **coderabbit** (on PR open): Automated GitHub review with security + style + bugs

### Dependency Health Check

**Chain**: `dependency-auditor` --> coderabbit on PR

1. **dependency-auditor**: Audit workspace protocol, version conflicts, orphans, peer deps
2. **coderabbit**: Incorporate findings into automated PR quality gate

---

## Skills That Invoke Agents

| Agent | Invoked By | Context |
|-------|-----------|---------|
| accessibility-reviewer | **a11y-review** skill (Step 1) | Static analysis delegation |
| test-writer | **gen-test** skill (Step 4), **scaffold-feature** skill (Step 5) | Test file creation |
| i18n-reviewer | PR workflow | No direct skill invocation |
| dependency-auditor | PR workflow | No direct skill invocation |

> For skill details, see `.claude/skills/INDEX.md`.

---

## Conflict Resolution

When multiple agents produce contradictory recommendations:

1. **Security** always wins over convenience or style
2. **Accessibility** wins over performance optimizations
3. **Test coverage** recommendations are advisory, not blocking

---

For individual agent details, see each agent's frontmatter in `.claude/agents/`.
