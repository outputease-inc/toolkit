---
description: Fast session initialization (health check + session start + context load)
allowed-tools: ["Read", "Glob", "Grep", "Write", "Edit", "Bash", "TodoWrite", "AskUserQuestion"]
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
     boundary) from the Ideas Backlog. Update `**Last Updated**` to today's date.
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

### 2.5.3 Iterative Clarification Loop (user-controlled)

For the selected idea, read its full body from TODO.md. Then enter an iterative
clarification loop. The user controls how many questions to answer -- there is no
fixed limit.

**Each iteration:**

1. Analyze the idea's current state (original prose + any bullets already captured)
2. Identify the most impactful gap. Adapt the question based on what's missing:
   - If no problem/user defined → ask about that first
   - If no scope boundary → ask about scope and out-of-scope items
   - If no constraints identified → ask about technical or business constraints
   - If those are covered → ask about dependencies, key behaviors, edge cases, etc.
3. Ask ONE clarification question via `AskUserQuestion` (provide suggested answers
   as options when the idea content gives enough context to propose reasonable defaults)
4. After receiving the answer:
   - Append as a bullet (`- [answer]`) under the idea heading in TODO.md
   - If idea is `[Raw]` and this is the first answer, update status to `[Developing]`
   - Save TODO.md

**After each answer**, use `AskUserQuestion` for loop control:
- Question: "Idea now has N details captured. What next?"
- Options:
  - "Ask another question" — continue the loop with the next most impactful gap
  - "Mark ready now" — exit loop, then choose Direct or Spec path (see 2.5.4)
  - "Save and continue session" — keep current status in TODO.md, continue to Phase 3

### 2.5.4 Mark Ready

When user selects "Mark ready now":

1. Use `AskUserQuestion` to choose the readiness path:
   - Question: "How should this idea be implemented?"
   - Options:
     - "Direct — implement in current branch" — no spec needed; status becomes `[Ready: Direct]`
     - "Spec — promote via /speckit-specify" — formal spec workflow; status becomes `[Ready: Spec]`

2. **If Direct chosen**:
   - Update the idea status to `[Ready: Direct]` in TODO.md
   - Continue to Phase 3 with a Final-Summary suggestion to begin implementation
   - The next `/session-end` will prompt for completion-driven removal (step 2.6)

3. **If Spec chosen**:
   - Update the idea status to `[Ready: Spec]` in TODO.md
   - Compose an enriched feature description from: original TODO.md prose + all recorded
     clarification bullets, formatted as a coherent paragraph suitable for `/speckit-specify`
   - Invoke `/speckit-specify [enriched description]` via the Skill tool — the quickstart
     session hands off to the speckit workflow at this point

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

**Phase 4: Develop Idea (Optional)**
This phase applies only when the user explicitly requests further development of
a backlog idea that was NOT promoted via Phase 2.5.

- If Phase 2.5 promoted an idea via the Spec path (status is now `[Ready: Spec]` and `/speckit-specify` was invoked): Phase 4 does not apply -- the spec workflow has taken over.
- If Phase 2.5 promoted an idea via the Direct path (status is now `[Ready: Direct]`): Phase 4 does not apply -- implementation begins in the current branch.
- If the user selected "Save and continue session" in Phase 2.5: the idea is preserved
  in TODO.md at its current status. Mention `/develop-idea [idea-name]` in the Final
  Summary suggested actions for continued refinement.
- Do NOT auto-invoke `/develop-idea` -- it is a separate, longer workflow that requires
  explicit user invocation.

---

## User Input Options

- Empty - Auto-detect feature from branch/HANDOFF.md
- `[feature]` - Load specific feature (e.g., `001`, `auth`, `dashboard`)
- `--skip-health` - Skip environment check (faster)
- `--verbose` - Show detailed output
