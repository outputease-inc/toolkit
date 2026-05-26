# Changelog

## 0.2.4 (2026-05-26)


### Fixed

* **install:** auto-derive toolkit release date from CHANGELOG

## 0.2.3 (2026-05-22)


### Added

* **toolkit:** Windows E2E harness + --preset skip platform tree


### Fixed

* **toolkit:** drop unused biome suppressions; type leaf var explicitly

## 0.2.2 (2026-05-21)


### Added

* **install:** rebuild landing page from claude design bundle
* **release:** public-mirror infra for @outputease/toolkit


### Fixed

* **install:** apply biome format fixes and sync templates
* **toolkit:** biome format on post-install.ts
* **toolkit:** restore monorepo repository.url for npm provenance


### Changed

* **toolkit:** split monolithic init.ts into command + shared modules

## 0.2.1 (2026-05-18)


### Added

* **ccib2026:** CCIB 2026 content development — prompts, wizards, resources
* **ccib2026:** demo pipeline — scenario selection, orchestrator, and summary
* **repo:** add dev-stacks validator, audit remediation, and Claude automation
* **repo:** DOMPurify sanitization + strict env + turnstile hardening
* **repo:** integrate SOP infrastructure and create toolkit package
* **repo:** migrate root docs to eta templates, add Fellix font
* **repo:** split idea backlog into Direct vs Spec ready paths
* **toolkit:** add agent-stacks dataset and rename CLI to `outputease`
* **toolkit:** add curl-pipe-sh installer + e2e smoke gated by env
* **toolkit:** add setup skill for post-scaffolding automation
* **toolkit:** add setup wrapper scripts and update dataset URLs
* **toolkit:** add static template files and staleness-audit skill
* **toolkit:** CLI scaffolding — full implementation (T001-T064)


### Fixed

* **repo:** P1 a11y and P2 hygiene cleanup
* **repo:** P1 security hardening
* **repo:** whitelist toolkit template .local.md files in .gitignore
* **toolkit:** extract via system tar — npm tar v7 drops files under Bun-Windows
* **toolkit:** move toolkit.config.json into templates/root/ for scaffolding
* **toolkit:** pin bun and node type defs for CI isolated linker


### Changed

* **toolkit:** switch update fetch to npm registry; add sourcePrefix

## 0.2.0 (2026-05-18)


### Added

* **toolkit:** first npm publish — distributed as `@outputease/toolkit` on the public npm registry. Install via `bunx @outputease/toolkit init`, `bun add -g @outputease/toolkit`, or `curl -fsSL https://toolkit.outputease.com/install.sh | sh`
* **toolkit:** `outputease update` command — non-destructive, atomic refresh of `.claude/`, `.specify/`, and toolkit-owned root configs; fetches `@latest` tarball from the npm registry (two-step: metadata then tarball); interactive conflict prompts (overwrite/skip/view-diff/apply-all/skip-all); non-TTY skips by default; exit codes per contract (0/1/2/3/4/5)
* **toolkit:** `.outputease` marker file written at scaffold time — Zod-strict schema with toolkitVersion, scaffoldedAt, projectType, scaffoldSeed
* **toolkit:** `.ignore` template (Claude Code ignore file) + `.env.local` template in scaffolded projects
* **toolkit:** brand truecolor CLI rendering — 24-bit ANSI escapes for OutputEase brand hex values with `NO_COLOR` graceful fallback


### Changed

* **toolkit:** Claude Code templates synced from live monorepo — full 17-skill / 11-command / 7-hook surface plus `.specify/` extensions tree, replacing the older curated subset; scaffolded projects now get the same Claude experience as the OE dev workflow
* **toolkit:** preset ids renamed `saas*` → `web-app*`; user-facing "SaaS" terminology replaced with "Web App"
* **toolkit:** `templates/claude/` renamed to `templates/.claude/`; npm tarball ships `templates/.claude/`, `templates/.specify/`, `templates/.mcp.json` at the target update paths. `UPDATE_SCOPE.sourcePrefix` maps tarball layout to project layout


### Removed

* **toolkit:** deprecated `runPipeline` export — replaced by the Eta-based scaffolder in `src/cli/init.ts` which fills CLI-resolvable placeholders at scaffold time. The 6-phase pipeline (LOAD/PRUNE/REMOVE/REPLACE/OPERATE/VALIDATE) is no longer needed post-scaffold

## 0.0.3 (2026-05-14)


### Added

* **repo:** migrate root docs to eta templates, add Fellix font
* **repo:** split idea backlog into Direct vs Spec ready paths


### Fixed

* **repo:** P1 a11y and P2 hygiene cleanup
* **repo:** P1 security hardening

## 0.0.2 (2026-04-22)


### Added

* **ccib2026:** CCIB 2026 content development — prompts, wizards, resources
* **ccib2026:** demo pipeline — scenario selection, orchestrator, and summary
* **repo:** add dev-stacks validator, audit remediation, and Claude automation
* **repo:** DOMPurify sanitization + strict env + turnstile hardening
* **repo:** integrate SOP infrastructure and create toolkit package
* **toolkit:** add agent-stacks dataset and rename CLI to `outputease`
* **toolkit:** add setup skill for post-scaffolding automation
* **toolkit:** add setup wrapper scripts and update dataset URLs
* **toolkit:** add static template files and staleness-audit skill
* **toolkit:** CLI scaffolding — full implementation (T001-T064)


### Fixed

* **toolkit:** move toolkit.config.json into templates/root/ for scaffolding
* **toolkit:** pin bun and node type defs for CI isolated linker

## Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
