# Development Workflow

Branching strategy, command workflows, code review process, release cycle, and team collaboration conventions for [PROJECT_NAME].

## Contents

1. [Getting Started](#getting-started)
2. [Development Lifecycle](#development-lifecycle)
3. [Detailed Workflows](#detailed-workflows)
4. [Branch Strategy](#branch-strategy)
5. [Code Review Process](#code-review-process)
6. [Release Cycle](#release-cycle)
7. [Team Collaboration](#team-collaboration)

For command reference (syntax, durations, selection guides), see `.claude/commands/README.md`.

---

## Getting Started

If this is your first session on [PROJECT_NAME]:

1. **Set up your environment** -- Follow `docs/environment.md` to install prerequisites and configure `.env`.
2. **Run `/quickstart`** -- Validates your setup, loads project context, and gets you coding in under 60 seconds.
3. **Use `/checkpoint` every 15-30 minutes** -- Saves your progress without triggering CI.
4. **End with `/session-end`** when ready to push -- Creates a handoff for the next session.

For the full command reference, see `.claude/commands/README.md`.

---

## Development Lifecycle

```
═══════════════════════════════════════════════════════════════════════════════
                        DEVELOPMENT LIFECYCLE
═══════════════════════════════════════════════════════════════════════════════

SESSION START
    │
    ├── Normal start ──► /quickstart ──────────────► Active Development
    │                    (30-60s)                           │
    │                    • health-check              ┌─────┴──────┐
    │                    • session-start              ▼            ▼
    │                    • load-context          /dev-check   /checkpoint
    │                                            (60-90s)     (~15s)
    │                                            • build      • stage all
    │                                            • lint       • wip: commit
    │                                            • tests      • task verify
    │                                            • security   • NO push
    │                                                  │      • NO CI
    └── After crash ───► /resume                      └─────┬──────┘
                         (10-20s)                             ▼
                         • git state check            Feature Complete?
                         • uncommitted work            ┌─────┴──────┐
                         • stash check                 ▼            ▼
                         • recovery steps             YES           NO
                         • then /quickstart            │            │
                                                 /session-end  /checkpoint
                                                 (~5 min)      (~15s, no CI)
                                                 • commit
                                                 • push (CI)
                                                 • update HANDOFF.md
                                                 • handoff notes
                                                       │
                                                       ▼
                                                 Create PR
                                                 (manual or scripted)
                                                       │
                                                       ▼
                                                 Code Review
                                                 (see below)
                                                       │
                                                       ▼
                                              Ready for Deploy?
                                              ┌───────┴───────┐
                                              ▼               ▼
                                             YES              NO
                                              │          (more features)
                                        /security-review
                                        (15-20 min)
                                        • automated scan
                                        • OWASP Top 10
                                        • AI deep analysis
                                              │
                                              ▼
                                         PRODUCTION

═══════════════════════════════════════════════════════════════════════════════
```

---

## Detailed Workflows

### Daily Development Flow

```
Morning:
  /quickstart
      │
      ▼
  [Code for 15-30 min]
      │
      ▼
  /checkpoint ──────► [Code more] ──────► /dev-check
      │                                       │
      │                                       ▼
      │                               [Fix any issues]
      │                                       │
      └───────────────────────────────────────┘

End of Day:
  Feature complete? ─────┬──► YES ──► /session-end ──► Create PR
                         │
                         └──► NO ──► /checkpoint (no CI, saves CI minutes!)

NOTE: Use /checkpoint to save session state without burning CI minutes.
      Use /session-end only when ready to push to remote.
```

### Session Recovery Flow

```
/resume
    │
    ├── Check 1: Git state (branch, last commit, uncommitted changes)
    ├── Check 2: Uncommitted work (modified/staged/untracked)
    ├── Check 3: Stashed work (list stashes with dates)
    ├── Check 4: Last session context from HANDOFF.md
    │
    ▼
Recovery Report + Recommended Next Steps
    │
    ▼
/quickstart (normal session init)
```

### Pre-Deployment Flow

```
/security-review
    │
    ├── Phase 1: Automated Scan
    │   └── [SECURITY_SCAN_COMMAND] (npm audit, pip-audit, cargo audit, etc.)
    │
    ├── Phase 2: AI Deep Analysis
    │   └── coderabbit:code-review + security-guidance plugin
    │
    ├── Phase 3: OWASP Top 10 Check
    │   ├── Injection
    │   ├── Auth failures
    │   ├── Sensitive data exposure
    │   └── ... (all 10 categories)
    │
    └── Phase 4: Report
        ├── Severity classification (critical/high/medium/low)
        └── Actionable remediation items
```

<!-- [PROJECT_SPECIFIC_WORKFLOWS] Add project-specific detailed workflows here, e.g.:
### Ship-to-Merge Flow
### Production Deployment Flow
### Quarterly Maintenance Flow
-->

---

## Branch Strategy

### Branch Types

| Type | Pattern | Base | Merges Into | Purpose |
|------|---------|------|-------------|---------|
| Main | `main` | -- | -- | Production-ready code |
| Feature | `NNN-feature-name` | `main` | `main` | New features and enhancements |
| Bugfix | `NNN-fix-name` | `main` | `main` | Bug fixes |
| Hotfix | `hotfix/description` | `main` | `main` | Urgent production fixes |
| Release | `release/[VERSION]` | `main` | `main` | Release preparation |
| Chore | `chore/description` | `main` | `main` | Tooling, deps, config changes |

### Branch Lifecycle

```
main ─────────────────────────────────────────────▶
  │                                         ▲
  └── 123-add-widget ──── PR ───────┘
       │         │          │
     create    commits    merge
```

1. **Create** branch from `main` using the naming convention above.
2. **Develop** with small, focused commits following conventional commit format.
3. **Open PR** when the feature is ready for review.
4. **Merge** via squash-and-merge after approval and passing checks.
5. **Delete** the feature branch after merge.

---

## Code Review Process

### Submitting a PR

| Step | Action |
|------|--------|
| 1 | Ensure all CI checks pass before requesting review |
| 2 | Write a clear PR description summarizing the change and motivation |
| 3 | Link to the relevant issue or ticket |
| 4 | Add screenshots or recordings for UI changes |
| 5 | Self-review the diff before requesting others |
| 6 | Request review from [REVIEW_TEAM_OR_CODEOWNERS] |

### Reviewing a PR

| Criterion | Check |
|-----------|-------|
| Correctness | Does the code do what the PR claims? |
| Tests | Are new behaviors covered by tests? |
| Security | Are inputs validated? Are secrets protected? |
| Conventions | Does it follow `../CLAUDE.md` conventions? |
| Documentation | Are relevant docs updated (API, architecture, etc.)? |

### Merge Requirements

| Requirement | Details |
|-------------|---------|
| Approvals | [REVIEW_COUNT] reviewer(s) must approve |
| CI status | All pipeline stages must pass |
| Conflicts | Branch must be up to date with `main` |
| Merge method | Squash and merge (single commit on `main`) |

---

## Release Cycle

### Versioning

This project follows [Semantic Versioning](https://semver.org/):

| Bump | When |
|------|------|
| **Major** (`X.0.0`) | Breaking changes to public API or behavior |
| **Minor** (`0.X.0`) | New features, backward-compatible additions |
| **Patch** (`0.0.X`) | Bug fixes, dependency updates, documentation |

### Release Process

1. **Prepare** -- Create `release/[VERSION]` branch from `main`.
2. **Update version** -- Bump version in the project manifest.
3. **Update changelog** -- Add release notes to `../CHANGELOG.md`.
4. **Test** -- Run the full test suite and verify staging deployment.
5. **Merge** -- Merge release branch to `main`.
6. **Tag** -- Create a git tag: `git tag v[VERSION]`.
7. **Deploy** -- Production deployment triggers on tag push (see `./cicd.md`).

---

## Team Collaboration

| Channel | Purpose |
|---------|---------|
| [PRIMARY_CHANNEL] | Day-to-day development discussion |
| [SECONDARY_CHANNEL_OR_REMOVE] | Design and planning |
| Pull request comments | Code-specific discussion |
| `../HANDOFF.md` | Async session continuity between developers |

- **Commit messages** follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`
- **PR titles** follow the same format as commit messages.
- **Issue references** use `#[ISSUE_NUMBER]` or `[TICKET_PREFIX]-[NUMBER]` in commit body.

---

## Multi-Developer Considerations

The session workflow (quickstart → checkpoint → session-end) is designed for
a single developer per branch. For teams:

- **Each developer works on a separate branch** — HANDOFF.md is per-branch,
  not per-project
- **Never run `/session-end` on shared branches** (main, develop) — use
  feature branches only
- **Optional**: Use developer-specific handoff files (`HANDOFF-[name].md`)
  for trunk-based development workflows

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) -- Complete development guide for Claude Code
- [.claude/commands/README.md](../.claude/commands/README.md) -- Full command reference with syntax and examples
- [conventions.md](./conventions.md) -- Coding standards, commit format, and branch naming
- [cicd.md](./cicd.md) -- CI/CD pipeline configuration
- [testing.md](./testing.md) -- Test strategy and coverage requirements
