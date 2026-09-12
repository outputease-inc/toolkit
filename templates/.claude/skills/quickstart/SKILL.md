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

Surface an open Release PR at session start so it never rots:

```bash
gh pr list --state open --label "autorelease: pending" --json number,title,createdAt
```

- None open → skip silently.
- One open → `Release: PR #<n> open <N>d — merge to ship.`

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

`AskUserQuestion` takes at most 4 options, and the backlog runs to a dozen or more —
so **which** ideas are offered is a decision, and it needs a stated rule rather than
whatever order the file happens to be in.

**Ordering rule**: rank by readiness tier, then by detail, then by document order.

1. `[Ready: Spec]` and `[Ready: Direct]` — an idea already judged ready
2. `[Developing]` — refinement already started
3. `[Raw]` — never refined

Within a tier, more structured bullets first: detail is the best available proxy for how
close an idea is to being actionable. Ties break by position in TODO.md, which is stable
and needs no timestamp the file does not carry.

Offer the **top 3** plus "Skip for now". State the total — "3 of 19 shown, highest-readiness
first" — so the cut is visible rather than silent, and name TODO.md as where the rest are.

If the user wants one that was not offered, they say so and you take it; the ranking picks
a default, it does not restrict the choice.

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

Three sources, in this order, first hit wins. A miss on all three is a normal outcome,
not a failure — most sessions are not feature sessions.

```bash
# 1. Branch prefix. Yields a number only when a spec-kit feature branch is checked out;
#    /speckit-specify's git hook creates those. Most sessions run on `main`, where this arm
#    correctly yields nothing — that is a miss in FEATURE DETECTION, and says nothing about
#    where the work should be edited or how it should land (Git Workflow, three axes).
git branch --show-current | grep -oE '^[0-9]{3}'

# 2. HANDOFF.md "Current Focus", which names the feature in prose whatever the branch is.

# 3. specs/NNN-*/ with the most recently modified tasks.md — where the work actually
#    lives. This arm is what makes the phase work on `main`.
ls -dt specs/[0-9][0-9][0-9]-*/ 2>/dev/null | head -1
```

Do not treat arm 1's empty result as an error to report; fall through silently. Say which
arm answered when you display the result, so a stale HANDOFF entry is visible as such
rather than reading as the branch's verdict.

### 3.2 Load Feature Files

If feature detected (e.g., `001`) and Spec-Kit is installed:

- Read `specs/001-*/quickstart.md` (if exists)
- Read `specs/001-*/tasks.md` (task status)
- Summarize current progress

Display: feature name/number, status, quick start summary (if exists), and task progress (completed/current/next).

### 3.3 Isolation Advisory

This advisory is about **where you will edit**, not about branches or reviews. Executing a
written plan is Git Workflow § Axis 1 trigger 1, and `/speckit-implement` is exactly that.

Show it when ALL of these hold:

1. The session is about to **implement** — the detected feature's spec-kit artifacts are all
   present (spec.md, plan.md, tasks.md), or the user's `$ARGUMENTS` say they are picking up
   implementation.
2. You are in the **main checkout**, not a linked worktree:
   ```bash
   # equal => main checkout; differing (with an empty superproject) => linked worktree
   git rev-parse --path-format=absolute --git-dir
   git rev-parse --path-format=absolute --git-common-dir
   git rev-parse --show-superproject-working-tree
   ```
3. The current branch is the default branch (`main`).

```
ISOLATION ADVISORY
---------------------------------------------------------------------
Feature [XXX-feature-name] is ready for implementation, and you're in the
main checkout on main.

Executing a written plan is an isolation trigger (Git Workflow, Axis 1).
Set up an isolated workspace before implementing -- prefer the harness-native
mechanism (Claude Code: EnterWorktree), which owns placement, branch creation
and cleanup.

This is about WHERE you edit. It says nothing about how the work lands:
a worktree is not a pull request, and this feature may still merge straight
to main (Git Workflow, Axis 2).

Then run /speckit-implement.
---------------------------------------------------------------------
```

**Skip this advisory if:**

- You are already in a linked worktree (check 2 above). Being on a `NNN-` branch is NOT a
  skip condition — spec-kit's `git checkout -b` is a branch switch in the current checkout,
  which is not isolation.
- The session is not about to implement (browsing, reviewing, answering a question).
- Feature spec-kit is incomplete (missing spec.md, plan.md, or tasks.md).

This advisory never asserts that a feature branch is required, and never suggests a PR.
Integration is decided separately, by the five triggers in Git Workflow § Axis 2.

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
