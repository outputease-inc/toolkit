---
name: maintenance
description: |
  Audit monorepo documentation health: cross-file consistency, duplication,
  staleness, and context bloat. Produces a severity-graded report then offers
  interactive fixes. Use after adding packages, commands, skills, or agents,
  before session-end, or periodically for hygiene. Also use when documentation
  feels stale or you suspect context pollution between CLAUDE.md and MEMORY.md.
---

# Documentation Maintenance

Audit monorepo documentation for consistency, duplication, and bloat, then interactively fix issues.

## Usage

Invoke with `/maintenance`

No arguments needed — always runs against the full monorepo.

## When to Use

- After adding a new package, command, agent, or skill
- Before `/session-end` when infrastructure files were changed
- Periodically (monthly or after major feature work)
- When CLAUDE.md or MEMORY.md feels bloated or stale
- After merging branches that touched `.claude/` infrastructure

## Do NOT Use When

- Making code-only changes with no documentation impact
- Mid-session during active feature development (run at session boundaries)
- Editing toolkit template files only (templates serve scaffolded projects, not this monorepo)

## Procedure

### Step 1: Registry Consistency

Verify that every table in CLAUDE.md matches what actually exists on the filesystem.
This is the cheapest check (Glob only) and catches the most common drift.

**1a. Package Map**

Glob `packages/*/package.json` to get actual packages. Compare against the
Package Map table in CLAUDE.md.

- ERROR: package directory exists but missing from table (or vice versa)

**1b. Commit Scopes**

Read `commitlint.config.ts` and extract `PACKAGE_SCOPES` + `EXTRA_SCOPES` arrays.
Compare the union against the Scopes list in CLAUDE.md's Versioning section.

- ERROR: package directory exists but missing from PACKAGE_SCOPES
- ERROR: CLAUDE.md scopes list doesn't match commitlint config

**1c. Release-Please Entries**

Read `release-please-config.json` (packages keys) and `.release-please-manifest.json`.
Cross-reference with `packages/` directories.

- ERROR: package directory has no entry in either file
- WARNING: manifest version is `0.0.0` (known bug — should be `0.0.1`)

**1d. Commands**

Glob `.claude/commands/*.md` to get actual command files. Parse the Session Workflow
table and Spec-Kit table from CLAUDE.md. Match command names to filenames.

- WARNING: command file exists but not referenced in CLAUDE.md
- ERROR: CLAUDE.md references a command that has no file

**1e. Agents**

Glob `.claude/agents/*.md`. Parse the Agents table in CLAUDE.md.

- WARNING: agent file exists but not in CLAUDE.md table
- ERROR: CLAUDE.md lists an agent that has no file

**1f. Skills**

Glob `.claude/skills/*/SKILL.md`. Parse the Skills table in CLAUDE.md.

- WARNING: skill directory exists but not in CLAUDE.md table
- ERROR: CLAUDE.md lists a skill that has no directory

### Step 2: Cross-Index Consistency

Check that secondary index files stay aligned with CLAUDE.md.

**2a. Skills INDEX.md vs CLAUDE.md**

Read `.claude/skills/INDEX.md` Quick Reference table. Compare skill names and
descriptions against the CLAUDE.md Skills table. Flag mismatches.

- WARNING: name or description differs between the two files

**2b. AGENTS-INDEX.md vs CLAUDE.md**

Read `.claude/docs/AGENTS-INDEX.md`. Compare the agent list and "Total Agents"
count against CLAUDE.md Agents table and actual `.claude/agents/` file count.

- WARNING: count mismatch or agent names differ

### Step 3: Duplication Detection

Identify information duplicated across context-loaded files. Both CLAUDE.md and
MEMORY.md are injected into every conversation, so overlap wastes tokens.

**3a. Gotchas / Key Learnings Overlap**

Read MEMORY.md. For each entry in CLAUDE.md's Gotchas section, check if the same
information appears in MEMORY.md's Key Learnings. Flag duplicates.

- INFO: entry exists in both files — recommend removing from MEMORY.md

**3b. Structural Overlap**

Check whether MEMORY.md repeats CLAUDE.md content beyond gotchas: package lists,
toolkit details, versioning info, Biome config notes.

- INFO: section substantially overlaps — recommend consolidating into one file

The guiding principle: MEMORY.md should contain learnings NOT already covered by
CLAUDE.md. Anything fully covered in CLAUDE.md should be removed from MEMORY.md.

### Step 4: Staleness & Bloat

Check files that accumulate content over time for threshold breaches.

**4a. HANDOFF.md Session Log**

Count rows in the "Recent Session Log" table.

- WARNING if > 5 entries → offer to trim to the 5 most recent

**4b. HANDOFF.md Recently Completed**

Count rows in the "Recently Completed" table.

- WARNING if > 5 entries → offer to trim to the 5 most recent

**4c. HANDOFF.md Resolved Risks**

Check "Risks & Blockers" for entries with Status = "Resolved".

- WARNING if any resolved items remain → offer to remove them

**4d. TODO.md Freshness**

Read `TODO.md`. Check the "Last Updated" date.

- INFO if older than 30 days → flag for review

**4e. MEMORY.md Length**

Count lines in MEMORY.md.

- WARNING if > 200 lines (system truncates beyond line 200)

### Step 5: Size Metrics

Report file sizes as a health dashboard. These are early warning signals.

| File | Soft Limit | Hard Limit |
|------|------------|------------|
| CLAUDE.md | 300 lines | 350 lines |
| MEMORY.md | 180 lines | 200 lines |
| Each SKILL.md | 400 lines | 500 lines |

- WARNING at soft limit, ERROR at hard limit
- Also report total `.claude/` file count as a growth metric (no threshold)

## Output Format

```
## Maintenance Report

**Date**: YYYY-MM-DD | **Files scanned**: N

### Summary

| Category                | Errors | Warnings | Info |
|-------------------------|--------|----------|------|
| Registry consistency    | N      | N        | N    |
| Cross-index consistency | N      | N        | N    |
| Duplication             | N      | N        | N    |
| Staleness & bloat       | N      | N        | N    |
| Size metrics            | N      | N        | N    |
| **Total**               | **N**  | **N**    | **N**|

### Errors

- [ERROR] [check-id]: [description] — [file:line]

### Warnings

- [WARNING] [check-id]: [description] — [file]

### Info

- [INFO] [check-id]: [description]

### Size Dashboard

| File | Lines | Limit | Status |
|------|-------|-------|--------|
| CLAUDE.md | N | 300/350 | OK / WARNING / ERROR |
| MEMORY.md | N | 180/200 | OK / WARNING |
| .claude/ total | N files | — | (metric) |

### Fix Queue

| # | Severity | File(s) | Proposed Fix |
|---|----------|---------|--------------|
| 1 | ERROR    | [path]  | [description]|
| 2 | WARNING  | [path]  | [description]|
```

After presenting the report, walk through the fix queue interactively:
1. Show each fix with a preview of the change
2. Confirm via AskUserQuestion before applying
3. After all fixes, re-run affected checks to verify resolution

## Related Skills

- **`/dev-check`** — Run after maintenance to verify build/lint/test still pass
- **`/checkpoint`** — Save maintenance fixes with a WIP commit
- **`/session-end`** — Run maintenance before session-end for clean handoffs

## Notes

- MEMORY.md path: user's project memory directory (not in the repo)
- The skill never modifies files without confirmation
- Registry checks (Step 1) catch 80% of issues — if short on time, run only Step 1
- Template drift (toolkit templates vs live files) is intentionally excluded — templates serve scaffolded projects, not this monorepo
