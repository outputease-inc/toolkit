---
name: gen-test
description: |
  Generate bun:test files for a module following project conventions.
  Delegates to test-writer agent. Use after implementing any new function,
  fixing a bug, or before PR submission. Trigger when user mentions
  "add tests", "test this", "needs coverage", or after any new module creation.
---

# Generate Tests

Scaffold and generate test files for a given module using bun:test conventions.

## Usage

Invoke with `/gen-test <module-path>`

Examples:
- `/gen-test src/lib/validators.ts`
- `/gen-test src/lib/fetch-client.ts`
- `/gen-test src/services/user-service.ts`

## When to Use

- After implementing a new module or function that needs test coverage
- When asked to add tests to existing code
- Before PR submission to ensure test coverage
- After fixing a bug (write regression test)

## Do NOT Use When

- Writing E2E tests for full user flows — invoke test-writer agent directly with E2E scope
- The module already has comprehensive tests — extend manually or use test-writer agent
- Testing third-party library behavior
- The target file has no testable exports (pure type files, config-only)

## Procedure

### Step 1: Validate Target

1. Verify `<module-path>` exists using Glob
2. Read the source file to understand its exports and logic
3. If the path is ambiguous, search for matches: `Glob: packages/*/src/**/<filename>*`
4. If the file has no testable exports (only type exports, only re-exports), inform the user and stop

### Step 2: Check for Existing Tests

Search for a co-located test file:
```
Glob: <directory>/<basename>.test.ts
Glob: <directory>/<basename>.test.tsx
```

If a test file exists:
- Read it and summarize existing coverage
- Ask: extend existing tests, or regenerate from scratch?
- If extending, note the existing test structure for the agent

### Step 3: Classify Test Type

| Source Content | Test Type |
|---|---|
| Pure functions, utilities, validators | Unit tests |
| React components (`.tsx` with JSX) | Component tests |
| Hooks (`use*.ts`) | Hook tests |
| Zod/Drizzle schema definitions | Validation tests |
| API client functions | Integration tests |

### Step 4: Delegate to test-writer Agent

Invoke the `test-writer` agent with a focused prompt including:
- Module path and key exports
- Test type classification from Step 3
- Existing coverage notes (if any from Step 2)
- Focus areas: edge cases, error paths, happy paths

Let the agent create the test file and run the tests.

If the test-writer agent is unavailable, write the test file directly following bun:test conventions: use `test()` not `it()`, arrow notation in test names (`"scenario -> expected"`), co-located test files, and cover edge cases, error paths, and happy paths.

### Step 5: Verify Tests Pass

1. Confirm the test file was created at the expected co-located path
2. Run: `bun test <test-file-path>`
3. All tests must pass — fix any failures before completing

## Output Format

```
## Tests Generated: [module name]

**Source**: [module-path]
**Test file**: [test-file-path]
**Test type**: Unit | Component | Hook | Validation | Integration
**Tests written**: [count]

### Coverage
- [list of functions/scenarios tested]

### Skipped
- [any exports intentionally not tested, with reason]
```

## Related Skills

- **new-component** — Use gen-test after scaffolding a new component to add tests
- **a11y-review** — After generating component tests, run a11y-review for accessibility

## Notes

- The test-writer agent handles all conventions (bun:test, `test()` not `it()`, arrow notation)
- This skill adds orchestration: validation, dedup checking, classification, verification
- For bulk test generation across multiple files, invoke the test-writer agent directly
- Test files are always co-located: `<source>.test.ts` next to `<source>.ts`
