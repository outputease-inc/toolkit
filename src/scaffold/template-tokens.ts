import type { FrameworkConfig, PackageManagerConfig, ScaffoldScope } from "../schema/scaffold";

/**
 * Derived template tokens for use in Eta templates.
 * Maps high-level scaffold inputs to common doc placeholders so that templates
 * can substitute CLI-resolvable values via `<%= it.x %>` instead of leaving
 * `[BRACKET]` placeholders for the user to fill manually.
 */
export interface DerivedTemplateTokens {
  installCommand: string;
  devCommand: string;
  buildCommand: string;
  testCommand: string;
  lintCommand: string;
  runtime: string;
  language: string;
  framework: string;
  toolkitVersion: string;
  date: string;
  releaseDate: string;
  defaultBranch: string;
  licenseType: string;
}

const FRAMEWORK_DISPLAY: Record<string, string> = {
  "next.js": "Next.js",
  astro: "Astro",
  capacitor: "Capacitor",
  tauri: "Tauri",
  "bun-cli": "Bun CLI",
  library: "TypeScript Library",
};

/**
 * Derive Eta template tokens from scaffold inputs.
 *
 * @param pm - resolved package manager config
 * @param frameworkConfig - resolved framework config (from decision tree leaf)
 * @param _scope - scaffold scope (reserved for future scope-specific token derivation)
 * @param toolkitVersion - version of @outputease/toolkit performing the scaffold
 */
export function deriveTemplateTokens(
  pm: PackageManagerConfig,
  frameworkConfig: FrameworkConfig,
  _scope: ScaffoldScope,
  toolkitVersion: string,
): DerivedTemplateTokens {
  const today = new Date().toISOString().slice(0, 10);
  const runtime = pm.name === "bun" ? "bun" : "node";

  return {
    installCommand: pm.install,
    devCommand: `${pm.run} dev`,
    buildCommand: `${pm.run} build`,
    testCommand: pm.name === "bun" ? "bun test" : `${pm.run} test`,
    lintCommand: `${pm.run} lint`,
    runtime,
    language: "TypeScript",
    framework: FRAMEWORK_DISPLAY[frameworkConfig.framework] ?? frameworkConfig.framework,
    toolkitVersion,
    date: today,
    releaseDate: today,
    defaultBranch: "main",
    licenseType: "MIT",
  };
}
