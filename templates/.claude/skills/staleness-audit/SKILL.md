---
name: staleness-audit
description: |
  Audit dev-stacks and agent-stacks datasets for content staleness: dead URLs,
  deprecated tools, stale beta entries, and broken install commands. Produces a
  severity-graded report with fix recommendations. Use after major dependency
  updates, quarterly for hygiene, or when adding new entries to the toolkit
  datasets. Also trigger when the user mentions "stale tools", "check URLs",
  "dataset freshness", "toolkit audit", or suspects a tool may have been
  deprecated or archived.
---

# Staleness Audit

Audit toolkit datasets for content freshness — dead URLs, deprecated tools, beta limbo, and broken install commands.

## Usage

Invoke with `/staleness-audit [mode]`

- `/staleness-audit` — full audit (includes URL liveness checks, slower)
- `/staleness-audit --quick` — structural checks only (no network requests, fast)

## When to Use

- After major dependency updates to the toolkit datasets
- Quarterly for dataset hygiene
- When adding new entries to dev-stacks or agent-stacks
- Before toolkit releases
- When suspecting a tool has been deprecated, archived, or moved

## Do NOT Use When

- For structural/cross-field validation — use `bun run validate` instead (24+23 deterministic rules)
- For doc/registry consistency — use `/maintenance` instead (CLAUDE.md table drift)
- For build/lint/test checks — use `/dev-check` instead

## Procedure

### Step 1: Load Datasets

Read both dataset files:

- `packages/toolkit/data/dev-stacks.json`
- `packages/toolkit/data/agent-stacks.json`

Count total entries. Report scope at the top of the output (e.g., "221 dev-stacks + 20 agent-stacks").

### Step 2: URL Liveness Checks

Skip this step if the user passed `--quick`.

For every entry with a non-null `url`, check liveness via Bash:

```bash
curl -sIL -o /dev/null -w "%{http_code} %{url_effective}" --max-time 10 "<url>"
```

Process in batches of 10 URLs to avoid overwhelming any single host. Between batches, add a brief pause (`sleep 1`).

**Severity mapping:**
- **Critical**: HTTP 404, 410, or 5xx — the resource is gone or broken
- **Warning**: Final URL domain differs from original (redirect to a different site) — the tool may have moved or been acquired
- **Info**: Response took >5 seconds — not broken, but worth noting

Collect all unique non-null URLs before starting. Many agent-stacks entries share the same URL (e.g., multiple plugins from the same GitHub repo) — deduplicate first to avoid redundant requests.

### Step 3: Maturity Review

Scan both datasets for entries with `maturity: "beta"`.

For each beta entry:
- Flag as **warning**: "Beta entry — review for promotion to stable or removal"
- If the entry also has `priority: "recommended"`, escalate to **critical**: recommending a beta tool to users is risky — it should either graduate to stable or drop to `priority: "optional"`

### Step 4: Content Keyword Analysis

Scan the `purpose` and `agentNotes` fields of every entry for staleness keywords (case-insensitive):

`deprecated`, `archived`, `unmaintained`, `end-of-life`, `EOL`, `sunset`, `legacy`, `replaced by`, `migrated to`, `no longer maintained`, `discontinued`

These keywords in a dataset entry's own description suggest the entry may be outdated. Flag each match as **warning** with the matched keyword and field name.

### Step 5: Agent-Stacks Install & MCP Audit

These checks apply only to `agent-stacks.json` entries.

**5a. Install command syntax**

For each entry with `installCommand`, verify the command starts with one of:
- `claude plugin install`
- `claude mcp add`

Flag malformed commands as **critical** — a broken install command means the tool can't be set up.

**5b. MCP config command**

For entries with `mcpConfig`, check that `mcpConfig.command` is a known binary:
`bunx`, `npx`, `node`, `gh`, `claude`, `docker`

Flag unknown commands as **warning** — they may work but should be reviewed.

**5c. Auth documentation**

For entries with `requiresAuth: true`, check that `agentNotes` is non-null and contains
at least one auth-related term (e.g., "auth", "token", "key", "login", "credential", "API key").

Flag missing auth guidance as **warning** — users need to know how to authenticate.

### Step 6: Report & Recommendations

Generate the report in the output format below. Group findings by severity (critical first),
then by check type within each severity level.

For each finding, include a concrete recommended action — not just "review this" but a
specific suggestion (e.g., "Update URL to new domain", "Promote to stable or demote to optional",
"Add auth setup instructions to agentNotes").

If zero findings across all checks: output "All entries passed staleness checks."

## Output Format

```
## Staleness Audit Report

**Scope:** N dev-stacks + M agent-stacks entries
**Mode:** full (with URL checks) | quick (structural only)
**Date:** YYYY-MM-DD

### Critical (X)

| Entry | Check | Details | Action |
|-------|-------|---------|--------|
| tool-name | url-liveness | HTTP 404 for https://... | Remove entry or update URL |

### Warnings (Y)

| Entry | Check | Details | Action |
|-------|-------|---------|--------|
| tool-name | beta-maturity | Beta since initial dataset | Promote to stable or remove |

### Info (Z)

| Entry | Check | Details | Action |
|-------|-------|---------|--------|
| tool-name | url-slow | Response took 8.2s | Monitor — may indicate instability |

---
**Summary:** X critical, Y warnings, Z info across N entries checked
```

After presenting the report, offer to fix actionable items interactively (e.g., updating URLs,
changing maturity, adding agentNotes). Confirm each change via AskUserQuestion before applying.

## Related Skills

- **maintenance** — Audits documentation/registry consistency (complementary, different scope)
- **`/dev-check`** — Run after fixes to verify build/lint/test still pass
- **`bun run validate`** — Structural cross-field validation (47 rules, runs in CI)

## Notes

- URL checks require network access and can take 1-2 minutes for the full dataset
- The `--quick` flag skips URL checks for fast structural-only audits
- This skill reads datasets but never modifies them without user confirmation
- Entries that pass all checks are healthy — no news is good news
- For newly added entries, run this skill alongside `bun run validate` for complete coverage
