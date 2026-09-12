# Security Policy

## Reporting a vulnerability

If you find a security issue in `@outputease/toolkit`, please report it
privately. Do not file a public GitHub issue.

**Email:** `security@outputease.com`

Include:

- A description of the issue and its potential impact.
- Steps to reproduce, or a proof-of-concept if you have one.
- The toolkit version (`outputease --version`) and the platform you observed
  it on.

We aim to acknowledge reports within 2 business days and to ship a fix or
mitigation within 30 days for confirmed high-severity issues. We will credit
reporters in release notes unless asked otherwise.

## Supported versions

Only the latest published version of `@outputease/toolkit` receives security
updates. The toolkit is pre-1.0 and ships frequent releases; please update
before reporting.

## Scope

In scope:

- The published `@outputease/toolkit` package on npm.
- The `outputease`, `outputease-update`, `outputease-validate`, and
  `outputease-validate-agents` CLI binaries.
- The `install.sh` curl-pipe-sh installer.
- Scaffolded project templates that ship with the toolkit.

Out of scope:

- Third-party dependencies (please report to upstream).
- Vulnerabilities in tools the scaffold pulls in but does not configure
  insecurely.
- Social engineering, physical attacks, or non-toolkit OutputEase
  infrastructure.
