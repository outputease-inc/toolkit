---
name: session-end
description: Wrap up session with auto-commit, push, status update, and handoff notes
allowed-tools: Read Glob Grep Write Edit Bash TodoWrite Skill
disable-model-invocation: true
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

After processing every Direct item, set the footer to the exact format `**Last Updated**: YYYY-MM-DD` (today) if any change was made — a bare date, nothing after it. Never append change narrative; git history is the changelog. CI rejects anything else. Use the same H3-section delete mechanic as `/quickstart` Phase 2.5.1 step 2 (heading + body until the next H3 or section boundary).

### 2.65. Stale-Entry Sweep (TODO.md)

Scan every H3 entry body under `## Ideas Backlog` for shipped-evidence markers: `~~`, `DONE`, `shipped`, `landed`, `superseded`, a `spec NNN` reference paired with a shipped/merged verb, or a 7-hex commit hash paired with a shipped/merged verb. Skip this step silently if nothing matches.

For each flagged entry, use AskUserQuestion:

- Question: `"[idea title]" looks (partly) shipped or superseded — prune it?`
- Options:
  - `Remove entry` — delete the H3 section (heading + body until the next H3 or section boundary)
  - `Slim to open remainder` — delete the shipped/decided/superseded detail; keep the heading, the still-open scope, and a pointer to the source-of-truth doc or spec. Slimming removes the markers, so the entry stops re-flagging.
  - `Keep as-is` — leave it; it re-flags next session end

Update `**Last Updated**` (bare date) if any change was made.

### 2.7. Spec Archival Check (Spec-Kit)

If `specs/` exists, evaluate each `specs/NNN-*` directory against the finished
checks (cheap greps, no reference graph):

1. `tasks.md` exists with zero unchecked boxes (`- [ ]`)
2. Merged to main: no unmerged `NNN-*` branch, no uncommitted changes under the dir
3. NOT cited by CLAUDE.md as frozen/superseded/inherited context (such specs
   are live references, not rot)

Skip this step silently if `specs/` is absent or no directory passes all three.

For each qualifying spec, use AskUserQuestion:

- Question: `Spec [NNN-name] looks finished (tasks complete, merged). Archive it now?`
- Options:
  - `Archive now` — invoke `/speckit-archive [NNN-name]` via the Skill tool
  - `Keep active` — leave it; it will be re-flagged next session end

### 3. Update HANDOFF.md (Full Handoff)

Perform a **full handoff** update to HANDOFF.md using conversation analysis.

Read current `HANDOFF.md` and update:

1. **Update "Last Session" header**: in the block between the `# Next Steps` title and the first `##` heading, REPLACE the `**Last Session**:` line with a single new one (using conversation analysis for the summary) and delete every other narrative line in that block — never retain or demote the previous entry: no `<!-- prior: -->` markers, no `**Prior Session**` lines. The Recent Session Log table is the only in-file history; git preserves the rest. RETAIN and refresh the `**Current Focus**` line from conversation analysis (add it on line 4 if missing). Net result: the block contains exactly two content lines — `**Last Session**` and `**Current Focus**`. Anything the NEXT session must know beyond this one entry goes into Priority Queue or Risks & Blockers — never into a longer narrative.
   - Format: `**Last Session**: YYYY-MM-DD ([work summary from conversation analysis])`
   - Use conversation context to describe what was accomplished
   - Example: `**Last Session**: 2026-02-17 (Integrated SOP into monorepo, scaffolded toolkit package)`

2. **Recent Session Log table**: Add new row with:
   - **Date**: Today's date
   - **Work Completed**: Detailed summary from conversation analysis (1-2 sentences)
   - **Next Action**: Specific next step based on session context
   - The row is ONE line, ≤500 chars total (CI-enforced).

3. **Trim and reset (executable, not aspirational):**
   - "Recent Session Log" table: count the data rows; if more than 5, **delete the oldest rows** so exactly 5 remain (newest at top).
   - "Recently Completed" table: same — delete oldest rows beyond the 5 most recent.
   - "Priority Queue → Immediate": **reset to current reality** — remove items that have shipped/completed this session.
   - "Risks & Blockers": **remove entries that are now resolved**.
   - Completed Priority Queue items are DELETED, never struck through; promote notable ones to a one-line "Recently Completed" row instead.
   - Delete any section whose heading is marked "(Closed)" or "(Done)".
   - Zero `<!-- prior: -->` markers or `**Prior Session**` lines may remain anywhere.
   - `bun run validate:docs` enforces the table caps, row length, prior-chain ban, queue-strikethrough ban, and both file budgets in CI — skipping this fails the build.

### 3.4. Validate Docs

Only if the root `package.json` has a `validate:docs` script; if absent, skip this step silently. Run `bun run validate:docs`. It must pass before the Step 6 commit; fix any failures now. If Step 4 later changes CLAUDE.md, re-run it — CLAUDE.md has its own line budget and is close to it.

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
git push origin HEAD:refs/heads/$(git branch --show-current)
```

(The explicit `HEAD:refs/heads/<branch>` form pushes the current branch to its own upstream branch; adjust if your remote setup differs.)

**If push succeeds:**

- Display: "Pushed to origin/[branch-name]"

**If push fails:**

- Common causes: No upstream set, authentication issue, force push needed
- Display: "WARNING: Push failed: [error]. Run `git push` manually or set upstream."
- Don't block session end - report and continue

**If no commits were made:**

- Skip push step entirely
- Display: "No new commits to push"

### 7.5. Queued-Release Reminder

release-please's combined Release PR (label `autorelease: pending`) ships only
when merged by hand. Surface any open one as the last thing before you leave so a
queued release never stalls:

```bash
gh pr list --state open --label "autorelease: pending" --json number,title,createdAt
```

- None open → display "Releases: nothing queued."
- One open → `Release: PR #<n> open <N>d — merge to ship. gh pr merge <n> --squash --delete-branch`
- Presence alone triggers the reminder (no staleness gate). The push you just made
  may add or refresh a Release PR after CI runs, so this reflects the
  currently-open one — re-check next session.

### 8. Final Verification

Confirm all steps completed:

- [ ] Session work analyzed
- [ ] Stale TODO entries swept (2.65)
- [ ] HANDOFF.md updated
- [ ] validate:docs green (if the script exists)
- [ ] Session log entry added
- [ ] CLAUDE.md updated (if needed)
- [ ] Handoff notes displayed
- [ ] Changes committed (auto-commit)
- [ ] Branch pushed to remote
- [ ] Queued Release PR surfaced (if any open)
