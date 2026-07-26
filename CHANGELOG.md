# Changelog

## 0.4.1 (2026-07-26)

### Fixed

* **toolkit:** correct test comment for manifest serialization accuracy
* **toolkit:** give the pwsh numbering tests a timeout that fits a cold PowerShell
* **toolkit:** recognize always() inside a YAML block-scalar condition

## 0.4.0 (2026-07-25)

### ⚠ BREAKING CHANGES

* **toolkit:** the tarball no longer ships .specify/ or the spec-kit skill bodies. Scaffolds fetch spec-kit from upstream at the pinned ref; existing projects run `outputease speckit refresh` once after upgrading.

### Added

* **toolkit:** add an optional advisory specKit field to the marker schema
* **toolkit:** add anchored overlay engine for spec-kit scripts
* **toolkit:** add applyOverlayToDir and verifyOverlay with fail-loud contract
* **toolkit:** add buildEnvExample stack-aware generator
* **toolkit:** add caveman plugin to agent-stacks dataset
* **toolkit:** add clientPrefix route-to-prefix helper
* **toolkit:** add ensureSpecKit and move the spec-kit toolchain to src/speckit
* **toolkit:** add nullable marketplace field to agent-stacks schema
* **toolkit:** add optional env field to dev-stacks entry schema
* **toolkit:** add outputease speckit init/refresh/verify
* **toolkit:** add SpecKitResult schema and carry it on PostInstallResult
* **toolkit:** add stripNotionServer template transform
* **toolkit:** inject stack-aware environment example, drop static stub
* **toolkit:** interactive optional-plugin picker at init
* **toolkit:** offer a spec-kit refresh at the end of outputease update
* **toolkit:** overlay rules R1/R2 for core spec-kit numbering scripts
* **toolkit:** overlay rules R3/R4 for the spec-kit git extension
* **toolkit:** pin the spec-kit upstream ref in src/speckit/pin.ts
* **toolkit:** pin the upstream spec-kit ref in src/speckit/pin.ts
* **toolkit:** populate env metadata on 9 core dev-stacks tools
* **toolkit:** rebuild the codex spec-kit skill surface from installed upstream
* **toolkit:** render selectable plugins as optional block in install script
* **toolkit:** report overlay and codex-bridge status in the scaffold summary
* **toolkit:** stop vendoring github/spec-kit in the published payload
* **toolkit:** validate marketplace against installCommand suffix

### Fixed

* **toolkit:** add an inline design fallback to develop-idea
* **toolkit:** add third-party notice for vendored github/spec-kit
* **toolkit:** answer T5's PTY prompts positionally so new prompts can't desync it
* **toolkit:** constrain marketplace to owner/repo slug, add review-followup tests
* **toolkit:** drop .specify from both outputease update scopes
* **toolkit:** drop dead-out-of-box github MCP server from scaffold default
* **toolkit:** emit speckit-archive only when spec-kit is chosen
* **toolkit:** exempt git-ignored untracked files from the extra-file tripwire
* **toolkit:** first-run follow-ups — accurate env/MCP onboarding docs
* **toolkit:** gate shipped INDEX spec-kit routes on outputease speckit init
* **toolkit:** handle install failure in first-run skill (no false "done")
* **toolkit:** hedge every superpowers reference on installation
* **toolkit:** honor a threaded leaf in runInit
* **toolkit:** keep third-party caveman skills out of the published payload
* **toolkit:** make quickstart's develop-idea delegation conditional
* **toolkit:** make shipped workflow docs conditional on spec-kit install
* **toolkit:** make superpowers a selectable, recommended plugin
* **toolkit:** point LICENSE and both READMEs at THIRD-PARTY-NOTICES.md
* **toolkit:** reconcile library env-example test and design doc with always-included Sentry
* **toolkit:** rename resume skill to continue, avoiding native /resume clash
* **toolkit:** retire orphaned THIRD-PARTY-NOTICES.md
* **toolkit:** ship THIRD-PARTY-NOTICES.md in the npm tarball
* **toolkit:** ship THIRD-PARTY-NOTICES.md in the public mirror tree
* **toolkit:** stop pinning superpowers skill IDs in the codex fitness audit
* **toolkit:** strip notion MCP server from the published payload
* **toolkit:** sync capture skill + INDEX from updated root assets
* **toolkit:** sync templates from updated root assets
* **toolkit:** thread the interactive leaf into runInit
* **toolkit:** wire source-staleness hooks into the scaffold settings eta

### Changed

* **toolkit:** delegate post-install spec-kit setup to ensureSpecKit
* **toolkit:** lift maybeRegenerate into src/agents/regenerate.ts
* **toolkit:** rename per-file overlay schema to OverlayOutcomeRecord

## 0.3.5 (2026-07-12)

### Fixed

* **toolkit:** harden codex superpowers fallback
* **toolkit:** treat .last-reads ledger as ephemeral (gitignore + template-exclude + drift-check)

## 0.3.4 (2026-07-08)

### Added

* **toolkit:** add first-run discovery block to scaffold CLAUDE.md
* **toolkit:** add guided first-run onboarding skill
* **toolkit:** gitignore the first-run marker in scaffolds
* **toolkit:** nudge first-run setup in post-scaffold summary

### Fixed

* **toolkit:** qualify /quickstart reference in first-run block for non-Claude targets
* **toolkit:** target-neutral first-run hand-off copy + stricter desc test

## 0.3.3 (2026-07-07)

### Added

* **toolkit:** add codex workflow guide
* **toolkit:** add detectInstallMethod for the upgrade command
* **toolkit:** add stalenessNudge for outputease update
* **toolkit:** add upgradeAction self-update command logic
* **toolkit:** define agent workflow contract
* **toolkit:** emit codex spec-kit adapters
* **toolkit:** recognize target-native agent workflows
* **toolkit:** register outputease upgrade command
* **toolkit:** register safe hooks in scaffolded settings.json
* **toolkit:** share lifecycle instructions across agents
* **toolkit:** warn on outputease update when the CLI binary is behind latest

### Fixed

* **toolkit:** align codex workflow contract with checklist
* **toolkit:** dedupe codex fidelity adapter rows
* **toolkit:** drop internal spec ref from generated fidelity report
* **toolkit:** enforce codex primary workflow parity
* **toolkit:** gate codex target-native fidelity on adapters
* **toolkit:** gate Windows-launcher remediation line on win32
* **toolkit:** keep codex workflow warnings non-required
* **toolkit:** preserve codex spec-kit adapters in scaffolds
* **toolkit:** promote codex adapter-backed neutral workflows
* **toolkit:** repair broken scaffold templates
* **toolkit:** repair dangling references to excluded assets
* **toolkit:** require codex guide for neutral target-native fidelity
* **toolkit:** stop shipping OutputEase-internal identifiers to scaffolds

### Changed

* **toolkit:** extract fetchLatestVersion metadata fetch from fetchTarball
* **toolkit:** lift compareSemver into shared src/version/compare
* **toolkit:** share clonedEnvSinglePath env helper across scaffold + upgrade

## 0.3.2 (2026-07-04)

### Fixed

* **toolkit:** make renderSummary env-injectable for deterministic tests

## 0.3.1 (2026-07-03)

### Added

* **toolkit:** .agents-aware outputease update (refresh source + regen) (008 T058/T059)
* **toolkit:** add gitignore-sync and migration-branch guard hooks
* **toolkit:** agent-agnostic generation engine + migration (008 US1)
* **toolkit:** deepen /security-review with surface-pass fan-out and scanner probing
* **toolkit:** drift guards for the neutral-source model (008 US3)
* **toolkit:** expand checkpoint/session-end/maintenance hygiene steps
* **toolkit:** fidelity report for multi-agent translation (008 US2)
* **toolkit:** fold Claude scaffold into neutral generator + init --agents (008 T056-T057)
* **toolkit:** IDE-bucket emitters + user-global apply (008 US4 engine)
* **toolkit:** make /security-review, /dev-check, /release-recover model-invocable
* **toolkit:** MULTI_AGENT_UPDATE_SCOPE for .agents-aware update (008 T059)
* **toolkit:** session-doc hygiene CI checks + one-time HANDOFF/TODO prune
* **toolkit:** tarball fold-input guard + spec-kit primary integration (008 T060-T061)
* **toolkit:** upgrade spec-kit to v0.12.3

### Fixed

* **toolkit:** agents check/generate default to manifest targets, not phase (008 T063)
* **toolkit:** exclude hygiene skill from templates; strip its routing tails
* **toolkit:** guard outputease update against multi-agent projects (008)
* **toolkit:** keep shipped templates free of OE-internal agent references
* **toolkit:** make npm-only installs work — Node launcher bins bootstrap Bun
* **toolkit:** prompt for project name on TTY when preset given without one
* **toolkit:** repair windows-e2e T4/T5 harness defects masking real results
* **toolkit:** restore spec-kit intro line dropped in scaffolded CLAUDE.md
* **toolkit:** scaffolded CLAUDE.md carries process-skill routing (payload coherence)
* **toolkit:** self-guard validate:docs skill steps outside the monorepo
* **toolkit:** strip PSModulePath when spawning PowerShell 5.1 for uv install
* **toolkit:** sync templates from updated root assets
* **toolkit:** sync templates from updated root assets
* **toolkit:** sync templates from updated root assets
* **toolkit:** update exits non-zero when .agents regeneration fails (008)

### Changed

* **toolkit:** factor materializeToolkitSource from the scaffold fold (008)

## 0.3.0 (2026-06-23)

### ⚠ BREAKING CHANGES

* **toolkit:** the package barrel no longer re-exports the legacy mutating pipeline. Removed public exports: runFileOperations, pruneFiles, FILE_MANIFEST, processOrRemove, OR_REMOVE_FLAGS, replaceTokens. These were orphaned when the 0.2.0 Eta scaffolder replaced the 6-phase pipeline; they were called by nothing, had no tests, and re-implemented logic the live scaffolder already owns (file-pruner's INDEX-row cleaner even carried a latent basename-substring over-match bug).

### Added

* **toolkit:** add scaffold preflight checks for native project types
* **toolkit:** remove orphaned 0.2.0 pipeline, narrow barrel, de-duplicate audit/loader code
* **web:** add Notion PM status sync (007) + work-pm-status type
* **web:** wire Sentry, middleware, admin scripts, consent API (T091-T098)

### Fixed

* **toolkit:** add not-found.tsx to web-app/next scaffold (Next 15 prerender)
* **toolkit:** align dataset SDK categorization and MCP version tags
* **toolkit:** bump scaffold automation dep to ^0.2.1 (was stale ^0.0.1)
* **toolkit:** bump scaffold to Next 16 + complete App Router error story
* **toolkit:** correct validator false-positives and wire tree+preset validation into CI
* **toolkit:** derive Windows system paths from env instead of hardcoding C:
* **toolkit:** exclude scheduled_tasks.lock from template sync
* **toolkit:** honor --pm= form, run nameless presets non-interactively, unify name validation
* **toolkit:** prevent scaffold/update data loss on overwrite + interrupt
* **toolkit:** surface uv install diagnostics; honor execution policy and known PATH
* **toolkit:** verify update tarball integrity and reject symlinked staged entries
* **toolkit:** windows-e2e scenarios run under PS 5.1 via GetNewClosure

### Changed

* **toolkit:** exclude OE-internal payload + generalize scaffold scope (Wave B)

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

* **toolkit:** add agent-stacks dataset and rename CLI to `outputease`
* **toolkit:** add curl-pipe-sh installer + e2e smoke gated by env
* **toolkit:** add setup skill for post-scaffolding automation
* **toolkit:** add setup wrapper scripts and update dataset URLs
* **toolkit:** add static template files and staleness-audit skill
* **toolkit:** CLI scaffolding — full implementation (T001-T064)

### Fixed

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

## 0.0.2 (2026-04-22)

### Added

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
