---
description: Scaffold a new shared package in the monorepo using the OutputEase toolkit
arguments:
  - name: package-name
    description: Name of the package (e.g., "auth", "analytics")
    required: true
---

Scaffold a new package at `packages/$ARGUMENTS.package-name` using the toolkit CLI, then apply OutputEase-specific overlays.

## Step 1: Gather project choices via AskUserQuestion

Use AskUserQuestion to determine what type of package to scaffold:

**Q1 — Package type:**
- Library (preset: `library`) — shared TypeScript package or utility library
- CLI Tool (preset: `cli-tool`) — command-line tool with Commander
- Web App (preset: `web-app`) — Next.js web application
- Content Site (preset: `content-site`) — Astro content site
- Mobile App (preset: `mobile-app`) — Capacitor mobile app
- Desktop App (preset: `desktop-app`) — Tauri desktop app

**Q2 — Runtime** (ask only for Web App, Content Site, or Desktop App):
- Bun (default — no flag needed)
- Node.js (flag: `--runtime node`)

**Q3 — Backend** (ask only for Web App, Mobile App, or Desktop App):
- None (default — no flag needed)
- Supabase (flag: `--backend supabase`)
- Standalone (flag: `--backend standalone`)

## Step 2: Run the toolkit CLI (non-interactive)

Build and run the command with the gathered flags:

```bash
bunx outputease init $ARGUMENTS.package-name --preset <preset> --scope workspace-package --pm bun --no-claude [--runtime <rt>] [--backend <backend>]
```

This scaffolds `packages/$ARGUMENTS.package-name/` with base files (package.json, tsconfig.json, source files, README.md) but without biome.json or .gitignore (inherited from workspace root).

## Step 3: Apply OutputEase overlays

Patch the toolkit-generated files with repo-specific conventions:

1. **Patch `packages/$ARGUMENTS.package-name/package.json`**:
   - Set `name` to `@outputease/$ARGUMENTS.package-name`
   - Set `version` to `0.0.1`
   - Set `private` to `true`
   - Remove `@biomejs/biome` from devDependencies (inherited from root)
   - Add `@outputease/config-typescript: workspace:*` to devDependencies

2. **Replace `packages/$ARGUMENTS.package-name/tsconfig.json`** to extend `@outputease/config-typescript/library.json`:
   ```json
   {
     "extends": "@outputease/config-typescript/library.json",
     "include": ["src"]
   }
   ```

3. **If UI framework** (Web App, Content Site, Mobile App, Desktop App):
   - Add workspace dependencies: `@outputease/ui: workspace:*`, `@outputease/brand: workspace:*`

## Step 4: Monorepo registration

1. Add `$ARGUMENTS.package-name` to `commitlint.config.ts` `PACKAGE_SCOPES` array
2. Add entry to `release-please-config.json` under `packages`:
   ```json
   "packages/$ARGUMENTS.package-name": {
     "component": "$ARGUMENTS.package-name",
     "release-type": "node",
     "bump-minor-pre-major": true
   }
   ```
3. Add entry to `.release-please-manifest.json`:
   ```json
   "packages/$ARGUMENTS.package-name": "0.0.1"
   ```
4. Create `packages/$ARGUMENTS.package-name/CHANGELOG.md` with a Keep a Changelog header

## Step 5: Install

```bash
bun install
```
