---
name: security-review
description: Run comprehensive security review with automated scans and AI analysis. Use before production deployments, after auth/endpoint/schema changes, or when a security audit is requested.
allowed-tools: Read Glob Grep Bash Task
---

## User Input

$ARGUMENTS

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Conduct a comprehensive security review: discover the project's security
surfaces, enrich with whatever scanners are locally available, run
surface-scoped review passes (in parallel where the harness allows), and
merge everything into one severity-graded report with full OWASP Top 10
accounting.

## When to Use

Before production deployments or merges to main; after auth/authorization
work, new endpoints, schema changes, or third-party integrations; after
dependency updates; periodic audits.

## Execution

### Phase 0: Scope & Discovery

Decide the review target from the user input: a branch/PR diff if one is
named, otherwise a full audit of the working tree (default).

Map the project generically — do not assume a framework. Probe with unions
and let empty results collapse:

1. **Manifests**: read whichever exist — `package.json`, `pyproject.toml`,
   `Cargo.toml`, `go.mod`. Note the language, framework markers (deps such
   as `next`, `astro`, `@tauri-apps`), and whether the project is
   **publish-shaped** (`bin` / `exports` / `files` fields, or a
   publish/release workflow).
2. **Surface globs** (run the union; empty results just drop out):
   - Routes/endpoints: `**/app/**/route.*`, `**/pages/api/**`,
     `**/api/**`, `**/routes/**`, `**/functions/**`
   - Middleware: `**/middleware.*`
   - Env/config: `.env*`, `**/env.*`, `**/*.config.*`
   - Data layer: `**/migrations/**`, `**/*.sql`, `**/schema*`, `**/queries/**`
   - CI/build: `.github/workflows/*.yml`, `Dockerfile*`, `docker-compose*`
3. **Grep fallbacks** for surfaces globs cannot name: auth
   (`session|jwt|password|token|auth`), uploads
   (`multipart|formData|upload`), webhooks (`webhook|signature|hmac`),
   outbound requests built from user input (`fetch(`, `axios`, and other
   http clients near request parameters).

**Output — the Surface Map**: per surface, the concrete file list, plus the
framework note and the publish-shaped flag. The Surface Map is the sole
input every review pass receives; passes do not re-discover.

### Phase 1: Automated Scan Enrichment (optional, never blocking)

All scanners are optional enrichment. Absence of every scanner is a normal,
reported outcome — never install anything, never block the review.

1. **Package-manager audit, by lockfile**:

   | Lockfile | Command |
   |----------|---------|
   | `package-lock.json` | `npm audit --json` |
   | `pnpm-lock.yaml` | `pnpm audit --json` |
   | `yarn.lock` | `yarn npm audit` (berry) / `yarn audit` (classic) |
   | `bun.lock` / `bun.lockb` | probe `bun audit` (bun >= 1.2.15; treat any error as absent) |
   | `Cargo.lock` | `cargo audit` if on PATH |
   | `poetry.lock` / `requirements*.txt` | `pip-audit` if on PATH |

2. **PATH scanner probes**: check for `gitleaks`, `semgrep`, `osv-scanner`,
   `trufflehog`; run bounded one-liners for whichever exist
   (`gitleaks detect --redact --no-banner`, `osv-scanner -r .`,
   `trufflehog filesystem . --only-verified`,
   `semgrep scan --config auto --quiet` — note semgrep needs network).
   A non-zero exit means findings, not failure.

Normalize scanner output into the findings contract (below) as `SCAN-*`
rows — mostly A02/A06. Record "scanners available: none" in the report when
that is the case.

### Phase 2: Review Plan

Partition the Surface Map into surface-scoped passes. Three core passes;
fold an empty surface into its neighbor, split an oversized one — minimum 2,
maximum 5 passes.

| Pass | Surface | OWASP emphasis (full lens still applies) |
|------|---------|------------------------------------------|
| S1 Entry & Auth | routes, endpoints, server actions, middleware, webhooks, auth logic | A01, A03, A07, A10 |
| S2 Data & Secrets | schema, queries, migrations, env/config, crypto, upload handling | A02, A03, A05, A08, A09 |
| S3 Supply Chain & Build | manifests, lockfiles, build/CI config, `.gitignore`, Dockerfiles | A05, A06, A08 |

Then probe for optional integrations (each degrades to "skip silently"):

- Glob `.claude/agents/*.md`. If `dependency-auditor.md` exists, assign it
  the S3 dependency checks. If `release-leak-scanner.md` exists AND the
  project is publish-shaped, assign it the publish payload. Dispatch each
  as a subagent if you can; otherwise Read the agent file and execute its
  procedure inline during S3. If neither exists, S3's own A06 checklist is
  sufficient.
- If `security-guidance` plugin skills are available in your session, apply
  them as an additional cross-cutting lens during the passes. The OWASP
  checklist below is self-sufficient without them.
- If a built-in `/code-review` command is available (Claude Code) and the
  review target is a branch/PR diff, optionally run it at effort high with
  a security focus and merge its findings as `CR-*` rows.

**Capability gate**: if your harness can dispatch subagents (a Task/Agent
tool is available), launch the passes in parallel, one subagent each.
Otherwise execute the same passes yourself, sequentially, in the order
listed — each dispatch prompt doubles as your section checklist. Discovery,
scanning, merging, and reporting are identical either way.

### Phase 3: Execute Passes

**OWASP Top 10 (2021) lens — every pass applies all ten to its slice**:

- A01 Broken Access Control — authorization checks on every protected route, IDOR
- A02 Cryptographic Failures — secrets at rest and in transit, key management
- A03 Injection — SQL, NoSQL, command, template, ORM-level
- A04 Insecure Design — threat-modeling gaps, missing rate limits
- A05 Security Misconfiguration — default credentials, exposed admin, verbose errors
- A06 Vulnerable Components — outdated/known-CVE dependencies
- A07 Authentication Failures — session fixation, weak password policy, MFA bypass
- A08 Software and Data Integrity Failures — unsigned packages, unverified deserialization
- A09 Logging Failures — sensitive data in logs, missing audit trail for security events
- A10 SSRF — outbound requests that accept user-controlled URLs

**Severity rubric — passed into every prompt, applied to every finding**:

| Severity | Criteria | Action |
|----------|----------|--------|
| CRITICAL | Data loss risk, auth bypass, secret exposure | Fix immediately, block deployment |
| HIGH | XSS, injection, missing validation, IDOR | Fix before next deployment |
| MEDIUM | Missing headers, incomplete error handling | Fix within sprint |
| LOW | Code style affecting security readability | Fix when convenient |

**Findings contract** — every pass and every source returns exactly this
table, nothing else. IDs are namespaced by source (`S1-01`, `SCAN-02`,
`DEP-01`, `LEAK-01`, `CR-01`). A clean area returns an explicit
`| Sn-OK | — | — | — | area clean | — |` row — no silent passes.

```
| ID | Severity | OWASP | File:Line | Issue (one line) | Fix (one line) |
```

**Shared dispatch prompt** (one skeleton; insert the surface focus):

```
You are performing a security review pass over the {SURFACE} of this
project ({framework note from Surface Map}). Review ONLY these files:
{paths from Surface Map}. Apply the full OWASP Top 10 lens above,
weighting {emphasis IDs}. Grade each finding with the severity rubric
above. Trace data flow from input to sink before flagging anything.
Return ONLY the findings-contract table, IDs prefixed {Sn}-.
```

Surface focus inserts:

- **S1**: follow each request from entry to response; verify authn/authz on
  every protected path, input validation at trust boundaries, webhook
  signature checks, and redirect/URL handling.
- **S2**: check secrets handling (env access patterns, hardcoded values),
  query construction, migration safety, upload constraints (size, type,
  path), and what gets logged.
- **S3**: check dependency versions against the Phase 1 scan output,
  lockfile integrity, CI workflow permissions and secret usage,
  `.gitignore` coverage of sensitive files, and build-time exposure.

### Phase 4: Merge, Dedup, Re-grade

- Collect every findings table (`SCAN`, `S1..Sn`, `DEP`, `LEAK`, `CR`).
- **Dedup key**: normalized path + line (±5 lines) + issue class. Keep one
  row: highest severity wins, OWASP tags union. When a scanner and an AI
  pass agree, mark the finding **corroborated** — that is a confidence
  signal, not a duplicate.
- **Re-grade centrally**: pass severities are advisory; re-apply the rubric
  to every surviving finding yourself. One grader, one rubric.
- **Coverage accountability**: any OWASP category no pass actually assessed
  is reported `Not Assessed` — never a silent Pass.

### Phase 5: Report

```
# Security Review Summary - [Date]

## Overview
Total: [n] | Critical: [n] | High: [n] | Medium: [n] | Low: [n]
Scanners available: [list | none]
Passes run: [S1, S2, S3, ...] ([parallel | sequential])

## Status
[CRITICAL ISSUES - DO NOT DEPLOY | Issues Found - Review Required | SECURE - Ready for Deployment]

## Top Critical/High Issues
1. [ID] [Title] - [File:Line] — Risk: [one line] — Fix: [one line]

## OWASP Top 10 Compliance
| Vulnerability | Status | Covered By | Findings |
|---------------|--------|------------|----------|
| A01: Broken Access Control | Pass/Fail/Not Assessed | [pass IDs] | [details] |
| ... (all ten rows) | | | |

## Action Items
- Immediate (today): [critical issues, file paths]
- This week: [high]
- This sprint: [medium]
- After fixes: re-run this review; verify no regressions
```

## When Critical Issues Found

1. Do NOT deploy until all critical issues resolved
2. Rotate any exposed secrets immediately
3. Block the current PR/branch from merging

## Coordinates With

Every integration below is conditional — use it when present, skip silently
when not:

- **security-guidance** plugin (if installed): additional cross-cutting lens
- **`/code-review`** (if the harness provides it): focused `CR-*` pass over branch/PR diffs
- **dependency-auditor** agent (if present in `.claude/agents/`): S3 dependency checks
- **release-leak-scanner** agent (if present, publish-shaped projects): publish-payload sweep
- **superpowers:requesting-code-review** skill (if installed): PR-time security checks alongside other reviewers
- **coderabbit GitHub App** (if configured): automated review when the PR opens
