import { compareSemver } from "../version/compare";

/**
 * Warn text for `outputease update` when the running binary is STRICTLY behind
 * the latest published version. Returns null when equal or ahead — inside the
 * monorepo the source `pkg.version` can exceed npm's `@latest`, and a false
 * "you're behind" every run would be noise.
 */
export function stalenessNudge(installed: string, latest: string): string | null {
  if (compareSemver(installed, latest) >= 0) return null;
  return `CLI ${installed} is behind latest ${latest} — run \`outputease upgrade\` to update the binary (this command only refreshed project files).`;
}
