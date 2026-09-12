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

# Which workspace is this? A linked worktree closes differently (Step 7).
git rev-parse --path-format=absolute --git-dir
git rev-parse --path-format=absolute --git-common-dir
git rev-parse --show-superproject-working-tree
```

**Workspace verdict**: this is a **linked worktree** when `--git-dir` differs from
`--git-common-dir` AND `--show-superproject-working-tree` is empty. The two also differ inside
a submodule checkout, which is why the superproject probe is part of the test — a non-empty
result means submodule, not worktree. Carry the verdict to Step 7; it decides how this
session's work leaves the workspace.

Display current state to user:

```
GIT STATUS
---------------------------------------------------------------------
Branch: [current branch]
Changes: [X files modified, Y files staged, Z untracked]
Workspace: [main checkout | linked worktree at <path>]
```

### 2. Analyze Session Work

Review the conversation history to identify:

- **Tasks completed** this session
- **Features progressed** (which package/feature was worked on)
- **Decisions made** (any architectural or implementation choices)
- **Blockers encountered** (issues that need resolution)
- **Next actions** (what should happen next session)
- **External/project-state changes** (emails sent, vendor/support requests,
  purchases, account/trial setup state, Notion/Vercel/Gmail/browser actions,
  research conclusions, compliance findings) that may require `HANDOFF.md` or
  `TODO.md` updates even if `git status` is clean

### 2.5. Verify and Update Task Completion Status (Spec-Kit)

If `specs/` directory exists and Spec-Kit is installed, execute the task verification procedure. Use full conversation analysis (not just file inference).

If Spec-Kit is not installed, skip this step silently.

### 2.55. Session Scope

Define ONCE the set of `TODO.md` entries this session touched. Every backlog step below consumes
this definition and re-reads the file for entries of its own. A close that prompts about entries
the session never went near is ceremony scaling with backlog size instead of with the work.

Session Scope is derived from the session's own record, never from a repository range:
`origin/main..HEAD` on a multi-day feature branch scales with branch age rather than with the
session, and nothing records a session start — neither `/quickstart` nor `/checkpoint` writes one.

1. Take Step 2's analysis: tasks completed, features progressed, decisions made, and the
   external/project-state actions it already collects (those count even when `git status` is
   clean).
2. Add the working tree and the session's commits from Step 1.
3. Read the entry-bearing sections of `TODO.md`: `## Ideas Backlog` and `## Paused Initiatives`.
   Do NOT read `## Reference Notes` — its retained material is deliberate and is never offered
   for pruning.
4. Session Scope is every H3 entry in those two sections whose subject matches something from
   steps 1-2. Nothing else is in scope, however stale it looks from here.

An entry that is stale but untouched is not lost by staying out of scope. A trigger is a property
of the artifact; evaluation scope is a property of the ritual, and a corpus-wide evaluation is a
report run on demand, not a step in a session close. If Session Scope is empty, steps 2.6, 2.65
and 2.66 all skip silently — that is the proportional outcome, not a failure.

### 2.6. Direct-Ready Cleanup (TODO.md)

Take the Session Scope entries (step 2.55) whose status tag is `[Ready: Direct]`. Skip this step silently if none exist.

For each `[Ready: Direct]` item, use AskUserQuestion:

- Question: `Did you complete "[idea title]" this session?`
- Options:
  - `Yes, remove from TODO` — delete the H3 section (heading + body until the next H3 or section boundary)
  - `No, keep on backlog` — leave the entry as-is
  - `Move back to [Developing]` — rewrite the status tag to `[Developing]`

After processing every Direct item, set the footer to the exact format `**Last Updated**: YYYY-MM-DD` (today) if any change was made — a bare date, nothing after it. Never append change narrative; git history is the changelog. CI rejects anything else. Use the same H3-section delete mechanic as `/quickstart` Phase 2.5.1 step 2 (heading + body until the next H3 or section boundary).

### 2.65. Stale-Entry Sweep (TODO.md)

Scan the body of each Session Scope entry (step 2.55) — its own body, nothing else — for retirement evidence. An entry is retirable when EITHER holds:

- **A shipped-evidence marker**: `~~`, `DONE`, `shipped`, `landed`, `superseded`, a `spec NNN` reference paired with a shipped/merged verb, or a 7-hex commit hash paired with a shipped/merged verb. Markers match case-insensitively and **on word boundaries** — `abandoned` does not contain `DONE`, and `unshipped` is not `shipped`.
- **A path under `archive/specs/`**: the spec it tracked has been archived, which is the post-archive state `/speckit-archive` leaves behind when it rewrites inbound links.

The status tag is not consulted. Any tag class, and an untagged entry, can be retirable. Skip this step silently if nothing matches.

**Except when the entry already states its own open remainder.** An entry whose body carries a bolded lead-in naming still-open work — `**Open:**`, `**Still open:**`, `**Open (founder):**`, `**Remaining:**`, and the like — is NOT retirable, whatever markers it also carries. It has already been slimmed: its shipped words are provenance for the open part, telling the reader where that open work is defined, not evidence the entry is done. Flagging it asks a question whose honest answer is always "keep as-is", every session that touches it. An entry that is genuinely finished has no such section and still flags normally.

For each flagged entry, use AskUserQuestion:

- Question: `"[idea title]" looks (partly) shipped or superseded — prune it?`
- Options:
  - `Remove entry` — delete the H3 section (heading + body until the next H3 or section boundary)
  - `Slim to open remainder` — delete the shipped/decided/superseded detail; keep the heading, the still-open scope under a bolded open-work lead-in, and a pointer to the source-of-truth doc or spec. It is that lead-in, not the absence of markers, that stops the entry re-flagging — so a slimmed entry may keep whatever shipped wording its provenance needs.
  - `Keep as-is` — leave it; it re-flags the next session that touches it

Update `**Last Updated**` (bare date) if any change was made.

### 2.66. Active TODO Progress Sync

The entries this step syncs are exactly Session Scope (step 2.55) — the session's
current focus, files changed, and external/project-state actions from Step 2 are
what that step is derived from, so there is nothing further to select here.

For each Session Scope entry:

- Update concise status/progress notes when facts changed this session: support
  emails sent, vendor answers pending/received, purchases completed, trial or
  account setup state changed, research conclusions landed, blockers changed,
  or next actions changed.
- Keep entries on the backlog unless Step 2.6/2.65 or the user explicitly says
  to remove them.
- If AskUserQuestion is unavailable, make conservative non-destructive updates:
  record factual progress and current blockers, but do not delete entries or
  downgrade statuses.
- If `TODO.md` changes, set the footer exactly to `**Last Updated**: YYYY-MM-DD`.

### 2.7. Spec Archival Check (Spec-Kit)

This step is a **cheap screen, not the gate**. `/speckit-archive` step 2 owns the
authoritative finished checks and re-runs all of them on entry, so a false positive here costs
one declined prompt and nothing else. Do not reimplement its checks — in particular, do not
restate its merged-to-main test (local *and* remote unmerged branches, plus the working-tree
check); this screen deliberately runs the loose version and defers.

If `specs/` exists, evaluate each `specs/NNN-*` directory against the finished
checks (cheap greps, no reference graph):

1. `tasks.md` exists with zero unchecked boxes (`- [ ]`)
2. Looks merged to main: no unmerged `NNN-*` branch, no uncommitted changes under the dir
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
   - **Date**: Today's date. Authored, not read from history: this row is written here at step 3
     while the session's own commit does not land until step 6, so at write time history does not
     yet hold the date this row is about.
   - **Work Completed**: read the commit-restating half FROM GIT, never from recall. Run
     `git log --oneline <first-commit-of-session>^..HEAD`, bounded to the commits Session Scope
     (step 2.55) enumerates. Never an unbounded invocation, and never a repository range such as
     `origin/main..HEAD` — on a multi-day feature branch that restates other sessions' work as if
     it were this one's. Restate those subjects in 1-2 sentences and add only what a commit
     subject cannot carry. If the session produced no commit, say so; do not substitute narrative.
   - **Next Action**: the specific next step from session context. Authored judgement, derived
     from nothing, and **never the cell trimmed** to meet the row cap — trim the Work Completed
     restatement instead, which history still holds. Everything else in this row is recoverable
     without it; this cell is not.
   - The row is ONE line, ≤500 chars total (CI-enforced).
   - A row's exit is displacement by rank: a newer row pushes it past the 5-row cap item 3 below
     already enforces. There is no other retirement path, and none is needed.

3. **Trim and reset (executable, not aspirational):**
   - "Recent Session Log" table: count the data rows; if more than 5, **delete the oldest rows** so exactly 5 remain (newest at top).
   - "Recently Completed" table: same — delete oldest rows beyond the 5 most recent.
   - "Priority Queue → Immediate": **reset to current reality** — remove items that have shipped/completed this session.
   - "Risks & Blockers": **remove entries that are now resolved**. Two signals are worth a second look, as advisory input you weigh — never as a delete-where rule, because this trim runs unattended and both signals have known false positives: an item whose body carries resolution evidence (`resolved`, `closed`, `discharged`, `no longer`, `superseded`, `obsolete`), and an item whose LATEST stated date has passed. Read the latest date the body states, not the first: an item stating a passed date alongside a later one is still live, and bare month-day forms (`Aug 31`, `Aug 14–18`) count as dates just as ISO ones do.
   - Completed Priority Queue items are DELETED, never struck through; promote notable ones to a one-line "Recently Completed" row instead.
   - Delete any section whose heading is marked "(Closed)" or "(Done)".
   - Zero `<!-- prior: -->` markers or `**Prior Session**` lines may remain anywhere.
   - `bun run validate:docs` enforces the table caps, row length, prior-chain ban, queue-strikethrough ban, and both file budgets in CI — skipping this fails the build.

### 3.4. Validate Docs

Only if the root `package.json` has a `validate:docs` script; if absent, skip this step silently. Run `bun run validate:docs`. It must pass before the Step 6 commit; fix any failures now. If Step 4 later regenerates CLAUDE.md from `.agents/`, re-run it — CLAUDE.md has its own line budget and is close to it.

### 4. Conditionally Update the Instruction Blocks

`CLAUDE.md` and `AGENTS.md` are generated and cannot be edited — `.claude/hooks/protect-generated.js`
blocks the write (exit 2). Instruction changes are made in `.agents/instructions/blocks/` and
regenerated.

**Only change the instructions if**:

- New architectural patterns were established
- New important files were created
- Quick Reference section needs new entries
- New gotchas or troubleshooting items were discovered

If no significant changes: Skip this step.

Otherwise:

1. Find the owning block by its `##` heading — the headings are unique across
   `.agents/instructions/blocks/`, so grep the directory for the section heading you saw in
   `CLAUDE.md`. `00-preamble.md` and `21-speckit.md` carry no `##` heading and are identified
   by filename.
2. Edit that block.
3. Run `bun run agents:generate`, then `bun run agents:check` — no drift.

If `protect-generated.js` blocks an edit here, the write went to a generated path. Do not retry
and do not bypass the hook: look the path up in `.agents/generated.manifest.json` and edit the
`source` it records instead.

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
Workspace: [main checkout | linked worktree at <path>]
Validation: [/dev-check passed | /dev-check failed - see Blockers | not run]
Pushed: [Pushed to origin | Behind origin, integrate first | Push failed |
         Held for branch integration (worktree) | No new commits]
HANDOFF.md: Updated

---------------------------------------------------------------------
Next session: Run /quickstart to pick up where you left off
===================================================================
```

### 5.5. Run /dev-check (warn-only)

Validation runs **before** the commit, per Session Workflow's `/dev-check` row and the
constitution's "Validate: `/dev-check` before committing". Invoke `/dev-check` via the Skill
tool; if it is not invocable on this surface, run the repo's build/lint/test validation
directly.

**This step WARNS; it does not block.** Report the result and continue to Step 6 either way —
the same posture this skill already takes on a failed commit or a failed push. A red
`/dev-check` at session close means the next session inherits a known-red tree, which is worth
knowing and recording; refusing to save the work would be worse.

- Green → `Validation: /dev-check passed`
- Red → `WARNING: /dev-check failed: [summary]. Committing anyway; recorded in HANDOFF.md.`
  Add the failure to HANDOFF.md's Risks & Blockers (Step 3 already updated that section — go
  back and add the row) so it is the next session's first fact. Then re-run
  `bun run validate:docs` per Step 3.4: you just edited a file that step already validated,
  and HANDOFF.md has a line budget it is checked against. The re-run guards the commit's
  validity, not the test result — a red `/dev-check` still does not block the close.

This is deliberately NOT the posture of Step 3.4: `validate:docs` is blocking because it
guards the very file this ritual is rewriting, and a doc-budget failure would make the commit
itself invalid. A failing test does not.

### 6. Auto-Commit (Final Step)

After all status updates complete, automatically commit any pending changes:

```bash
git status --short
```

**If uncommitted changes exist:**

1. Invoke `/commit` with the session context Step 2 collected:
   ```text
   /commit
   ```
   `/commit` is the repository's one implementation of making a commit. It owns the
   conventional-commit message rules, it stages by explicit path, and it performs the commit
   itself, so no staging command, no message form and no manual fallback is restated here —
   there is one path, and this is it. Nothing between the `git status --short` above and the
   invocation reads the index, so there is nothing for a staging pass here to serve.
2. If commit fails: report error but don't block session end.

**If no uncommitted changes:**

- Display: "Working tree clean — no commit needed"

### 7. Push to Remote

**If no commits were made**: skip this whole step. Display "No new commits to push".

#### 7a. If Step 1's verdict was "linked worktree"

Do NOT push the worktree branch as if it were the session's mainline. A worktree branch is
unfinished work in an isolated workspace, and integrating it — merge or PR, then remove the
worktree and delete the branch — belongs to
`superpowers:finishing-a-development-branch` when that plugin is installed.
Route there and let it decide; it is the skill that knows how the branch lands and how the
workspace is cleaned up.

If that skill is unavailable, stop at the commit: report the branch name and the worktree path
in the handoff notes, push nothing, and leave integration for the next session. Isolation is
not integration — see Git Workflow § Axis 1 and § Axis 2.

#### 7b. Otherwise (main checkout)

Fetch first, then confirm you are not behind. Pushing blind is how a non-fast-forward
surprise happens at the end of a session, when there is least appetite to deal with it:

```bash
git fetch origin
git rev-list --count HEAD..origin/$(git branch --show-current) 2>/dev/null || echo 0
```

- Count `0` (or the command falls through, meaning the branch has never been pushed and has
  no remote-tracking ref) → proceed.
- Count `> 0` → you are behind. **Do not push.** Report: "Behind origin/[branch] by N commits
  — integrate first (`git pull --rebase` or a merge), then push." Then continue to the
  remaining steps; do not block the session close.

Then push:

```bash
git push origin HEAD:refs/heads/$(git branch --show-current)
```

(Push form and rationale: Git Workflow § Pushing.)

**If push succeeds:**

- Display: "Pushed to origin/[branch-name]"

**If push fails:**

- Common causes: no upstream set, authentication issue, or the remote moved between the fetch
  and the push (non-fast-forward).
- **A non-fast-forward rejection is a signal to integrate, never a reason to force.** Never
  suggest, offer, or run `--force` / `--force-with-lease` here. GitHub's "Basic Protection"
  ruleset carries a `non_fast_forward` rule on the default branch, so a force push to `main`
  would be rejected server-side regardless — but the reason not to is that someone else's
  commits are on the other end.
- Display: "WARNING: Push failed: [error]. Fetch and integrate, then push again."
- Don't block session end — report and continue

### 7.5. Queued-Release Reminder

Surface any open Release PR as the last thing before you leave, so a queued release never
stalls. One line, then hand off:

```bash
gh pr list --state open --label "autorelease: pending" --json number,title,createdAt
```

- None open → display "Releases: nothing queued."
- One open → `Release: PR #<n> open <N>d — merge to ship.`

Merging it is a push to `main` and needs the user's explicit say-so (Git Workflow § Axis 3) —
propose, never merge.

### 8. Final Verification

Confirm all steps completed:

- [ ] Workspace verdict determined (main checkout vs linked worktree)
- [ ] Session work analyzed
- [ ] Stale TODO entries swept (2.65)
- [ ] HANDOFF.md updated
- [ ] validate:docs green (if the script exists)
- [ ] Session log entry added
- [ ] Instruction blocks under `.agents/` updated and regenerated (if needed)
- [ ] Handoff notes displayed
- [ ] `/dev-check` run and its result reported (warn-only, 5.5)
- [ ] Changes committed (auto-commit)
- [ ] Branch pushed to remote (main checkout), OR linked worktree routed to
      `superpowers:finishing-a-development-branch` when installed
- [ ] Queued Release PR surfaced (if any open)
