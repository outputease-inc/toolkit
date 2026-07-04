# Claude Code Plugin Index

**Version**: 2.0.0 · reconciled with installed reality 2026-07-01

**LOCAL assets** (repo-committed, in `.claude/`): 0 commands (converted to skills),
39 skills (16 speckit + 11 former session commands + 12 domain skills), 5 agents, 8 hooks,
4 hookify rules · **MCP**: 2 MCP servers via committed `.mcp.json` (context7, playwright).

**INSTALLED plugins** (user-global, `~/.claude/plugins/`): 19. These are NOT repo-committed —
they live in the user's environment and are the user's to add/remove. This index catalogs them
plus the external services the workflow assumes.

---

## Installation

### Prerequisites
- Claude Code 2.x or later (run `claude --version` to check)

### Installing Plugins
Run inside a Claude Code session:
```
/plugin install <plugin-name>@claude-plugins-official
```
Or use the in-app UI: run `/plugin` and browse the **Discover** tab. From your shell:
```bash
claude plugin install <plugin-name>@claude-plugins-official
```
Verify via `/plugin` → **Installed** tab. Run `/doctor` to see the skill-listing context budget
(every installed plugin loads its skill descriptions at session start).

---

## Installed plugins (19)

| Plugin | Role | Notes |
|--------|------|-------|
| superpowers | Structured dev workflows (14 skills) | Core; workflow backbone — moment→skill map in CLAUDE.md "Process Skill Routing" |
| security-guidance | Cross-cutting security guidance | Preferred security lens for `/security-review` when installed (the skill is self-sufficient without it) |
| hookify | User-configurable rule engine | The 5 `.claude/*.local.md` rules depend on it |
| commit-commands | `/commit`, `/commit-push-pr`, `clean_gone` | Git commit workflow |
| github | GitHub integration skills | Complements the `gh` CLI |
| Notion | Notion connector | Relevant to the `[Developing]` Notion integration |
| vercel | Deployment/AI skills (~28 skills) | apps/web deploys; **largest context consumer** |
| supabase | Postgres/auth guidance | apps/web data layer |
| frontend-design | Generic aesthetic-direction skill | **Kept intentionally** as a generic complement to the brand-specific `outputease-design` skill (not redundant with it) |
| pr-review-toolkit | 6 specialized PR agents (silent-failure-hunter, type-design-analyzer, …) | Heavyweight PR review; unique agents |
| skill-creator | Interactive skill authoring | Overlaps local `_TEMPLATE.md` + INDEX.md guide |
| typescript-lsp | IDE-grade TS type info | LSP-backed |
| playground | Interactive HTML playground builder | Utility |
| claude-code-setup | Automation recommender | One-time setup helper |
| code-review | `code-review:code-review` skill (PR) | **Redundant** with built-in `/code-review` |
| code-simplifier | 1 simplifier agent | **Redundant** with built-in `/simplify` |
| claude-md-management | CLAUDE.md upkeep | Overlaps the `maintenance` skill |
| context7 | Docs MCP | **Redundant** — also in committed `.mcp.json` (canonical) |
| playwright | Browser-automation MCP | **Redundant** — also in committed `.mcp.json` (canonical) |

> **Prune guidance (2026-07-01 audit).** The rows marked **Redundant** plus a few zero-signal
> utilities are candidates for `/plugin uninstall` to reduce the session context budget. Uninstalls
> are user-global (affect all your projects), so they're the user's call — see the cleanup plan for
> the specific list. Run `/doctor` before/after to quantify the budget change.

---

## External services (not local plugins)

### coderabbit — GitHub App
Automated AI code review that runs **on the GitHub side** when a PR is opened. It is a GitHub App,
**not** an installable local plugin, so it is never invoked from a skill or command — it simply
reviews the PR once it exists. (The `coderabbit@claude-plugins-official` *plugin* is not installed;
local review is handled by the built-in `/code-review` + `/simplify` and
`superpowers:requesting-code-review`.)

### Not installed / optional
`figma`, `sentry`, `posthog` are available in the plugin ecosystem but are **not installed** in this
project. Install on demand if a design-handoff (figma), error-monitoring (sentry), or product-analytics
(posthog) workflow is needed.

---

## MCP servers

Configured in committed **`.mcp.json`** at project root — the canonical, portable source
(persists even if plugins are removed):

| Server | Type | Command | Purpose |
|--------|------|---------|---------|
| context7 | stdio | `bunx -y @upstash/context7-mcp@latest` | Up-to-date library docs |
| playwright | stdio | `bunx -y @playwright/mcp@latest` | Browser automation / E2E |

> Both are ALSO available as installed plugins, which double-loads them (`mcp__context7__*` **and**
> `mcp__plugin_context7_context7__*`). `.mcp.json` is the primary source; uninstalling the
> context7/playwright plugins removes the duplicate.

Claude.ai connectors (Gmail, Google Calendar, Google Drive, Notion) and the vercel/supabase plugin
MCPs are also available in session when authenticated.

---

## Code review — which tool when

See **`.claude/docs/REVIEW-TOOLS.md`** for the decision tree (inline diff vs local pre-PR vs GitHub
PR vs security).

---

## Spec-Kit

> **Note**: Spec-Kit is not a Claude Code plugin — it is a standalone CLI tool (`specify-cli`) that
> provides the `speckit-*` skills. Install via:
> `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git`
