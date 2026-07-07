---
name: checkpoint
description: WIP commit with lite handoff - updates HANDOFF.md, skips pre-commit hooks, no push
allowed-tools: Read Glob Grep Write Edit Bash TodoWrite
disable-model-invocation: true
---

## User Input

$ARGUMENTS

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Create a quick "save game" commit for work-in-progress. Designed for frequent
saves during active development. Skips pre-commit hooks to maximize speed.

## When to Use

- Every 15-30 minutes during active development
- Before switching context or trying something risky
- Before stepping away briefly
- After getting a test passing or small milestone
- **At end of session when you don't want to push yet** (defers CI until `/session-end` push)

**NOT for**: Final commits (use `/commit-commands:commit` or manual conventional commit), pushing to remote (use `/session-end`)

**Recommended**: The `/commit-commands:commit` plugin automates final commits after checkpoints. Install it via `claude plugin install`. If not installed, create conventional commits manually.

## Execution

### 1. Check for Changes

```bash
git status --short
```

**If no changes**:

```
Working tree clean - nothing to checkpoint
```

Exit early.

### 2. Security Guard (Fast)

Before staging, perform a quick secret check (even though we skip hooks):

```bash
# Check for .env files that would be staged
git status --short -- "*.env" "*.env.*" ".env"
```

**If .env files detected**:

```
SECURITY BLOCK: .env files detected
---------------------------------------------------------------------
Cannot checkpoint - the following files contain secrets:
- [.env file path]

Actions:
1. Add to .gitignore: echo ".env*" >> .gitignore
2. Remove from staging: git reset HEAD [file]
3. Then retry: /checkpoint
---------------------------------------------------------------------
```

Exit without committing.

**Also check for obvious secret patterns in staged files**:

```bash
# Quick scan for API keys in staged files
git grep -lE "sk-|pk_live|PRIVATE_KEY=" --cached -- . 2>/dev/null | head -3
```

**If secrets detected**:

```
WARNING: Potential secrets in staged files
---------------------------------------------------------------------
The following files may contain secrets:
- [file path]

Review these files before committing.
Continue? This is a WIP commit - you can fix before final commit.
---------------------------------------------------------------------
```

Warn but allow proceeding (user can fix before final commit).

### 3. Verify and Update Task Completion Status (Spec-Kit)

If `specs/` directory exists and Spec-Kit is installed, execute the task verification procedure in `docs/procedure-task-verification.md`. This is mandatory but non-blocking.

If Spec-Kit is not installed, skip this step silently.

### 4. Update HANDOFF.md (Lite Handoff)

Perform a **lite handoff** update to HANDOFF.md for session continuity:

1. Read current `HANDOFF.md`

2. **Update "Last Session" header**: in the block between the `# Next Steps` title and the first `##` heading, REPLACE the `**Last Session**:` line with a single new one and delete every other narrative line in that block — never retain or demote the previous entry: no `<!-- prior: -->` markers, no `**Prior Session**` lines. The Recent Session Log table is the only in-file history; git preserves the rest. RETAIN the `**Current Focus**` line (update it if the work area changed; add it on line 4 if missing). Net result: the block contains exactly two content lines — `**Last Session**` and `**Current Focus**`.
   - Format: `**Last Session**: YYYY-MM-DD ([work area from changed files])`
   - Infer work area from changed file paths:
     - `packages/*/` -> Package name
     - `apps/*/` -> App name
     - `docs/` -> Documentation
     - `.claude/` -> Claude configuration
     - `specs/` -> Feature specification
     - Multiple areas -> Cross-cutting changes
   - Example: `**Last Session**: 2026-02-17 (UI components + types)`

3. **Add session log entry** to the "Recent Session Log" table:
   - **Date**: Today's date
   - **Work Completed**: Brief file-based summary (not conversation analysis)
   - **Next Action**: Infer from current feature/directory
   - The row is ONE line, ≤500 chars total (CI-enforced): 1-2 sentences, not a narrative.

4. **Trim the "Recent Session Log" table to the 5 most recent rows** (executable): count the data rows; if more than 5, **delete the oldest rows** so exactly 5 remain. Also self-heal: delete any `**Prior Session**` lines, `<!-- prior: -->` markers, or `~~struck-through~~` Priority Queue items found anywhere in the file. `bun run validate:docs` enforces the row limit, row length, prior-chain ban, and file budgets in CI.

### 4.5. Validate Docs

Only if the root `package.json` has a `validate:docs` script; if absent, skip this step silently. Run `bun run validate:docs`. Fix any HANDOFF/TODO failures before committing — checkpoint commits with `--no-verify`, so this is the only local gate.

### 5. Stage All Changes

Stage all changes including code, documentation updates (HANDOFF.md, tasks.md):

```bash
# Stage tracked files with modifications
git add -u
# Review untracked files (skip binaries, IDE files, secrets)
git ls-files --others --exclude-standard
# Add each verified untracked file explicitly
git add [verified-file-1] [verified-file-2] ...
```

### 6. Generate Description

Analyze staged files to create brief description:

- Count files by type (e.g., "3 components, 2 tests")
- Note primary directory (e.g., "in packages/ui/")
- Keep under 50 characters

Examples:

- `wip: auth middleware + tests`
- `wip: 3 components in packages/ui/`
- `wip: api routes + validation`

### 7. Create Commit

```bash
git commit --no-verify -m "wip: [generated description]"
```

**Important**: `--no-verify` skips pre-commit hooks for speed. This is safe because: (1) WIP commits are squashed into proper conventional commits before PR, (2) Step 2's Security Guard catches secrets, (3) final commits via `/session-end` use hooks. All changes (code + docs) are included in a single commit — no amend step needed.

### 8. Display Confirmation

Display a summary showing: commit hash, message, file count, HANDOFF.md update status, branch name, and reminder that changes are not pushed.

## User Input Options

- Empty (default): Auto-generate description from changes
- `[message]`: Use provided message instead
  - Example: `/checkpoint auth flow working`
  - Creates: `wip: auth flow working`

**Note**: Before PR, squash `wip:` commits into proper conventional commits. Interactive rebase (`git rebase -i`) is not available in the agent runtime — use a non-interactive squash instead: `git reset --soft <base-ref>` then a single conventional commit, or `git merge --squash`. (A human operator may use `git rebase -i` directly.)
