---
description: Scaffold a new app in the monorepo using the OutputEase toolkit
arguments:
  - name: app-name
    description: Name of the app (e.g., "web", "docs", "admin")
    required: true
---

Scaffold a new app at `apps/$ARGUMENTS.app-name` using the toolkit CLI, then apply OutputEase-specific overlays.

## Step 1: Gather project choices via AskUserQuestion

Use AskUserQuestion to walk the user through the toolkit decision tree:

**Q1 — Project type:**
- Web App (preset: `web-app`)
- Content Site (preset: `content-site`)
- Mobile App (preset: `mobile-app`)
- Desktop App (preset: `desktop-app`)

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
bunx outputease init $ARGUMENTS.app-name --preset <preset> --scope workspace-app --pm bun --no-claude [--runtime <rt>] [--backend <backend>]
```

This scaffolds `apps/$ARGUMENTS.app-name/` with base files (package.json, tsconfig.json, framework files, README.md) but without biome.json or .gitignore (inherited from workspace root).

## Step 3: Apply OutputEase overlays

Patch the toolkit-generated files with repo-specific conventions:

1. **Patch `apps/$ARGUMENTS.app-name/package.json`**:
   - Set `name` to `@outputease/$ARGUMENTS.app-name`
   - Set `version` to `0.0.1`
   - Set `private` to `true`
   - Remove `@biomejs/biome` from devDependencies (inherited from root)
   - Add `@outputease/config-typescript: workspace:*` to devDependencies

2. **If web/UI framework** (Web App, Content Site, Mobile App, Desktop App):
   - Add workspace dependencies:
     ```json
     "@outputease/ui": "workspace:*",
     "@outputease/brand": "workspace:*",
     "@outputease/env": "workspace:*",
     "@outputease/types": "workspace:*"
     ```
   - Replace `tsconfig.json` to extend `@outputease/config-typescript/nextjs.json` (for Next.js) or the appropriate config preset
   - Replace the CSS entry point (e.g., `app/globals.css` or equivalent) with:
     ```css
     @import "@outputease/config-tailwind";
     ```
   - Create `components.json` for shadcn/ui with aliases pointing to `@outputease/ui`
   - Create `src/env.ts` extending `@outputease/env/server` and `@outputease/env/client`

## Step 4: Monorepo registration

1. Add `$ARGUMENTS.app-name` to `commitlint.config.ts` `PACKAGE_SCOPES` array
2. Add entry to `release-please-config.json` under `packages`:
   ```json
   "apps/$ARGUMENTS.app-name": {
     "component": "$ARGUMENTS.app-name",
     "release-type": "node",
     "bump-minor-pre-major": true
   }
   ```
3. Add entry to `.release-please-manifest.json`:
   ```json
   "apps/$ARGUMENTS.app-name": "0.0.1"
   ```
4. Create `apps/$ARGUMENTS.app-name/CHANGELOG.md` with a Keep a Changelog header

## Step 5: Install and verify

```bash
bun install
bunx tsc --noEmit -p apps/$ARGUMENTS.app-name/tsconfig.json
```
