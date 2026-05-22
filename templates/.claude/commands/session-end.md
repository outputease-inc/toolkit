---
description: Wrap up session with auto-commit, push, status update, and handoff notes
allowed-tools: ["Read", "Glob", "Grep", "Write", "Edit", "Bash", "TodoWrite", "Skill"]
---

This is a zero-flag command — no arguments needed. Just run `/session-end`.

## Goal

Properly close a development session by automatically committing pending work,
pushing to remote, updating status documentation, and creating handoff notes for
the next session. This ensures no work is lost and provides continuity.

## When to Use

- At the end of every development session
- Before taking a break longer than 30 minutes
- When switching to a different project

## Execution

### 1. Check Git Status

Run git commands:

```bash
git status --short
git diff --stat
```

Display current state to user:

```
GIT STATUS
---------------------------------------------------------------------
Branch: [current branch]
Changes: [X files modified, Y files staged, Z untracked]
```

### 2. Analyze Session Work

Review the conversation history to identify:

- **Tasks completed** this session
- **Features progressed** (which package/feature was worked on)
- **Decisions made** (any architectural or implementation choices)
- **Blockers encountered** (issues that need resolution)
- **Next actions** (what should happen next session)

### 2.5. Verify and Update Task Completion Status (Spec-Kit)

If `specs/` directory exists and Spec-Kit is installed, execute the task verification procedure. Use full conversation analysis (not just file inference).

If Spec-Kit is not installed, skip this step silently.

### 2.6. Direct-Ready Cleanup (TODO.md)

Read `TODO.md`. Find every H3 heading under the `## Ideas Backlog` section with status tag `[Ready: Direct]`. Skip this step silently if none exist.

For each `[Ready: Direct]` item, use AskUserQuestion:

- Question: `Did you complete "[idea title]" this session?`
- Options:
  - `Yes, remove from TODO` — delete the H3 section (heading + body until the next H3 or section boundary)
  - `No, keep on backlog` — leave the entry as-is
  - `Move back to [Developing]` — rewrite the status tag to `[Developing]`

After processing every Direct item, update the `**Last Updated**` date to today if any change was made. Use the same H3-section delete mechanic as `/quickstart` Phase 2.5.1 step 2 (heading + body until the next H3 or section boundary).

### 3. Update HANDOFF.md (Full Handoff)

Perform a **full handoff** update to HANDOFF.md using conversation analysis.

Read current `HANDOFF.md` and update:

1. **Update "Last Session" header** (line 3):
   - Format: `**Last Session**: YYYY-MM-DD ([work summary from conversation analysis])`
   - Use conversation context to describe what was accomplished
   - Example: `**Last Session**: 2026-02-17 (Integrated SOP into monorepo, scaffolded toolkit package)`

2. **Recent Session Log table**: Add new row with:
   - **Date**: Today's date
   - **Work Completed**: Detailed summary from conversation analysis (1-2 sentences)
   - **Next Action**: Specific next step based on session context

3. **Keep only the 5 most recent session log entries** to prevent bloat.

### 4. Conditionally Update CLAUDE.md

**Only update CLAUDE.md if**:

- New architectural patterns were established
- New important files were created
- Quick Reference section needs new entries
- New gotchas or troubleshooting items were discovered

If no significant changes: Skip this step.

### 5. Generate Handoff Notes

Create a session summary for next time:

```
===================================================================
  SESSION END: [Date]
  Duration: [Approximate time if determinable]
===================================================================

WORK COMPLETED
---------------------------------------------------------------------
[Bulleted list of completed work]

NEXT SESSION
---------------------------------------------------------------------
Priority: [What to work on next]
First Action: [Specific first step]
Context Needed: [Any files to load or review]

BLOCKERS/NOTES
---------------------------------------------------------------------
[Any blockers, decisions needed, or important notes]
(or "None" if no blockers)

STATUS
---------------------------------------------------------------------
Git: [Clean | X uncommitted files | Stashed]
Branch: [current branch]
Pushed: [Pushed to origin | Push failed | No new commits]
HANDOFF.md: Updated

---------------------------------------------------------------------
Next session: Run /quickstart to pick up where you left off
===================================================================
```

### 6. Auto-Commit (Final Step)

After all status updates complete, automatically commit any pending changes:

```bash
git status --short
```

**If uncommitted changes exist:**

1. Stage changes (prefer specific files over `git add -A`; skip secrets and binaries)
2. If `/commit-commands:commit` is available (plugin installed), invoke it with session context. Otherwise create a conventional commit manually:
   ```bash
   git add -u && git add [specific-untracked-files]
   git commit -m "feat|fix|chore(scope): brief description of session work"
   ```
3. If commit fails: report error but don't block session end.

**If no uncommitted changes:**

- Display: "Working tree clean — no commit needed"

### 7. Push to Remote

After successful commit, push the branch to the remote repository:

```bash
git push origin HEAD
```

**If push succeeds:**

- Display: "Pushed to origin/[branch-name]"

**If push fails:**

- Common causes: No upstream set, authentication issue, force push needed
- Display: "WARNING: Push failed: [error]. Run `git push` manually or set upstream."
- Don't block session end - report and continue

**If no commits were made:**

- Skip push step entirely
- Display: "No new commits to push"

### 8. Final Verification

Confirm all steps completed:

- [ ] Session work analyzed
- [ ] HANDOFF.md updated
- [ ] Session log entry added
- [ ] CLAUDE.md updated (if needed)
- [ ] Handoff notes displayed
- [ ] Changes committed (auto-commit)
- [ ] Branch pushed to remote
