# Toolkit Setup

Complete these steps after scaffolding the toolkit into your project.

---

## Quick Start

```bash
# 1. Fill the config file with your project values
#    (open toolkit.config.json and fill all sections)

# 2. Dry run — review what will change
bun setup-placeholders.js

# 3. Apply all changes
bun setup-placeholders.js --apply

# 4. Validate setup
bun verify-setup.js
```

That's it. The setup pipeline handles token replacement, file pruning, conditional section removal, settings generation, MCP configuration, .gitignore uncommenting, and hookify rule enablement automatically.

---

## Before You Start

### Node.js Requirement

All scripts and hooks require Node.js v18+. Ensure `node` is available in your PATH, even for non-Node.js projects. The `protect-sensitive.js` security hook depends on it.

### Spec-Kit (Required External Tool)

The `specify` CLI (package: `specify-cli`) is a required prerequisite for the `/speckit-*` slash commands.

**Source:** [github.com/github/spec-kit](https://github.com/github/spec-kit)

**Prerequisites:** Python 3.11+, [uv](https://docs.astral.sh/uv/), Git

```bash
# Install
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git

# Initialize for this project
specify init . --integration claude

# Windows PowerShell variant
specify init . --integration claude --script ps

# Verify
specify check
```

**Post-init:** Run `/speckit-constitution` in Claude Code to establish project principles.

**Upgrade:**
```bash
uv tool install specify-cli --force --from git+https://github.com/github/spec-kit.git
specify init --here --force --integration claude
```

---

## Step 1: Fill the Config

Open `toolkit.config.json` and fill all sections:

| Section | What to Fill | Required Fields |
|---------|-------------|-----------------|
| `project` | Name, description, repo URL, license | `name` |
| `tech_stack` | Runtime, package manager, framework, language, directories | `runtime`, `package_manager`, `source_dir` |
| `commands` | Dev, build, test, lint, install commands | `dev`, `build`, `test`, `lint`, `install` |
| `tools` | Test runner, linter, formatter names and configs | — |
| `features` | Boolean flags for auth, database, CI, frontend, etc. | — |
| `optional` | Hosting, CI platform, database, auth provider, etc. | — |

### Feature Flags

Feature flags control which files and sections are included. Set `false` to remove inapplicable content:

| Flag | Controls | Files Pruned When False |
|------|----------|------------------------|
| `has_frontend` | UI-related docs, skills, agents | `docs/design.md`, `docs/performance.md`, `docs/infrastructure.md`, skills, agents |
| `has_auth` | Authentication docs | `docs/auth.md` |
| `has_database` | Database docs | `docs/database.md` |
| `has_ci` | CI/CD docs | `docs/cicd.md` |
| `has_staging_env` | Staging environment sections | Conditional sections removed |
| `has_e2e_tests` | E2E test commands/sections | Conditional sections removed |
| `has_integration_tests` | Integration test commands | Conditional sections removed |
| `has_typecheck` | Type-check commands | Conditional sections removed |
| `has_format_on_save` | Format-on-save hook | Conditional sections removed |
| `has_dependabot` | Dependency update tool | Conditional sections removed |
| `has_mfa` | MFA-related sections in auth docs | Conditional sections removed |
| `has_github_mcp` | GitHub MCP server in `.mcp.json` | MCP entry removed |

> **Note**: `package_runner` (under `features`) is a string, not a boolean. It controls the MCP server command prefix (e.g., `"npx"`, `"bunx"`, `"pnpx"`). The pipeline replaces `"npx"` in `.mcp.json` args arrays with the configured runner.

### Token List

Run `bun setup-placeholders.js --list` to see all placeholder tokens found in your files and their occurrence counts.

---

## Step 2: Run the Setup Pipeline

### Dry Run

```bash
bun setup-placeholders.js
```

Review the output. The pipeline runs 6 phases:

1. **LOAD** — Parses config, validates required fields, computes derived values, builds token map
2. **PRUNE** — Deletes files not applicable to your project (based on feature flags), cleans INDEX.md references
3. **REMOVE** — Processes `_OR_REMOVE` tokens: replaces with values or removes entire lines/sections based on context (table rows, bullets, headings, tree lines, inline text)
4. **REPLACE** — Standard `[TOKEN]` find-replace across all files using the token map
5. **OPERATE** — Generates `settings.local.json`, mutates `.mcp.json`, uncomments `.gitignore` patterns, enables hookify rules
6. **VALIDATE** — Checks config completeness, JSON validity, feature flag consistency, hookify state, and required files

### Apply

```bash
bun setup-placeholders.js --apply
```

All changes are written. The summary shows:
- Files pruned
- `_OR_REMOVE` operations performed
- Token replacements made
- File operations completed
- Validation results (pass/fail/warn)
- Remaining unfilled placeholders (if any)

---

## Step 3: Validate

```bash
bun verify-setup.js
```

This checks:
- JSON file validity (`.claude/settings.json`, `toolkit.config.json`, `.claude/settings.local.json`)
- Config structure (required sections and fields)
- Unfilled placeholders in critical files and enabled hookify rules
- Feature flag consistency (files exist/don't exist per flags)
- `protect-sensitive.js` hook blocks `.env` access and allows safe files
- MCP config has no remaining `REPLACE` tokens
- `settings.local.json` exists if formatter was configured
- All required files exist (`CLAUDE.md`, `.gitignore`, `LICENSE`, etc.)

---

## Step 4: Post-Setup (Manual)

These steps require the Claude Code runtime or external tools — they can't be automated by the Node.js pipeline.

### Install Plugins

```bash
claude plugin install hookify@claude-plugins-official
claude plugin install superpowers@claude-plugins-official
claude plugin install commit-commands@claude-plugins-official
claude plugin install claude-md-management@claude-plugins-official
```

> **Warning**: Without the `hookify` plugin, all hookify enforcement rules
> (`.claude/hookify.*.md`) are completely inert — no errors, no warnings, no
> enforcement.
>
> **Known limitation**: Hookify `warn` rules currently display messages to the
> user but do not pass them to Claude itself ([#15203](https://github.com/anthropics/claude-code/issues/15203)).
> `block` rules work as expected.

**Verification:** Run `/plugin` inside Claude Code → **Installed** tab.

#### Plugin Reference

| Plugin | Purpose | Required? |
|--------|---------|-----------|
| **hookify** | Workflow enforcement via `.md` rule files | Yes |
| **superpowers** | Structured workflows (brainstorm, plan, execute) | Yes |
| **commit-commands** | Conventional commits, PR creation, branch cleanup | Yes |
| **claude-md-management** | CLAUDE.md maintenance and improvement | Yes |
| **code-review** | Pull request code review | Recommended |
| **pr-review-toolkit** | Multi-agent PR review | Recommended |
| **code-simplifier** | Auto-simplify code after modifications | Recommended |
| **frontend-design** | Production-grade UI design skill | Recommended |

### Initialize Spec-Kit

```bash
specify init . --integration claude
```

Then run `/speckit-constitution` in a Claude Code session.

### Fill Remaining Docs Tokens

The pipeline auto-derives many `docs/` tokens from config values (database engine, auth provider, test framework, etc.). Any remaining unfilled tokens are reported in the setup summary.

Fill these incrementally as your project evolves — unfilled docs tokens are harmless and won't break commands.

---

## How Token Resolution Works

| Token Category | Resolution | Source |
|----------------|------------|--------|
| Config tokens | **Auto** (setup pipeline Phase 4) | `toolkit.config.json` |
| Derived tokens | **Auto** (setup pipeline Phase 1) | Computed from config values |
| `_OR_REMOVE` tokens | **Auto** (setup pipeline Phase 3) | Feature flags + config values |
| File pruning | **Auto** (setup pipeline Phase 2) | Feature flags |
| File operations | **Auto** (setup pipeline Phase 5) | Config values |
| Command tokens | **Dynamic** (runtime) | CLAUDE.md Quick Start table |
| Auto-populated tokens | **Dynamic** (by commands) | `<!-- SESSION_LOG -->` etc. |
| Remaining docs tokens | **Manual** (fill as you build) | Each `docs/*.md` file |

> **Tip**: Run `bun setup-placeholders.js --list` to see all tokens and their frequencies.

---

## Cross-Platform Notes

- All scripts use Node.js `fs`/`path` — no shell commands, works on Windows/macOS/Linux.
- `.gitattributes` enforces LF line endings in git. The setup pipeline normalizes all written files to LF.
- `.editorconfig` sets LF, UTF-8, and consistent indentation for editors.
- If adding the toolkit to an existing repo with CRLF files:
  ```bash
  git add --renormalize .
  git commit -m "chore: normalize line endings via .gitattributes"
  ```

---

## MCP Servers

Configured in `.mcp.json`. The setup pipeline handles the GitHub MCP entry automatically based on `features.has_github_mcp` and `optional.github_mcp_url`.

| Server | Status |
|--------|--------|
| context7 | Pre-configured — works out of the box |
| github | Added if `has_github_mcp: true` and URL provided; removed otherwise |
| playwright | Pre-configured — works out of the box |

---

## Troubleshooting

**Pipeline shows validation failures with empty config**: Expected. Fill required fields in `toolkit.config.json` first.

**"Required field X is empty"**: The 9 required fields are: `project.name`, `tech_stack.runtime`, `tech_stack.package_manager`, `tech_stack.source_dir`, `commands.dev`, `commands.build`, `commands.test`, `commands.lint`, `commands.install`.

**Hookify rules still disabled after setup**: Rules with remaining placeholder tokens in their frontmatter pattern are left disabled. Check the setup output for `[warn]` messages and fill missing tokens.

**`settings.local.json` not generated**: Set `commands.formatter` in config to your format command (e.g., `npx biome check --write`).

**Files not pruned in dry run**: Dry run shows what would be deleted but doesn't delete. Run with `--apply` to execute.

---

*Toolkit v2.0.0 | Last updated: 2026-02-16*
