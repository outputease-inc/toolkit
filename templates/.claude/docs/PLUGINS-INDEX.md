# Claude Code Plugin Index

**Version**: 1.0.0

17 plugins | ~18 commands | ~40 skills | ~14 agents | 4 MCP servers | 4 hook systems

This index catalogs the recommended Claude Code plugin ecosystem, organized by installation priority. Plugins extend Claude Code with workflow automation, quality tools, and integrations.

---

## Installation

### Prerequisites
- Claude Code v1.0.33 or later (run `claude --version` to check)

### Installing Plugins
Run inside a Claude Code session:
```
/plugin install <plugin-name>@claude-plugins-official
```
Or use the in-app UI: run `/plugin` and browse the **Discover** tab.

Alternatively, from your shell:
```bash
claude plugin install <plugin-name>@claude-plugins-official
```

### Verifying Installation
Run `/plugin` inside Claude Code and navigate to the **Installed** tab.

### Troubleshooting
| Symptom | Cause | Fix |
|---------|-------|-----|
| Plugin command not found | Plugin not installed | `/plugin install <name>@claude-plugins-official` |
| Hookify rules not firing | Hookify plugin missing | `/plugin install hookify@claude-plugins-official` |

---

## Quick Reference

| Plugin | Tier | Commands | Skills | Agents | Hooks |
|--------|------|----------|--------|--------|-------|
| superpowers | 1 | 3 | 14 | 1 | 1 |
| commit-commands | 1 | 3 | -- | -- | -- |
| hookify | 1 | 4 | 1 | 1 | 1 |
| claude-md-management | 1 | 1 | 1 | -- | -- |
| code-review | 2 | 1 | -- | -- | -- |
| pr-review-toolkit | 2 | 1 | -- | 6 | -- |
| code-simplifier | 2 | -- | -- | 1 | -- |
| plugin-dev | 3 | 1 | 7 | 3 | -- |
| frontend-design | 3 | -- | 1 | -- | -- |
| playground | 3 | -- | 1 | -- | -- |
| context7 | 4 | -- | -- | -- | -- |
| github | 4 | -- | -- | -- | -- |
| playwright | 4 | -- | -- | -- | -- |
| figma | 5 | -- | 3 | -- | -- |
| sentry | 6 | -- | 4+ | 1 | -- |
| posthog | 6 | -- | 1 | -- | -- |
| claude-code-setup | 7 | -- | 1 | -- | -- |

---

## Tier 1 -- Core Workflow

Install these first. They provide the foundational development workflow.

### superpowers
**Install**: `/plugin install superpowers@claude-plugins-official`

Structured workflows for every phase of development.

### commit-commands
**Install**: `/plugin install commit-commands@claude-plugins-official`

Git commit workflow with conventional format, PR creation, and branch cleanup.

### hookify
**Install**: `/plugin install hookify@claude-plugins-official`

User-configurable rule engine for enforcing workflow patterns.

### claude-md-management
**Install**: `/plugin install claude-md-management@claude-plugins-official`

CLAUDE.md file maintenance and improvement.

---

## Tier 2 -- Quality & Review

### code-review
**Install**: `/plugin install code-review@claude-plugins-official`

### pr-review-toolkit
**Install**: `/plugin install pr-review-toolkit@claude-plugins-official`

### code-simplifier
**Install**: `/plugin install code-simplifier@claude-plugins-official`

---

## Tier 3 -- Development Tools

### plugin-dev
**Install**: `/plugin install plugin-dev@claude-plugins-official`

### frontend-design
**Install**: `/plugin install frontend-design@claude-plugins-official`

### playground
**Install**: `/plugin install playground@claude-plugins-official`

---

## Tier 4 -- Infrastructure (MCP Servers)

Configured in `.mcp.json` at project root.

### context7
- **Type**: stdio
- **Command**: `bunx @upstash/context7-mcp`
- **Purpose**: Up-to-date documentation and code examples

### playwright
- **Type**: stdio
- **Command**: `bunx @playwright/mcp@latest`
- **Purpose**: Browser automation and E2E testing

---

## Spec-Kit

> **Note**: Spec-Kit is not a Claude Code plugin -- it is a standalone CLI
> tool (`specify-cli`) that provides the `/speckit-*` commands. Install via:
> `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git`
