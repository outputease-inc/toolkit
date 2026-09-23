/**
 * Detect how the running `outputease` binary was installed, from its own
 * module path. Only a confident bun-global install is reported; every other
 * shape (npm/pnpm/yarn globals, local links, unknown) returns null so the
 * caller prints candidate commands instead of running a guessed one.
 *
 * bun installs globals under `~/.bun/install/global/node_modules/...`, so the
 * running module path contains `/.bun/install/global/` once separators are
 * normalized. Verified on Windows: the package resolves under
 * `~/.bun/install/global/node_modules/@outputease/toolkit/`.
 */
export function detectInstallMethod(runningPath: string): "bun" | null {
  const normalized = runningPath.replace(/\\/g, "/");
  if (normalized.includes("/.bun/install/global/")) return "bun";
  return null;
}
