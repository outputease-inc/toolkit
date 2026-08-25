import * as p from "@clack/prompts";
import pc from "picocolors";
import type { PostInstallResult } from "../schema/scaffold";
import { ensureSpecKit, installUv, isUvAvailable } from "../speckit/install";

// Re-exported for the three pre-existing importers (scaffold/summary.ts:3,
// cli/commands/init/action.ts:5, scaffold/post-install.test.ts:2-7). The uv / git /
// spec-kit toolchain now lives in src/speckit/install.ts so `outputease speckit`
// can bootstrap it standalone without an import cycle through this module.
// `isUvAvailable` is BOTH imported (local binding for runPostInstall) and
// re-exported (for action.ts + post-install.test.ts). That pair is legal ESM and
// legal TS - `export ... from` introduces no local binding, so there is no
// duplicate-identifier conflict. Verified with tsc --noEmit during review.
export {
  detectScriptType,
  isSpecifyAvailable,
  isUvAvailable,
  windowsPowerShellEnv,
} from "../speckit/install";

export interface PostInstallOptions {
  targetDir: string;
  projectName: string;
  uv: boolean;
  specKit: boolean;
  dryRun: boolean;
  /**
   * spec-kit `--integration` value (spec 008, T061 / [C5]). Defaults to `claude`
   * (the pre-feature behavior). For a multi-agent scaffold the caller passes the
   * primary selected agent so spec-kit installs its commands for that harness.
   */
  specKitIntegration?: string;
}

/**
 * Injection seam for tests. Production always uses the real implementations; overriding
 * them lets the delegation be verified without a network round-trip, without a real uv on
 * the box, and without mutating the developer's global `specify-cli`.
 */
export interface PostInstallDeps {
  ensureSpecKit?: typeof ensureSpecKit;
  isUvAvailable?: typeof isUvAvailable;
}

/**
 * Run post-scaffold installation steps:
 * 1. Check/install uv
 * 2. Install spec-kit via uv
 * 3. Run specify init
 */
export async function runPostInstall(
  options: PostInstallOptions,
  deps: PostInstallDeps = {},
): Promise<PostInstallResult> {
  const result: PostInstallResult = {
    uvInstalled: false,
    specKitInstalled: false,
    specifyInitRan: false,
    errors: [],
  };

  if (options.dryRun) {
    p.log.info(pc.dim("  Would install uv + spec-kit and run specify init"));
    return result;
  }

  if (!options.uv && !options.specKit) return result;

  // Step 1: Ensure uv is available
  if (options.uv) {
    const spinner = p.spinner();
    spinner.start("Checking for uv...");

    if ((deps.isUvAvailable ?? isUvAvailable)()) {
      spinner.stop("uv found");
      result.uvInstalled = true;
    } else {
      spinner.message("Installing uv...");
      try {
        const uvResult = installUv();
        if (uvResult.ok) {
          spinner.stop("uv installed");
          result.uvInstalled = true;
        } else {
          spinner.stop(pc.yellow("uv installation failed — skipping spec-kit"));
          result.errors.push(`uv install failed: ${uvResult.stderr}`);
          return result;
        }
      } catch (err) {
        spinner.stop(pc.yellow("uv installation failed — skipping spec-kit"));
        result.errors.push(`uv install error: ${err instanceof Error ? err.message : String(err)}`);
        return result;
      }
    }
  }

  // Steps 2+3: install spec-kit at the pinned ref, run `specify init`, apply the
  // archive-aware numbering overlay, re-bridge codex, regenerate agent configs.
  // All of it lives in ensureSpecKit so `outputease speckit init` gets the identical
  // flow standalone (spec 2026-07-24 5.7).
  //
  // The `result.uvInstalled` gate is DELIBERATE, not vestigial: `--no-uv` is documented
  // as "also skips spec-kit" (cli/index.ts). ensureSpecKit self-bootstraps uv for the
  // STANDALONE `outputease speckit` path only; on the scaffold path the user's uv opt-out
  // is authoritative. At this point `result.uvInstalled` is exactly `options.uv` — step 1
  // returns early on every failure — so this is a pure no-op guard, not a second check.
  if (options.specKit && result.uvInstalled) {
    const ensureImpl = deps.ensureSpecKit ?? ensureSpecKit;
    const spinner = p.spinner();
    spinner.start("Setting up spec-kit...");

    try {
      const specKit = await ensureImpl({
        targetDir: options.targetDir,
        integration: options.specKitIntegration ?? "claude",
        mode: "init",
      });
      result.specKit = specKit;
      result.specKitInstalled = specKit.installed;
      result.specifyInitRan = specKit.initialized;
      result.errors.push(...specKit.errors);
      if (specKit.initialized && specKit.errors.length === 0) {
        spinner.stop("spec-kit initialized");
      } else if (specKit.initialized) {
        spinner.stop(pc.yellow("spec-kit initialized with warnings"));
      } else {
        spinner.stop(pc.yellow("spec-kit setup failed — .specify/ may need manual setup"));
      }
    } catch (err) {
      spinner.stop(pc.yellow("spec-kit setup failed"));
      result.errors.push(
        `spec-kit setup error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}
