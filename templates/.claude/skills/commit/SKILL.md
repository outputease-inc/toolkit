---
name: commit
description: Create a git commit - stages the work, writes a Conventional Commits message, and commits with hooks enabled. Two modes: a final conventional commit, and a `chore(<scope>): wip <description>` work-in-progress save. Use when a unit of work is complete, whether or not a commit was asked for, and when another skill routes its commit step here.
allowed-tools: Read Glob Grep Bash
---

## User Input

$ARGUMENTS

You **MUST** consider the user input before proceeding (if not empty).

## Goal

The single implementation of "make a commit" for this repository and for every project
scaffolded from it. Message rules live here in full, so the skill is self-sufficient
wherever it is installed and no second copy of them has to be kept in step.

## Modes

Two modes. They differ in the message form and in nothing else: both stage the work,
both commit, both run the hooks. Neither is a reduced version of the other.

| Mode | When | Subject form |
|------|------|--------------|
| **Final** (default) | Work is complete and ready to stand in history | `<type>(<scope>): <description>` |
| **Work-in-progress** | Saving progress mid-session | `chore(<scope>): wip <description>` |

**Selecting the mode.** An invocation whose argument text begins with the word `wip`
selects work-in-progress, and the remainder of that text becomes the description. Every
other invocation is final mode. A caller routing here for a mid-session save says so
explicitly: `/commit wip <description>`.

(The rule is stated without naming the argument token, deliberately. This skill declares
`args: substituted`, so that token is replaced with the caller's text wherever it appears —
including inside a sentence describing what the token means, which turns the rule into a
false assertion about one particular invocation.)

## Message Rules

```text
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types** — `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`,
`style`, `test`. Pick by what the change does, not by its size.

**Scope** — the vocabulary is the `scope-enum` list in the repository's
`commitlint.config.ts`: the touched package where the change sits in exactly one, `repo`
where it spans several or touches repository-level configuration. Read that file rather
than recalling the list; it is what enforces. **`scope-enum` wins on conflict** — when a
scope named in an instruction block, a doc, or this file disagrees with that list, the list
is right, because it is the thing that rejects the commit. `scope-empty` is disabled, so a
bare `<type>: <description>` is a valid and acceptable degenerate form.

**Description** — imperative mood ("add", never "added" or "adds"), no trailing period.
The whole header stays within **100 characters** (`header-max-length`), and its subject
must not be start-case, pascal-case or upper-case (`subject-case`). Lowercase opening.

**Body** — include one when the *why* is not obvious from the subject. Skip it when the
subject already says everything. Wrap at 100 characters per line.

**Breaking changes** — a `!` after the type or scope (`feat(db)!: …`), a `BREAKING CHANGE:`
footer, or both. Surface it rather than burying it in a body paragraph: it is the first of
Git Workflow's pull-request triggers, and step 4 below checks for it. Whether the work then
needs a pull request is Git Workflow's call, not this skill's.

**Work-in-progress subject** — `chore(<scope>): wip <description>`. `chore` is the type
that costs nothing: `release-please-config.json` marks it `"hidden": true`, so the save
neither bumps a package nor reaches a changelog. There is no `wip` type in
`@commitlint/config-conventional`, which is why the form is `chore(…): wip …` and not
`wip: …`.

## Execution

### 1. Read the state

```bash
git status --short
git diff --stat
git diff --cached --stat
```

Enough to name what changed and to see whether anything is already staged.

### 2. Stage

Stage the work the commit is meant to carry. `git add` is idempotent, so a caller that
already staged deliberately loses nothing here. Never stage a file the user asked to keep
back, and never stage a `.env` file or a secret-bearing artifact.

**Stage by explicit path.** `git add <path> <path> …` — never `git add -A`, never `git add .`,
never `git add -u` across the whole tree. A checkout can be shared with another agent editing
concurrently, and a blanket add sweeps that agent's in-flight work into your commit; it also
picks up untracked files nobody looked at. A long file list is still an explicit list; length
is not a reason to reach for the sweep.

### 3. Compose the message

Apply the rules above to what step 1 showed. One logical change per commit — when the diff
carries two unrelated changes, say so and propose splitting it rather than writing a
subject that covers both.

### 4. Self-check the pull-request triggers

Hold the composed message against the branch you are on:

```bash
git branch --show-current
```

If the message carries a `!` after the type or scope **or** a `BREAKING CHANGE:` footer, and
the current branch is `main`, **stop and tell the user**: pull-request trigger 1 has fired and
the change is about to land directly on `main`. Nothing else catches this — no hook, no CI
job, no server-side rule. The absence of a complaint means nothing looked.

Say which of the two signals you found, name the options (redo the work on a branch and open a
pull request, or confirm the direct commit is what is wanted), and wait for the answer. This is
advice, not a refusal — "commit it anyway" gets the commit.

The remaining triggers belong to Git Workflow, and two of them have their own enforcement: a
migration edit is blocked at edit time and a security-path edit warns. Do not re-derive them
here.

### 5. Commit

```bash
git commit -m "<type>(<scope>): <description>"
```

A multi-line message goes through a file instead, which also keeps the message text out of
the shell command line:

```bash
git commit -F <path-to-message-file>
```

**Commit as the configured author.** Use the identity the checkout already resolves to — run
`git commit` plainly, and never pass `-c user.email=…` or `-c user.name=…` on the command
line. An inline override corrects nothing; it silently attributes the commit to a different
author and leaves no trace of having done so. If the identity looks wrong, fix it where it
lives (`git config --local user.email …`) rather than papering over it at the call site. In
this repository the identity is set per-clone in `.git/config`, deliberately, so the local
value is the correct one.

**The hooks run.** Do not pass `--no-verify`. It suppresses `pre-commit` and `commit-msg`
together, which means it suppresses both the generated-file guard the constitution mandates
and the message linting that makes these rules real. A gate that a skill can bypass is not
a gate.

**A rejected commit is information.** When `commit-msg` rejects the subject, fix the
subject. When `pre-commit` rejects a generated file, fix its neutral source and regenerate.
Neither is a reason to reach for the flag.

### 6. Report

Commit hash, the subject as committed, file count, and branch. State plainly that nothing
was pushed — pushing is a separate, explicitly requested act, and both its form and the
authority to perform it are Git Workflow's.

## Boundaries

- **Commits only.** No push, no pull request, no branch creation, no amend of a commit that
  is already pushed.
- **No branch or push policy here.** Which branch the work belongs on, whether it needs a
  pull request, how a push is spelled, and what protects `main` are all stated once in Git
  Workflow. This skill writes the message and makes the commit; step 4 is the one place it
  reads that policy, and only to raise a flag.
- **No `--no-verify`,** in either mode.
- **Agent-initiated commits are allowed.** An agent may judge a unit of work complete and
  commit it without being asked, in either mode. What that does not reach: pushing, opening a
  pull request, merging one, and amending a commit that is already published. Each of those
  still needs an explicit ask, because none is recoverable by the agent that did it. Step 4's
  breaking-change stop applies with more force to a commit nobody requested, not less.
  (Stated here rather than by reference, because this skill ships to projects that have no
  copy of the section granting it. Where a project *does* state a git-authority policy, that
  policy wins over this bullet — in the OutputEase monorepo it is Git Workflow § Axis 3.)
- **Held-back work stays held back.** Work the user asked you not to commit is not swept in
  because it happens to be staged, and a `.env` or secret-bearing artifact is never staged at
  all.
- **Which of the two modes** — and whether `/checkpoint` is the better entry point — turns on
  one question: is this unit of work finished? Finished is final mode; mid-flight is
  `/checkpoint`, which routes back here in work-in-progress mode. A project may state that at
  greater length (the OutputEase monorepo does, in **Session Workflow**); this line is enough
  without it.
