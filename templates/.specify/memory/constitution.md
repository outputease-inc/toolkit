<!--
  === Sync Impact Report ===
  Version change: 1.0.0 → 1.1.0
  Type: Material expansion (workflow policy update)

  Modified sections:
    Development Workflow & Quality Gates (Section 3) — replaced strict
    "PR gate" requirement with branch policy: direct commits to `main`
    are the default; PRs required only for breaking changes, DB schema
    migrations, security/auth code, and outside contributors. Aligns
    with small-team reality and authoritative policy now lives in
    CLAUDE.md § Branch & Commit Workflow.

  Rationale:
    OutputEase is a small AI-first team. The blanket PR-per-change
    workflow imposed friction without value for routine work. Reality
    already diverged (most non-release commits land directly on `main`).
    Constitution updated to match.

  Affected specs: (none — no spec depended on the strict PR gate)

  Templates requiring updates:
    ✅ .specify/templates/plan-template.md — no changes needed
       (Constitution Check uses runtime gate; reads this file dynamically)
    ✅ .specify/templates/spec-template.md — no changes needed
    ✅ .specify/templates/tasks-template.md — no changes needed
    ✅ .specify/templates/checklist-template.md — no changes needed
    ✅ .specify/templates/agent-file-template.md — no changes needed

  Previous Sync Impact (1.0.0, initial ratification):
    Modified principles:
      [PRINCIPLE_1_NAME] → I. Package-Layered Architecture
      [PRINCIPLE_2_NAME] → II. Type-Safe Contracts (NON-NEGOTIABLE)
      [PRINCIPLE_3_NAME] → III. Test-First for Shared Code
      [PRINCIPLE_4_NAME] → IV. One Tool, One Truth
      [PRINCIPLE_5_NAME] → V. Spec-Driven Development
    Added sections:
      Technology Constraints (Section 2)
      Development Workflow & Quality Gates (Section 3)
      Governance (filled from placeholder)

  Follow-up TODOs: (none)
-->

# OutputEase Constitution

## Core Principles

### I. Package-Layered Architecture

Every shared feature MUST be built as a scoped package
(`@outputease/<name>`) in `packages/`. Packages are organized into
dependency layers:

**Config** → **Foundation** → **Service** → **UI**

- Dependencies MUST flow downward only — no upward or circular imports.
- Each package MUST provide a barrel export at `src/index.ts`.
- Internal dependencies MUST use `workspace:*` protocol.
- Each package MUST maintain independent semantic versioning.
- Applications in `apps/` consume packages but MUST NOT import from
  each other.

### II. Type-Safe Contracts (NON-NEGOTIABLE)

Zod schemas are the single source of truth for all shared domain types.

- TypeScript types MUST be derived via `z.infer<>` — hand-written
  interfaces are forbidden for domain models.
- TypeScript strict mode is mandatory across all packages.
- Environment variables MUST be validated through `@outputease/env`
  (t3-env); direct `process.env` access is forbidden in application
  code.
- The `any` type requires explicit, documented justification.

### III. Test-First for Shared Code

All packages MUST have unit tests using `bun:test` — no other test
runner is permitted.

- Test files MUST be co-located with source as `*.test.ts` or
  `*.test.tsx`.
- New shared functionality follows TDD: write failing test → implement
  → verify green.
- Integration tests are required for cross-package interactions and
  database operations (Drizzle + Supabase).

### IV. One Tool, One Truth

Each development concern has exactly one canonical tool — alternatives
are forbidden:

| Concern | Canonical Tool | Forbidden Alternatives |
|---------|---------------|----------------------|
| Lint/Format | Biome v2 | ESLint, Prettier |
| Runtime/Test | Bun | Node.js, Jest, Vitest |
| Styling | Tailwind CSS v4 (`@theme` in CSS) | JS config files |
| Colors | `@outputease/brand` tokens | Hardcoded hex values |
| Database | Drizzle ORM | Prisma, raw SQL in app code |
| Commits | Conventional Commits (commitlint + simple-git-hooks) | Free-form messages |
| UI Components | shadcn/ui new-york style (`@outputease/ui`) | Other component libraries |

### V. Spec-Driven Development

Every non-trivial feature MUST follow the spec-kit workflow:
specify → clarify → plan → tasks → implement.

- Specifications are authoritative — code serves specifications, not
  vice versa.
- All implementation decisions MUST align with constitutional
  principles; violations trigger review gates.
- AI agents are first-class development participants; code structure,
  naming, and documentation MUST optimize for Agent Experience (AX).

## Technology Constraints

- **Runtime**: Bun 1.x (package manager, test runner, script runner)
- **Language**: TypeScript strict mode, ES2022 target
- **Monorepo**: Turborepo with Bun workspaces, `workspace:*` protocol
- **UI**: React 19, Next.js for apps, shadcn/ui new-york, Tailwind CSS v4
- **Database**: Drizzle ORM + Supabase (PostgreSQL)
- **State**: Zustand (client) + TanStack Query (server)
- **Validation**: Zod-first (schemas defined, types derived via `z.infer`)
- **Env**: t3-env for type-safe environment variables
- **Deploy**: Vercel
- **Versioning**: release-please, per-package independent, pre-1.0
  `bump-minor-pre-major` enabled (feat → PATCH, BREAKING → MINOR)

## Development Workflow & Quality Gates

Quality gates for all changes:

1. **Pre-commit**: commitlint validates Conventional Commits format
2. **Pre-push**: typecheck + Biome check + tests
3. **Branch policy**: Direct commits to `main` are the default. PRs are
   required for breaking changes, DB schema migrations, security/auth
   code, and outside contributors. See
   `CLAUDE.md § Branch & Commit Workflow`.
4. **CI**: Passing CI (typecheck, Biome check, tests) on every push to
   `main`, whether direct or via merged PR.
5. **Security**: Review required before production deployments.
6. **Accessibility**: WCAG 2.1 AA compliance for all UI components.

Session workflow:

- **Start**: `/quickstart` → Health check + context load
- **During**: `/checkpoint` every 15-30 min (WIP commits, no push)
- **Validate**: `/dev-check` before committing (build/lint/test)
- **End**: `/session-end` → Auto-commit + push + handoff notes

## Governance

- This constitution supersedes all other development practices and
  guidelines.
- `CLAUDE.md` provides runtime development guidance; this constitution
  provides architectural governance.
- Amendments require: documented rationale, constitutional version bump,
  and migration plan for affected specs.
- All specs, plans, and tasks MUST verify constitutional compliance at
  creation.
- Complexity beyond minimum requirements MUST be justified in writing
  with alternatives considered.
- Amendment types: principle addition/removal (MAJOR), material
  expansion (MINOR), clarification/wording (PATCH).

**Version**: 1.1.0 | **Ratified**: 2026-02-21 | **Last Amended**: 2026-05-13
