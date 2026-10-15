/**
 * Single source of truth for the upstream spec-kit ref the toolkit installs,
 * initialises from, and writes overlay anchors against.
 *
 * Bumping this is a deliberate act, never incidental: the
 * `__fixtures__/<ref>/` corpus and every anchor in `overlay.ts` must be
 * regenerated and re-verified against the new ref in the same commit.
 * `overlay.test.ts` fails loudly if they are not.
 *
 * Used as `git+https://github.com/github/spec-kit.git@${SPECKIT_REF}`.
 *
 * Empirically verified (uv 0.11.32, Linux, 2026-07-24): installing unpinned HEAD
 * (`specify-cli==0.14.2.dev0`) into a scratch `UV_TOOL_DIR`, then running
 * `uv tool install specify-cli --force --from git+…@v0.12.3` over it, reinstalls
 * at the pin — `specify --version` reports `0.12.3`, exit 0. `--force` does NOT
 * no-op over a newer pre-existing tool. Re-verify when bumping SPECKIT_REF or uv.
 */
export const SPECKIT_REF = "v0.12.3";

/**
 * `SPECKIT_REF` without the leading `v` — the form spec-kit itself records in
 * `.specify/integration.json` and `.specify/init-options.json`.
 */
export const SPECKIT_VERSION = SPECKIT_REF.slice(1);

export const SPECKIT_GIT_URL = "https://github.com/github/spec-kit.git";

/** `--from` requirement string for `uv tool install`, pinned to `ref`. */
export function specKitInstallSpec(ref: string = SPECKIT_REF): string {
  return `git+${SPECKIT_GIT_URL}@${ref}`;
}

/**
 * Full argv for the `uv` binary. Extracted from the spawn call so the pin and the
 * `--force` flag are unit-testable — `spawnSync` itself is not.
 */
export function specKitInstallArgs(ref: string = SPECKIT_REF): string[] {
  return ["tool", "install", "specify-cli", "--force", "--from", specKitInstallSpec(ref)];
}
