# Contributing to `@outputease/toolkit`

Thanks for your interest. A few things to know before you spend time here.

## This repo is a release-time mirror

`@outputease/toolkit` is developed in a private OutputEase monorepo. This
repository (`outputease-inc/toolkit`) is a snapshot, published automatically
after every npm release of `@outputease/toolkit`. It exists so the source is
publicly browseable, releases are tagged on GitHub, and the community has a
place to file issues.

**`main` is force-pushed on every release.** Each release replaces the entire
history with a single orphan commit (`Release vX.Y.Z`) authored by
`github-actions[bot]`. Branches you create off `main` may become detached
after the next release — the commit SHAs survive, but the branch ref moves.

## Filing issues

Open issues here. Please include:

- toolkit version (`outputease --version`)
- operating system + shell
- Node/Bun version
- minimal reproduction steps + expected vs. actual behavior

Security reports: please email `security@outputease.com` instead of filing
a public issue.

## Pull requests

PRs are welcome but applied indirectly. We cherry-pick accepted changes into
the canonical private monorepo. Your patch then appears in the next release
as part of that release's squashed orphan commit. We do our best to preserve
authorship in the cherry-picked commit on our side, but it does not appear
in this mirror's git history.

Before opening a PR:

1. Discuss non-trivial changes in an issue first. Saves both of us time.
2. Keep the change minimal and focused on one thing.
3. Match the existing code style (Biome handles formatting; no need to run
   it locally, but TypeScript types must check).
4. If your change touches `data/dev-stacks.json` or `data/agent-stacks.json`,
   run `bun run validate` locally to make sure the dataset still passes the
   cross-field rules.

## Building locally

```bash
git clone https://github.com/outputease-inc/toolkit
cd toolkit
bun install
bun run typecheck
bun test
```

The mirror is self-contained: no workspace dependencies, no scaffolding
scripts that require a parent monorepo. If something doesn't build out of
the box on a fresh clone, that's a bug — please file an issue.

## Tag scheme

Mirror tags use `vX.Y.Z` (matching the npm version). The canonical monorepo
uses `toolkit/X.Y.Z` internally; those tags do not appear here.

## Branch protection

`main` is intentionally unprotected so the release workflow can force-push.
Don't enable branch protection on the mirror — releases will start failing.

## License

MIT. See [LICENSE](./LICENSE).
