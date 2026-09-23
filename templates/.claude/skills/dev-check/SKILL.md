---
name: dev-check
description: Fast pre-commit validation (typecheck, lint, tests, the project's verify script for its other CI guards, and a secret quick-scan), so a green run means CI should go green. Use before committing or claiming work complete — the evidence step of superpowers:verification-before-completion when that plugin is installed.
allowed-tools: Read Glob Grep Bash
---

## User Input

$ARGUMENTS

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Answer one question fast: **would CI go green on this tree?** Run the project's typecheck,
lint and tests, then every other guard its CI runs that the project exposes as a `verify`
script, then a quick secret scan. Report what ran, what failed, and what no local run covers.

A check only counts if the project defines it. This skill never invents a script, never
assumes a package manager, and never reports a check it did not run as passing.

## When to Use

- Multiple times per hour during active development
- Before staging changes for commit
- After making significant code changes
- When you want quick feedback during development

**NOT for**: Full PR preparation or deployment validation (use `/security-review` instead)

## Execution

### 1. Header

```
===================================================================
  DEV CHECK (Fast Feedback)
  Date: [YYYY-MM-DD]
  Branch: [current-branch]
===================================================================
```

### 2. Resolve the Project's Root and Commands

**The repository root, once.** Every step below runs against it, whatever directory the session
is in, and no step changes the session's directory: a `cd` in one Bash call carries into every
later call, and a `cd` inside a compound command can stop for a permission prompt. So every
command names the root instead, through `git -C`, a top-anchored pathspec, or the package
manager's own directory flag. Resolve it here, for every option (a `sec`-only run needs it too):

```bash
git rev-parse --show-toplevel
```

Take the absolute path it prints as `<root>`, and put it, quoted, wherever `<root>` appears
below. **If it prints nothing, stop and report `root not resolved`.** An empty `<root>` does not
fail loudly: `git -C ""` and a package manager's `--cwd ""` both run in the session's directory,
so from a subdirectory every step would quietly read the wrong files. If it fails because the
project is not a git repository, `<root>` is the absolute path of the directory that holds the
project's root `package.json`; run the checks against it, and report the security scan as
`did not run: not a git repository`, since every scan reads git.

Read `<root>/package.json` (its `scripts` and `packageManager` fields), then list the lockfiles:

```bash
ls "<root>/bun.lock" "<root>/bun.lockb" "<root>/pnpm-lock.yaml" "<root>/yarn.lock" "<root>/package-lock.json" 2>/dev/null || true
```

**Package manager (`<pm>`)**, from the lockfile, and **`<run>`**, the command that runs one of
its scripts in `<root>` without changing the session's directory:

| Lockfile | `<pm>` | `<run>` |
|----------|--------|---------|
| `bun.lock` / `bun.lockb` | `bun` | `bun run --cwd "<root>"` |
| `pnpm-lock.yaml` | `pnpm` | `pnpm --dir "<root>" run` |
| `yarn.lock` | `yarn` | `yarn --cwd "<root>" run` |
| `package-lock.json` | `npm` | `npm --prefix "<root>" run` |

No lockfile usually means dependencies are not installed yet; say so in the report, because
no check can pass without them. Then take `<pm>` from the `packageManager` field (`bun@1.3.8`
means `bun`), else from the commands the project's `CLAUDE.md` or `README.md` gives, else
`npm`. More than one lockfile: the one matching `packageManager`, else the first in table
order, and say so in the report. Every command below is `<run> <script>`.

**Scripts**, from `scripts` in the root `package.json`:

| Check | Script | When the script is absent |
|-------|--------|---------------------------|
| Typecheck | `typecheck` | report `not defined` |
| Lint | `check` if defined, else `lint` | report `not defined` |
| Tests | `test` | report `not defined` |
| CI guards | `verify` | report `not defined` |

`not defined` is neither a pass nor a failure. Do not substitute a guessed command.

### 3. Run the Checks in Parallel

Run each defined script as its own Bash call, in parallel:

**Check 1: Typecheck**

```bash
<run> typecheck 2>&1
```

**Check 2: Lint** (the `check` script when defined; otherwise `lint`)

```bash
<run> check 2>&1
```

```bash
<run> lint 2>&1
```

**Check 3: Tests**

```bash
<run> test 2>&1
```

- Quote per-package pass/fail totals. A turbo pipeline prints `Tasks: N successful` even when
  it replayed cached results, so the task count is not evidence.
- After a pull or merge that brought in new workspace members, re-run the tests with
  `--force` (`<run> test --force`; under npm, `<run> test -- --force`): turbo can replay a
  green result recorded on another machine for a package whose dependencies are not installed
  here.

**Check 4: CI guards**

```bash
<run> verify 2>&1
```

A project's `verify` script is its statement of every guard its CI runs beyond typecheck, lint
and tests: docs and data validators, generated-file drift checks, sync checks and the like, each
run the way CI spells it. Report every guard it lists as failed, not only the first, and relay
the fix command each failing guard prints.

### 4. Security Quick-Scan

Four Bash calls, each run on its own. Each covers the whole repository whichever directory the
session is in, through `<root>` or a `:(top)` pathspec, and none changes the session's
directory. The env-file check must not share a call with a reader such as `head`, `tail` or
`cat`: `protect-sensitive-bash` refuses any command that both names an env file and reads, and
the scan then silently does not run. Keep each call a plain pipeline, too; a worktree session's
guard refuses brace groups, loops and `$( )`.

The scan covers what a commit could take from this tree: staged changes, unstaged changes to
tracked files, and untracked files git does not ignore. No call reads `HEAD`, so a repository
with no commits yet scans the same way (`--cached` then compares the index with an empty
tree). `/dev-check` usually runs before anything is staged; `/checkpoint` scans the staged
index again at commit time.

**Env files a commit could pick up** (staged, modified, or untracked and not ignored). The
`:(top)` pathspecs match from the root, whichever directory git runs in:

```bash
git -C "<root>" status --porcelain --untracked-files=all -- ":(top)*.env" ":(top)*.env.*"
```

A committed template such as `.env.example` is expected. Any other line is an issue: add the
file to `.gitignore`, or unstage it.

**Secret-shaped strings in staged changes**, then **in unstaged changes to tracked files**. Git
matches the pattern against the lines each change adds or removes (`-G`), which is what a
commit carries, and prints the name of each file that matches:

```bash
git -C "<root>" diff --cached --name-only --diff-filter=d -i -G "(^|[^a-z0-9])sk-[a-z0-9_-]{20,}|[rs]k_live_[a-z0-9]{16,}|api_key[[:space:]]*=|private_key[[:space:]]*=|-----begin [a-z ]*private key-----"
```

```bash
git -C "<root>" diff --name-only --diff-filter=d -i -G "(^|[^a-z0-9])sk-[a-z0-9_-]{20,}|[rs]k_live_[a-z0-9]{16,}|api_key[[:space:]]*=|private_key[[:space:]]*=|-----begin [a-z ]*private key-----"
```

**Secret-shaped strings in new untracked files.** `":(top)"` lists the untracked files of the
whole repository, relative to the session's directory, which is where `grep` then opens them:

```bash
git ls-files -z --others --exclude-standard -- ":(top)" | xargs -0 grep -liE -e "(^|[^a-z0-9])sk-[a-z0-9_-]{20,}|[rs]k_live_[a-z0-9]{16,}|api_key[[:space:]]*=|private_key[[:space:]]*=|-----begin [a-z ]*private key-----" -- /dev/null
```

The pattern, matched case-insensitively: `sk-` keys (OpenAI, Anthropic and similar), Stripe
secret and restricted keys, `api_key` and `private_key` assignments in any case (including
prefixed names), and PEM private-key headers. Stripe publishable keys are public by design and
are not flagged.

**All three print file names only, never the matching line.** A hit is a secret-shaped value,
and printing it would put the value in the transcript the scan exists to keep it out of. For
the same reason, do not open a flagged file or quote its lines to decide whether a hit is real:
report each file by name and leave the judgement to the user. A staged or unstaged hit can be a
line the change removes, and the untracked scan reads whole files, so a hit there can be a file
that documents a pattern (this skill is one). Say which names look like that.

**Read each call's result as clean, hits, or did not run**, from all of its output and its exit
status together. The Bash tool shows stdout and stderr as one stream, so judge every line:

| Call | Clean: no output, and exit status | Hits: every line is |
|------|-----------------------------------|---------------------|
| Env files | `0` | a `git status` line for an env file, its path from `<root>` |
| Staged | `0` | a file name, from `<root>` |
| Unstaged | `0` | a file name, from `<root>` |
| Untracked | `123` with GNU `xargs`; `1`, or `0` when nothing is untracked, with BSD `xargs` (macOS) | a file name, from the session's directory |

- **Clean**: no output at all, and an exit status from the *Clean* column.
- **Hits**: output in which every line is of the kind in the *Hits* column, with exit status
  `0` or one from the *Clean* column. Report each file by name.
- **Did not run**: anything else. A line that is not a result (git's `fatal:` or `warning:`,
  `grep:`, `xargs:`, a shell error) or an exit status outside those means the call failed or
  read only part of the tree, whatever else it printed: a `git -C` that cannot reach `<root>`
  exits `128`, and a `grep:` line names a file that was not read. Report the security row as
  `ERR`, name the call and quote its first error line, list any file names it did print, and
  never report it as clean.

### 5. Generate Quick Report

```
DEV CHECK RESULTS ([pm])
===================================================================

| Check      | Script      | Status               | Details                           |
|------------|-------------|----------------------|-----------------------------------|
| Typecheck  | typecheck   | OK/ERR/not defined   | [No errors | X errors in Y files] |
| Lint       | check|lint  | OK/ERR/not defined   | [Clean | X warnings, Y errors]    |
| Tests      | test        | OK/ERR/not defined   | [per-package passed/failed]       |
| CI guards  | verify      | OK/ERR/not defined   | [All passed | failing guards]     |
| Security   | (git)       | OK/ERR               | [Clean | X files flagged | did not run: call] |

Not checked locally: [jobs from "What a Green Run Does Not Cover"]
Duration: [Xs]
===================================================================
```

### 6. Summary Based on Results

**If ALL PASS** (every defined check green; `not defined` rows do not fail the run):

```
DEV CHECK PASSED
---------------------------------------------------------------------
All defined checks passed. Not checked locally: [list].

Next steps:
- Continue coding
- /checkpoint - Save progress (WIP commit)
- /commit - Create proper commit when ready
```

**If ANY FAIL:**

```
DEV CHECK FAILED
---------------------------------------------------------------------
[X] issue(s) need attention:

[If typecheck errors:]
Typecheck Errors:
- [file:line] [error message]

[If lint errors:]
Lint Errors:
- [file:line] [error message]

[If test failures:]
Failed Tests:
- [package] [test name]

[If CI guard failures:]
Failed Guards:
- [guard command] -> [the fix command it printed]

[If security issues:]
Security Issues:
- [file name] [env file a commit could pick up | secret-shaped string; value not shown]
- [scan call] did not run: [its first error line]

---------------------------------------------------------------------
Fix issues before continuing.
```

## What a Green Run Does Not Cover

Anything the project's CI checks a change with that neither the core checks nor `verify` covers
goes unchecked locally. Read the workflow files under `.github/workflows/` (or the project's own
CI config), and take only the workflows that run as checks on a change: those a `push` or
`pull_request` event triggers. A workflow nothing but another trigger starts checks no change of
its own, so leave it out: a release or deploy pipeline started by `workflow_run`, and
automation that runs only on a `schedule` or by `workflow_dispatch`. In each check workflow,
every job or step that is not dependency setup, not typecheck, lint or tests, and not a command
`verify` runs is one of them. Common cases:

- a commit-message lint over a pull request's commit range, which needs the PR's base and head
  (a `commit-msg` hook, where the project has one, lints each message as it is written);
- jobs in a check workflow that run only on a schedule, or against a live registry or service;
- jobs on another operating system's runner;
- production builds with size or performance budgets, and browser jobs.

Name each on the report's `Not checked locally` line, with its workflow file and job, so a green
`/dev-check` is never read as more than it is. A project with no CI config has nothing to name:
say so.

## User Input Options

- Empty - Run all checks
- `build` or `typecheck` - Typecheck only
- `lint` - Lint only
- `test` or `tests` - Tests only
- `ci`, `guards` or `verify` - CI guards (`verify`) only
- `sec` or `security` - Security only
- `--verbose` - Show detailed output

## Examples

```
/dev-check            # run all checks (default)
/dev-check typecheck  # typecheck only
/dev-check verify     # CI guards only
/dev-check --verbose  # verbose output
```

## Related Commands

- `/checkpoint` - Quick WIP commit
- `/commit` - Proper conventional commit
- `/session-end` - Full session closure
- `/security-review` - Comprehensive security audit
