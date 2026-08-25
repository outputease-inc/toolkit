---
name: checkpoint
description: Fast WIP commit - stages, scans the staged content for secrets, and commits through the normal hooks. Records out-of-git session state as a targeted HANDOFF/TODO note; no full handoff rewrite, no backlog sweep, no validate:docs, no push. Use during active development to save progress, on your own judgement or on request.
allowed-tools: Read Glob Grep Write Edit Bash TodoWrite
---

## User Input

$ARGUMENTS

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Create a quick "save game" commit for work-in-progress. Designed for frequent
saves during active development.

**A checkpoint is a commit, plus at most a targeted note.** When the session changed project
state OUTSIDE git -- an email sent, a vendor answer received, a blocker cleared -- step 1
records that one fact in `HANDOFF.md` and/or `TODO.md` before committing, because nothing
else in the session would capture it. That cost is proportional to the session.

What a checkpoint does NOT do is the work whose cost scales with the backlog: no full
`HANDOFF.md` rewrite, no session-log row, no trim-and-reset, no TODO backlog sweep, no
`validate:docs`, no push. Those made a save fired every 15-30 minutes cost time proportional
to the size of the backlog rather than the size of the change, which the constitution now
forbids outright: no ritual may scale its cost with the size of the backlog. `/session-end`
still does all of it, once, where the cost is proportionate.

It also no longer passes `--no-verify`. That flag skipped `precommit-generated-check.ts`,
which the constitution names as a required pre-commit gate, and a mandated gate MUST NOT be
bypassable.

## When to Use

- Every 15-30 minutes during active development
- Before switching context or trying something risky
- Before stepping away briefly
- After getting a test passing or small milestone
- **At end of session when you don't want to push yet** (defers CI until `/session-end` push)

**NOT for**: Final commits (use `/commit`), pushing to remote (use `/session-end`)

**An agent may fire this unprompted.** The cadence above is a cadence for whoever is at the
keyboard, human or agent alike: this skill no longer carries `disable-model-invocation: true`.
A work-in-progress save is the commit-shaped act that is cheapest to be wrong about -- `chore`
is hidden from the changelog and nothing leaves the machine. Stated here rather than by
reference, because this skill ships to projects that have no copy of the section granting it;
where a project states its own git-authority policy, that policy wins over this paragraph. In
the OutputEase monorepo it is Git Workflow § Axis 3.

The grant stops at the commit. It is not authority to **push** -- that is `/session-end` or an
explicit ask -- and it is not licence to sweep up another agent's work: on a shared checkout,
step 2.5's explicit-path staging is what keeps a checkpoint to your own paths.

**Check the branch before saving unprompted.** Nothing rejects a `wip` subject -- no hook, no
`commitlint` rule, no CI job -- so the "squash it later" assumption holds only where there is
a later. On a feature branch, checkpoint freely. On the trunk, a `chore(...): wip ...` is
permanent history: either finish the unit and `/commit` it properly, or move the work to a
branch first (`git switch -c <prefix>/<name>` takes the working tree with it).

Choosing between this skill and `/commit` is one question -- **is this unit of work
finished?** No is this skill; yes is `/commit`. A project may state that at greater length
(the OutputEase monorepo does, in **Session Workflow**); this line is enough without it.

## Execution

### 1. Check for Changes and Session-State Updates

```bash
git status --short
```

Before exiting on a clean **working tree** (`git status --short` empty -- this is about the
files in front of you, not about a linked git worktree), review the current conversation/tool
actions against `HANDOFF.md` and `TODO.md`. A checkpoint must capture meaningful
project-state changes even when they happened outside git, including:

- Emails/drafts sent, vendor/support requests, purchases, account setup, or trial status changes
- Research conclusions, compliance findings, or blocker status changes
- Notion, Vercel, Gmail, calendar, browser, or other external system actions
- Work that changes the next action, priority queue, risks/blockers, or an active TODO backlog item

If external/session state should be recorded, update `HANDOFF.md` and/or
`TODO.md` first, then continue with the checkpoint. Keep it to a targeted note about what
this session changed -- this is the one session-state write a checkpoint makes, and it is
not a licence to rewrite the handoff, add a session-log row, or sweep the backlog (see Goal).
If interactive questioning is unavailable, make conservative non-destructive updates that
preserve open work and record only facts established in the session.

**If no git changes AND no documentation updates are warranted**:

```
Working tree clean - nothing to checkpoint
```

Exit early.

### 2. Verify and Update Task Completion Status (Spec-Kit)

If `specs/` directory exists and Spec-Kit is installed, execute the task verification procedure in `docs/procedure-task-verification.md`. This is mandatory but non-blocking.

If Spec-Kit is not installed, skip this step silently.

### 2.5. Stage the Work

Staging happens here, ahead of step 3, because the security guard reads the INDEX.

**Stage by explicit path** — `git add <path> <path> …`, never `git add -A`, never `git add .`,
never `git add -u` across the whole tree. The rule and its reason (a checkout shared with
another agent, whose in-flight edits a blanket add sweeps into your save) belong to `/commit`,
which states them in full; a ritual fired every 15-30 minutes is more exposed to that, not
less. Restating the mechanism here would be the second implementation step 5 exists to remove,
so the one line of rule is repeated and nothing else is.

```bash
# Name every path deliberately, tracked and untracked alike
git status --short
# Stage each verified path (code, HANDOFF.md, tasks.md); skip binaries, IDE files, secrets
git add [verified-path-1] [verified-path-2] ...
```

`git add` is idempotent, so `/commit`'s own staging pass at step 5 costs nothing and changes
nothing.

### 3. Security Guard (Fast)

**After staging, and never before it.** Every scan in this step reads the INDEX. Running the
check first — as this skill did until spec 010 — meant it inspected whatever the previous
commit had staged, almost always nothing, so it reported clean while its own text claimed to
be checking "staged files". A scan that runs before the thing it inspects exists is not a scan.

```bash
# secret-bearing dotfiles that are actually staged
git diff --cached --name-only -- "*.env" "*.env.*" ".env"
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

**Also scan the staged content for obvious secret patterns**:

```bash
# Reads the staged blobs, not the working tree
git diff --cached -U0 | grep -nE "sk-|pk_live|PRIVATE_KEY=" | head -3
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

### 4. Generate Description

Analyze staged files to create brief description:

- Count files by type (e.g., "3 components, 2 tests")
- Note primary directory (e.g., "in packages/ui/")
- Keep under 50 characters

Examples:

- `chore(auth): wip middleware + tests`
- `chore(ui): wip 3 components`
- `chore(web): wip api routes + validation`

The type is `chore` and the scope comes from `commitlint.config.ts`'s `scope-enum`: the
touched package where the change sits, or `repo` when it spans several. `chore` is the type
that costs nothing. `release-please-config.json` marks it `"hidden": true`, so a WIP save
neither bumps a package nor reaches a changelog.

### 5. Create Commit

Invoke `/commit` in its work-in-progress mode, passing the description from step 4:

```text
/commit wip [generated description]
```

`/commit` is the repository's one implementation of making a commit. It owns the
`chore(<scope>): wip <description>` subject form and performs the commit itself, so this
skill states the description and nothing about how the commit is issued. A second copy of
the message rules here is a second implementation, which is what this delegation exists to
remove.

**The hooks run**, because `/commit` never passes `--no-verify`. That flag used to suppress
`precommit-generated-check.ts` -- a gate the constitution mandates, and therefore one that
must not be bypassable. It suppressed `commit-msg` too, which is why the subject form had to
change in the same edit: `@commitlint/config-conventional` carries no `wip` type, so
re-enabling the hooks against the old subject would have made every checkpoint fail. Both
halves landed together.

### 6. Display Confirmation

Display a summary showing: commit hash, message, file count, branch name, and a reminder that changes are not pushed.

## User Input Options

- Empty (default): Auto-generate description from changes
- `[message]`: Use provided message instead
  - Example: `/checkpoint auth flow working`
  - Creates: `chore(<scope>): wip auth flow working`

**Note**: Before PR, squash the `chore(<scope>): wip ...` commits into proper conventional commits. Interactive rebase (`git rebase -i`) is not available in the agent runtime — use a non-interactive squash instead: `git reset --soft <base-ref>` then a single conventional commit, or `git merge --squash`. (A human operator may use `git rebase -i` directly.)
