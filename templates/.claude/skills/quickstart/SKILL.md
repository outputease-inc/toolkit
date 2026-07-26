---
name: quickstart
description: Fast session initialization (health check + session start + context load)
allowed-tools: Read Glob Grep Write Edit Bash TodoWrite AskUserQuestion Skill
disable-model-invocation: true
---

## User Input

$ARGUMENTS

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Quickly initialize a development session with a single command. Combines
environment verification, session context loading, and feature context in 30-60
seconds.

**This is a master command that combines:**

- Health check - Environment verification
- Session context loading - Load priorities and git status
- Feature context - Auto-load current feature context

## When to Use

- At the start of every development session
- After restarting your IDE or terminal
- When switching to this project from another
- To quickly get oriented and start working

## Execution

### 1. Header

```
===================================================================
  QUICK START
  Date: [YYYY-MM-DD]
===================================================================
```

---

## Phase 1: Health Check (5-10 sec)

Quick environment verification.

```bash
# Git
git --version
git branch --show-current

# Runtime
bun --version

# Package manager (Bun is both runtime and package manager)
# Already covered above
```

Display a table of component status (Git, Bun) with versions. If issues detected, show warnings with fixes.

> Fresh clone, or missing tools / env / MCP config? Run first-run setup once to
> provision (Claude Code: `/first-run`), then re-run `/quickstart`.

---

## Phase 2: Session Context (10-15 sec)

Load session context from project files:

### 2.1 Git Status

```bash
git status --short
git log --oneline -3
```

### 2.2 Read Priority Queue

Read `HANDOFF.md` and extract:

- Current feature in progress
- Priority queue (next 3 items)
- Any blockers

### 2.3 Check for Uncommitted Work

```bash
git stash list
git diff --stat HEAD
```

Display: branch, last commit, uncommitted file count, stash count, 3 recent commits, priority queue from HANDOFF.md, and any active blockers.

### 2.4 Check for a Queued Release PR

release-please batches version bumps into one open Release PR (label
`autorelease: pending`). It ships only when merged by hand — auto-merge is
disabled — so surface it at session start so it never rots:

```bash
gh pr list --state open --label "autorelease: pending" --json number,title,createdAt
```

- None open → skip silently.
- One open → show a one-line reminder with its age (days since `createdAt`):
  `Release: PR #<n> open <N>d — merge to ship queued package releases. Ship: gh pr merge <n> --squash --delete-branch`
- Presence alone triggers the line (no staleness gate); age is shown so you gauge
  urgency.

---

## Phase 2.5: TODO Backlog Review (Optional)

**If TODO.md doesn't exist or has no Ideas Backlog section: Skip silently.**

### 2.5.1 Parse Backlog

1. Read TODO.md "Ideas Backlog" section. For each H3 heading, extract:
   - Idea name and status tag: `[Raw]`, `[Developing]`, `[Ready: Direct]`, or `[Ready: Spec]`
   - Body content (prose paragraphs, bullets, notes)
   - Detail level: count structured bullet points (`-` items)
2. Check `specs/` for directories matching each `[Ready: Spec]` idea name (if Spec-Kit is installed).
   - **If a matching spec directory exists**: The idea has been promoted. Remove its
     entire H3 section (heading + all body content until the next H3 or section
     boundary) from the Ideas Backlog. Update the footer to the exact format
     `**Last Updated**: YYYY-MM-DD` (today) — a bare date, nothing after it;
     never append change narrative (CI-enforced).
   - Ideas without matching specs continue to step 3.
   - `[Ready: Direct]` items are cleaned up by `/session-end` step 2.6, not here.
3. Items with 2+ bullets and no existing spec are "promotion candidates"

If no backlog ideas exist at all: skip silently to Phase 3.

### 2.5.2 Present Ideas & Gate

Display a summary of all backlog ideas (name, status tag, bullet count).

Use `AskUserQuestion`:
- Question: "Would you like to refine a backlog idea (you'll pick Direct or Spec path at readiness)?"
- Options: one per idea (all ideas regardless of bullet count, up to 4) + "Skip for now"

If "Skip for now" → continue to Phase 3.

### 2.5.3 Delegate to /develop-idea

If the user selected a backlog idea (anything other than "Skip for now"), refinement
before Phase 3 is required. The **delegation** is what is conditional here, never the
discipline.

**If `/develop-idea` is invocable** (the normal case): this is a **BLOCKING
REQUIREMENT** — invoke `/develop-idea [idea-name]` via the Skill tool BEFORE any other
action. Do NOT run an inline clarification loop here, and do NOT continue to Phase 3
until `/develop-idea` has run. Refinement, the readiness check, the idea brief, and any
spec/direct handoff are owned entirely by `/develop-idea` — quickstart does not
duplicate that logic.

**If `/develop-idea` cannot be invoked** (no Skill tool on this agent surface, or the
skill is absent): read the develop-idea skill file directly and run it inline from its
step 2 onward — `.claude/skills/develop-idea/SKILL.md` for Claude, or
`.agents/skills/develop-idea/SKILL.md` (read in place, per the Agent-Agnostic Workflow
convention) for other agent surfaces. The superpowers plugin is optional, so `/develop-idea`
may itself fall back to its step 3b inline design loop; that is the sanctioned path, not a
licence to skip refinement. This matches the scaffolded `CLAUDE.md` Process Skill Routing note:
without the plugin, follow the same discipline manually.

- Pass the selected idea's name as the argument so `/develop-idea` skips its own
  selection step and refines that idea directly.
- `/develop-idea` reads the idea's body from TODO.md, delegates the design
  dialogue to `superpowers:brainstorming`, writes captured bullets + status
  back to TODO.md, and resolves the scope gate to `[Ready: Direct]`
  (day-scale) or `[Ready: Spec]` (multi-session).

**On return from `/develop-idea`:**

- If it marked the idea `[Ready: Spec]` and handed off to `/speckit-specify`:
  **stop here** — the speckit workflow owns the session; do not run Phase 3.
- Otherwise (`[Ready: Direct]`, `[Developing]/paused`, or new idea): continue to
  Phase 3. The Final Summary surfaces the status-appropriate next step.

---

## Phase 3: Feature Context (15-20 sec)

Auto-detect and load current feature context:

### 3.1 Detect Current Feature

From branch name or HANDOFF.md:

```bash
# Extract feature number from branch (expects NNN- prefix, e.g., 001-auth-flow)
git branch --show-current | grep -oE '^[0-9]{3}'
```

Or read from HANDOFF.md "Current Focus" section.

### 3.2 Load Feature Files

If feature detected (e.g., `001`) and Spec-Kit is installed:

- Read `specs/001-*/quickstart.md` (if exists)
- Read `specs/001-*/tasks.md` (task status)
- Summarize current progress

Display: feature name/number, status, quick start summary (if exists), and task progress (completed/current/next).

### 3.3 Feature Branch Advisory

If feature has spec-kit artifacts ready (spec.md, plan.md, tasks.md all exist)
AND current branch is master/main, show advisory:

```
WARNING: BRANCH ADVISORY
---------------------------------------------------------------------
Feature [XXX-feature-name] is ready for implementation.
You're currently on: master

Before starting implementation, create a feature branch:
  git checkout -b XXX-feature-name

If Spec-Kit is installed, run /speckit-implement to begin tracked implementation.
---------------------------------------------------------------------
```

**Skip this advisory if:**

- Already on a feature branch (matches pattern `^\d{3}-`)
- Feature spec-kit is incomplete (missing spec.md, plan.md, or tasks.md)

---

## Final Summary

Display: today's focus (feature + current task), numbered list of suggested actions (continue implementation, review uncommitted changes, check blockers -- include only applicable items), and reminder to run `/session-end` at session end.

For backlog ideas not already promoted via Phase 2.5, include status-appropriate suggestions:
- `[Ready: Direct]` ideas → suggest "Begin implementation (no spec needed); `/session-end` will prompt for cleanup"
- `[Ready: Spec]` ideas with no spec → suggest `/speckit-specify [idea name]`
- `[Developing]` ideas → suggest `/develop-idea [idea name]` to continue refinement
- `[Raw]` ideas → suggest `/develop-idea [idea name]` to start development

---

**Phase 4: Develop Idea (handled in Phase 2.5)**
Backlog-idea refinement is owned by Phase 2.5, which delegates to `/develop-idea`
whenever the user picks an idea at the gate. There is no separate develop step here.

- If the user picked an idea in Phase 2.5: refinement already ran (step 2.5.3 —
  mandatory discipline, conditional delegation). Its outcome governs what happens
  next — `[Ready: Spec]` hands off to `/speckit-specify` (session ends here),
  `[Ready: Direct]` begins implementation in the current branch, anything else
  continues to the Final Summary.
- If the user chose "Skip for now" at the gate (or there was no backlog): the idea is
  left at its current status. Surface `/develop-idea [idea-name]` in the Final Summary
  suggested actions so the user can refine it later.

---

## User Input Options

- Empty - Auto-detect feature from branch/HANDOFF.md
- `[feature]` - Load specific feature (e.g., `001`, `auth`, `dashboard`)
- `--skip-health` - Skip environment check (faster)
- `--verbose` - Show detailed output
