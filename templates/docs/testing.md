# Testing Strategy

Test types, coverage targets, naming conventions, and framework configuration for [PROJECT_NAME].

## Test Types

| Type | Location | Framework | Purpose | Run Frequency |
|------|----------|-----------|---------|---------------|
| Unit | `*.test.[EXT]` (co-located) | [UNIT_FRAMEWORK] | Pure functions, business logic | Every commit |
| Integration | `[INTEGRATION_DIR]/*.test.[EXT]` | [INTEGRATION_FRAMEWORK] | API routes, database queries | Every commit |
| E2E | `[E2E_DIR]/*.spec.[EXT]` | [E2E_FRAMEWORK] | User-facing flows | Pre-merge |
| Accessibility | `[E2E_DIR]/a11y.spec.[EXT]` | [A11Y_FRAMEWORK] | WCAG compliance | Pre-merge |
| [ADDITIONAL_TEST_TYPE_OR_REMOVE] | | | | |

## Test-First Development

The hookify rule `require-tdd` encourages test-driven development when editing source files. Follow the TDD cycle:

1. **RED** -- Write a failing test that describes the expected behavior
2. **GREEN** -- Write the minimum code needed to make the test pass
3. **REFACTOR** -- Clean up the implementation while keeping tests green

When TDD is not practical (e.g., exploratory prototyping), write tests immediately after implementation before opening a pull request.

## Test Naming Convention

Use the `test()` function (not `it()`) with arrow notation describing the transformation:

```
test('input scenario -> expected result', () => { ... });
```

Examples:
- `test('empty cart -> returns zero total', ...)`
- `test('expired token -> throws AuthError', ...)`
- `test('valid form data -> creates user record', ...)`

Group related tests with `describe()` blocks named after the module or function under test.

## Coverage Targets

| Category | Minimum | Notes |
|----------|---------|-------|
| Overall | [COVERAGE_MINIMUM]% | Enforced in CI |
| Critical paths (auth, [CRITICAL_PATHS]) | 100% | No exceptions |
| Utility functions | 90% | Pure functions are easy to test |
| UI components | [COMPONENT_COVERAGE]% | Focus on interaction, not rendering |

## Running Tests

| Command | Purpose |
|---------|---------|
| `[TEST_COMMAND]` | Run all tests |
| `[TEST_WATCH_COMMAND]` | Run tests in watch mode |
| `[TEST_COVERAGE_COMMAND]` | Run with coverage report |
| `[TEST_E2E_COMMAND]` | Run end-to-end tests |
| `[TEST_SINGLE_COMMAND] <path>` | Run a single test file |

## Framework Configuration

| Setting | Value | File |
|---------|-------|------|
| Test runner | [TEST_RUNNER] | [TEST_CONFIG_FILE] |
| Coverage tool | [COVERAGE_TOOL] | [TEST_CONFIG_FILE] |
| Test environment | [TEST_ENVIRONMENT] | [TEST_CONFIG_FILE] |
| Setup file | [TEST_SETUP_FILE_OR_REMOVE] | [TEST_CONFIG_FILE] |
| Timeout | [TEST_TIMEOUT]ms | [TEST_CONFIG_FILE] |

<!-- TODO: Link or inline relevant test configuration from your project -->

## Mocking Conventions

- **External services**: Always mock HTTP calls and third-party APIs
- **Database**: Use [DB_TEST_STRATEGY] (e.g., test database, in-memory, mocks)
- **Time/dates**: Mock `Date.now()` or equivalent for deterministic tests
- **Environment variables**: Set test-specific values in [TEST_ENV_FILE]
- **File system**: Mock file I/O; never write to the real filesystem in tests
- **Naming**: Prefix mock files with `__mocks__/` or co-locate as `[module].mock.[EXT]`

## What NOT to Test

- Component rendering without user interaction (snapshot-only tests)
- Third-party library internals
- Database/ORM implementation details
- Framework behavior (e.g., routing mechanics)
- Generated code or auto-generated types
- Private methods (test through public API instead)

## CI Integration

Tests run automatically on every push and pull request:

1. **Lint check** -- `[LINT_COMMAND]`
2. **Unit + Integration** -- `[TEST_COMMAND]` with coverage enforcement
3. **E2E** -- `[TEST_E2E_COMMAND]` against [E2E_TARGET]
4. **Coverage gate** -- Fails if below [COVERAGE_MINIMUM]%

See also: `./cicd.md` for full pipeline configuration (if applicable).

The `test-writer` agent (`.claude/agents/test-writer.md`) can generate tests following these conventions. Invoke it with:

```
Task: test-writer "<file-or-module-path>"
```
