<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/logo-light.svg">
  <img alt="OutputEase" src="./assets/logo-dark.svg" width="360">
</picture>

### *Scaffold AI-ready projects in one command.*

**A batteries-included CLI for the project you'd otherwise spend two days configuring by hand.**
Strict TypeScript, Biome v2, Drizzle, shadcn/ui, a wired-up `.claude/` workspace, and the rest of the boilerplate, ready to ship.

<p>
  <a href="https://www.npmjs.com/package/@outputease/toolkit"><img alt="npm version" src="https://img.shields.io/npm/v/@outputease/toolkit?style=flat-square&color=A99BF9&logo=npm&logoColor=white&label=npm"></a>
  <a href="https://www.npmjs.com/package/@outputease/toolkit"><img alt="npm downloads" src="https://img.shields.io/npm/dm/@outputease/toolkit?style=flat-square&color=7FD8FF&logo=npm&logoColor=white&label=downloads"></a>
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-FDD468?style=flat-square"></a>
  <a href="https://bun.sh"><img alt="Built with Bun" src="https://img.shields.io/badge/built_with-Bun-F9B09D?style=flat-square&logo=bun&logoColor=white"></a>
</p>

<sub><em>Public mirror. Canonical development lives in a private monorepo, and releases ship here as squash-snapshots. See <a href="./CONTRIBUTING.md">CONTRIBUTING.md</a> before opening a PR.</em></sub>

</div>

---

## Quick start

```bash
bunx @outputease/toolkit init
```

That's it. Answer a handful of prompts, and the toolkit emits a fully-configured project with tests, lint, format, and an AI-assisted dev workflow already wired up.

<details>
<summary>Other install paths</summary>

```bash
# Global install
bun add -g @outputease/toolkit
outputease init

# Curl-pipe-sh (installs bun if missing, then the toolkit)
curl -fsSL https://toolkit.outputease.com/install.sh | sh
outputease init

# npm equivalents
npx @outputease/toolkit init
npm install -g @outputease/toolkit
```

</details>

## What you get

Every scaffold ships with:

- **Strict TypeScript.** ES2022 target, `noUncheckedIndexedAccess`, isolated modules, the works.
- **Biome v2.** Lint and format in one tool. No ESLint, no Prettier, no config sprawl.
- **A working AI-assisted dev loop.** `.claude/` skills, agents, and slash commands pre-wired for Claude Code. Optional integrations for Codex, Cursor, and Gemini.
- **Spec-Kit ready.** `.specify/` workflow templates for spec-driven development (`/speckit-specify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-implement`).
- **Tested defaults.** Bun test runner, sample tests that actually pass, CI hooks that actually run.
- **A `.outputease` marker.** Lets `outputease update` non-destructively refresh tooling on existing projects, so today's scaffold doesn't become tomorrow's bit-rot.

## Demo

```text
$ bunx @outputease/toolkit init

  ◆  Output Ease Toolkit [v0.2.2]

  ?  What are you building?  ›  Web App (Next.js)
  ?  Project name?           ›  my-app
  ?  Use Drizzle + Postgres?  ›  Yes
  ?  Add Claude Code wiring?  ›  Yes
  ?  Initialize git?          ›  Yes

  ✓  Scaffolding apps/my-app
  ✓  Wiring TypeScript, Biome, Tailwind v4
  ✓  Configuring Drizzle + Supabase env shape
  ✓  Installing .claude/ skills + agents
  ✓  bun install (12 packages, 1.4s)
  ✓  git init + initial commit

  Done in 8s.

  Next:
    cd my-app
    bun run dev
```

## Presets

Skip the prompts with `--preset`:

| Preset          | Stack                                        |
| --------------- | -------------------------------------------- |
| `web-app`       | Next.js 16, React 19, Tailwind v4, shadcn/ui |
| `content-site`  | Astro, MDX, Tailwind v4                      |
| `mobile-app`    | Capacitor + your choice of web framework     |
| `desktop-app`   | Tauri + Vite + React                         |
| `cli-tool`      | Bun, TypeScript, single-binary build         |
| `library`       | TypeScript library with tsup + bun:test      |

```bash
outputease init my-app --preset web-app
```

## Why this exists

### Senior on every engagement.

The toolkit encodes the choices a senior engineer would make if they were starting your project fresh. Strict typing, one formatter, one lint tool, one test runner, one package manager. Fewer arguments, better defaults.

### AI-first, fit-for-purpose.

AI assistance is built in from the first commit. `.claude/` is not bolted on later; it ships with skills, agents, and slash commands tuned for the stack you picked. The AI knows your conventions because the toolkit wrote them.

### No abstraction tax.

Every file in the scaffold is a file you would have written anyway. No proprietary runtime, no hidden config layer, no framework-on-a-framework. You can leave the toolkit behind at any time and the project keeps working.

## Commands

```bash
outputease init [name]   # Scaffold a new project (interactive or via --preset)
outputease update        # Refresh tooling in an existing scaffolded project
```

`outputease init` walks you through project type, runtime, and backend choices, then emits a fully-configured project.

`outputease update` reads the `.outputease` marker file at your project root, fetches the latest toolkit tarball from npm, and non-destructively refreshes `.claude/`, `.specify/`, and toolkit-owned root configs. Locally-modified files require explicit user choice (overwrite, skip, or view diff).

Full flag reference: `outputease --help`.

## Programmatic API

The toolkit also exports its dataset validators and loaders. Useful if you're building tooling on top of the dev-stacks or agent-stacks catalogs.

```ts
import {
  validateDevStacks,
  validateAgentStacks,
  loadDevStacks,
  loadAgentStacks,
} from "@outputease/toolkit";
```

Sub-path exports: `@outputease/toolkit/dev-stacks` and `@outputease/toolkit/agent-stacks` for direct data access.

## Contributing

PRs are welcome. Note the mirror's release model: canonical development happens in a private monorepo, accepted PRs are cherry-picked upstream, and they appear here as part of the next release's squashed commit. Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening one.

Security reports: `security@outputease.com`. See [SECURITY.md](./SECURITY.md).

## License

MIT. See [LICENSE](./LICENSE).

---

<div align="center">
  <sub>Built by <a href="https://outputease.com">OutputEase</a>. Advocates of Higher Achievement and Better Living.</sub>
</div>
