---
description: Run comprehensive security review with automated scans and AI analysis
allowed-tools: ["Read", "Glob", "Grep", "Bash", "Task"]
---

## User Input

$ARGUMENTS

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Conduct a comprehensive security review of the codebase. Combines automated
scanning (if available) with systematic AI-powered analysis driven by the
OWASP Top 10 framework, the `security-guidance` plugin, and the
`coderabbit:code-review` skill.

## When to Use

**Required:**

- Before production deployments
- Before merging PRs to main/staging
- After implementing authentication or authorization features
- After adding new database tables or API endpoints
- After integrating third-party services

**Recommended:**

- After major feature additions
- When refactoring security-critical code
- After dependency updates
- Periodic audits (quarterly or per team cadence)

## Execution

### Phase 1: Automated Scan

Run the project's security scanning command if one is configured. Check the CLAUDE.md Quick Start table or `package.json` scripts for the project's configured scan command.

If no automated scan is configured: Skip to Phase 2.

### Phase 2: AI-Powered Deep Analysis

Invoke the `coderabbit:code-review` skill (focus = security) and consult the
`security-guidance` plugin for cross-cutting concerns. Apply the **OWASP Top 10
(2021)** framework systematically as you analyze each scope below.

**OWASP Top 10 lens to apply throughout**:

- A01 Broken Access Control — authorization checks on every protected route, IDOR
- A02 Cryptographic Failures — secrets at rest and in transit, key management
- A03 Injection — SQL, NoSQL, command, template, ORM-level
- A04 Insecure Design — threat-modeling gaps, missing rate limits
- A05 Security Misconfiguration — default credentials, exposed admin, verbose errors
- A06 Vulnerable Components — outdated/known-CVE dependencies (cross-check with `bun outdated`)
- A07 Authentication Failures — session fixation, weak password policy, MFA bypass
- A08 Software and Data Integrity Failures — unsigned packages, unverified deserialization
- A09 Logging Failures — sensitive data in logs, missing audit trail for security events
- A10 SSRF — outbound requests that accept user-controlled URLs

**Scope** (adjust to project structure):

1. **Critical Files** (Priority):
   - API routes and endpoints
   - Server actions and mutations
   - Authentication and authorization logic
   - Database migrations and queries (packages/db/)
   - Middleware and request processing

2. **Security Surfaces**:
   - Environment configuration (packages/env/)
   - Input validation at trust boundaries
   - Session and token management
   - File upload handling (if applicable)
   - Third-party integrations

3. **Configuration Files**:
   - `.gitignore` (required patterns present?)
   - Package manifest (vulnerable dependencies?)
   - Build configuration (secrets exposure?)

### Phase 3: Results Classification

| Severity | Criteria | Action |
|----------|----------|--------|
| CRITICAL | Data loss risk, auth bypass, secret exposure | Fix immediately, block deployment |
| HIGH | XSS, injection, missing validation, IDOR | Fix before next deployment |
| MEDIUM | Missing headers, incomplete error handling | Fix within sprint |
| LOW | Code style affecting security readability | Fix when convenient |

### Phase 4: Generate Report

```
# Security Review Summary - [Date]

## Overview
- Total Issues: [count]
- Critical: [count]
- High: [count]
- Medium: [count]
- Low: [count]

## Status
[CRITICAL ISSUES - DO NOT DEPLOY | Issues Found - Review Required | SECURE - Ready for Deployment]

## Top Critical/High Issues
1. [ISSUE-001] [Title] - [File:Line]
   - Risk: [Description]
   - Fix: [Summary]

## OWASP Top 10 Compliance
| Vulnerability | Status | Findings |
|---------------|--------|----------|
| A01: Broken Access Control | Pass/Fail | [details] |
| A02: Cryptographic Failures | Pass/Fail | [details] |
| A03: Injection | Pass/Fail | [details] |
| A04: Insecure Design | Pass/Fail | [details] |
| A05: Security Misconfiguration | Pass/Fail | [details] |
| A06: Vulnerable Components | Pass/Fail | [details] |
| A07: Authentication Failures | Pass/Fail | [details] |
| A08: Integrity Failures | Pass/Fail | [details] |
| A09: Logging Failures | Pass/Fail | [details] |
| A10: SSRF | Pass/Fail | [details] |

## Immediate Actions Required
1. [Action] - Timeline: [When]
```

### Phase 5: Create Action Items

```
Immediate (Today):
- [ ] [Critical issue - with file path]

This Week:
- [ ] [High priority issue]

This Sprint:
- [ ] [Medium priority issue]

Testing:
- [ ] Run security tests (if configured)
- [ ] Verify no regressions
- [ ] Re-run automated scan after fixes
```

## When Critical Issues Found

1. Do NOT deploy until all critical issues resolved
2. Rotate any exposed secrets immediately
3. Block the current PR/branch from merging

## Coordinates With

- **coderabbit:code-review** skill: Drives the systematic file-by-file analysis
- **security-guidance** plugin: Cross-cutting security best-practice guidance
- **dependency-auditor** agent: Flags vulnerable or outdated dependencies (A06)
- **superpowers:requesting-code-review** skill: For PR-time security checks alongside other reviewers
