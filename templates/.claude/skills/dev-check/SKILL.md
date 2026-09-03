---
name: dev-check
description: Fast development feedback (build/lint/test validation) in 60-90 seconds. Use before committing or claiming work complete — the evidence step of superpowers:verification-before-completion when that plugin is installed.
allowed-tools: Read Glob Grep Bash
---

## User Input

$ARGUMENTS

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Run a fast validation loop during active development. Combines build checking,
linting, and testing in parallel for rapid feedback.

**This is a master command that combines:**

- `bun run typecheck` (TypeScript type checking)
- `bun run check` (Biome lint + format)
- `bun run test` (Bun test runner)
- Quick security scan

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

### 2. Run Parallel Checks

Execute these checks in parallel:

**Check 1: Typecheck**

```bash
bun run typecheck 2>&1
```

- Parse for error count
- Capture file locations if errors

**Check 2: Lint + Format (Biome)**

```bash
bun run check 2>&1
```

- Parse for warning/error count
- Capture file locations if errors

**Check 3: Tests**

```bash
bun run test 2>&1
```

- Parse for pass/fail counts
- Capture failed test names if any

**Check 4: Security Quick-Scan**

Run inline:

```bash
# Check for uncommitted env files
git status --short -- "*.env" "*.env.*" ".env" || true

# Check staged files for hardcoded secrets
git diff --cached --name-only 2>/dev/null | head -10
```

**Checks performed:**

- Verify no .env files are staged
- Check staged files for common secret patterns (`sk-`, `pk_`, `api_key=`, `PRIVATE_KEY=`)

### 3. Generate Quick Report

```
DEV CHECK RESULTS
===================================================================

| Check      | Status | Details                                    |
|------------|--------|--------------------------------------------|
| Typecheck  | OK/ERR | [No errors | X errors in Y files]          |
| Lint       | OK/ERR | [Clean | X warnings, Y errors]             |
| Tests      | OK/ERR | [X passed | X passed, Y failed]            |
| Security   | OK/ERR | [Clean | X issues detected]                |

Duration: [Xs]
===================================================================
```

### 4. Summary Based on Results

**If ALL PASS:**

```
DEV CHECK PASSED
---------------------------------------------------------------------
All quick checks passed. Safe to continue development.

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
- [test name]

[If security issues:]
Security Issues:
- [issue description]

---------------------------------------------------------------------
Fix issues before continuing.
```

## User Input Options

- Empty - Run all checks
- `build` or `typecheck` - Typecheck only
- `lint` - Lint only
- `test` or `tests` - Tests only
- `sec` or `security` - Security only
- `--verbose` - Show detailed output

## Examples

```bash
# Run all checks (default)
/dev-check

# Typecheck only
/dev-check typecheck

# Tests only
/dev-check test

# Verbose output
/dev-check --verbose
```

## Related Commands

- `/checkpoint` - Quick WIP commit
- `/commit` - Proper conventional commit
- `/session-end` - Full session closure
- `/security-review` - Comprehensive security audit
