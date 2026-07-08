---
name: resume
description: Quick recovery check after unexpected session interruption
allowed-tools: Read Glob Grep Bash
disable-model-invocation: true
---

## User Input

$ARGUMENTS

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Quickly assess the state after an unexpected session interruption (crash,
network issue, urgent switch). Shows what work might need recovery and suggests
next steps.

## When to Use

- After browser/IDE crash
- After network interruption
- After urgent context switch
- When unsure if last session ended cleanly

**Note**: For normal session starts, use `/quickstart` instead.

## Execution

### 1. Check Git State

Run in parallel:

```bash
git status --short
git stash list
git log --oneline -1
```

### 2. Check for Uncommitted Work

Parse `git status`:

- Count modified files
- Count staged files
- Count untracked files

### 3. Check for Stashed Work

Parse `git stash list`:

- List any stashes with dates/descriptions
- Highlight recent stashes (< 24 hours)

### 4. Get Last Session Context

Read `HANDOFF.md` and extract:

- Last session date
- Last work completed
- Last next action

### 5. Display Recovery Report

```
===================================================================
  SESSION RECOVERY CHECK
===================================================================

GIT STATE
---------------------------------------------------------------------
Branch: [current branch]
Last Commit: [hash] [message]

[If uncommitted work]:
WARNING: UNCOMMITTED CHANGES FOUND
   Modified:  [N] files
   Staged:    [N] files
   Untracked: [N] files

   Run: git status   (to see details)
   Run: /checkpoint  (to save work)
   Run: /commit-commands:commit (for proper commit, if plugin installed)

[If clean]:
Working tree clean - no uncommitted changes

STASHED WORK
---------------------------------------------------------------------
[If stashes exist]:
WARNING: STASHED CHANGES FOUND
   stash@{0}: [description] ([date])

   Run: git stash pop   (to restore)
   Run: git stash list  (to see all)

[If no stashes]:
No stashed changes

LAST SESSION
---------------------------------------------------------------------
Date: [Last session date from HANDOFF.md]
Work Completed: [Summary]
Next Action: [What was planned]

---------------------------------------------------------------------

RECOMMENDED NEXT STEPS
---------------------------------------------------------------------
[Based on state, suggest appropriate action]:

[If uncommitted work]:
1. Review changes: git diff
2. Save progress: /checkpoint
3. Continue work: /quickstart

[If stashed work]:
1. Restore stash: git stash pop
2. Review changes: git status
3. Continue work: /quickstart

[If clean]:
1. Start fresh: /quickstart

===================================================================
```

## Difference from /quickstart

| Command           | Purpose                           | When to Use                   |
| ----------------- | --------------------------------- | ----------------------------- |
| `/resume`     | Recovery check after interruption | After crashes, network issues |
| `/quickstart` | Normal session initialization     | Beginning of planned work     |

`/resume` is a diagnostic tool. After running it, you typically follow
up with `/quickstart` to properly initialize the session.

## Principles

- **Fast**: Quick diagnostic, not full session setup
- **Non-destructive**: Read-only checks, no modifications
- **Informative**: Shows exactly what state you're in
- **Actionable**: Clear next steps based on findings
