> **Public mirror.** Canonical development happens in a private monorepo.
> Releases are squash-snapshots; `main` is force-pushed each release.
> See [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR.

# @outputease/toolkit

Project scaffolding CLI with first-class AI-assisted development support.

## Install

Pick whichever flow fits your workflow:

```bash
# Zero-install — runs the latest published version
bunx @outputease/toolkit init

# Global install — gets you the `outputease` binary on PATH
bun add -g @outputease/toolkit
outputease init

# Curl-pipe-sh — bootstraps bun (if missing) and installs globally
curl -fsSL https://toolkit.outputease.com/install.sh | sh
outputease init
```

npm equivalents work too:

```bash
npx @outputease/toolkit init
npm install -g @outputease/toolkit
```

## Commands

```bash
outputease init [name]   # Scaffold a new project (interactive or via --preset)
outputease update        # Refresh tooling in an existing scaffolded project
```

`outputease init` walks you through project type, runtime, and backend choices
and emits a fully-configured project. Presets bypass prompts:

```bash
outputease init my-app --preset web-app
outputease init my-site --preset content-site
outputease init my-cli --preset cli-tool
```

`outputease update` reads the `.outputease` marker file at the project root,
fetches the latest toolkit tarball from the npm registry, and non-destructively
refreshes `.claude/`, `.specify/`, and toolkit-owned root configs. Locally-modified
files require explicit user choice (overwrite / skip / view diff).

## Programmatic API

```ts
import {
  validateDevStacks,
  validateAgentStacks,
  loadDevStacks,
  loadAgentStacks,
} from "@outputease/toolkit";
```

## License

MIT
