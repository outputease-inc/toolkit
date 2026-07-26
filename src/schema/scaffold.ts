import { z } from "zod";
import { type DevStackEntry, devStackRouteSchema } from "./dev-stacks";

/**
 * Zod schemas for scaffold entities.
 * See: archive/specs/001-toolkit-cli-scaffolding/data-model.md
 */

// --- FrameworkConfig ---

export const frameworkConfigSchema = z.object({
  framework: z.string().min(1),
  entryPoint: z.string().min(1),
  devCommand: z.string().min(1),
  buildCommand: z.string().min(1),
  directories: z.array(z.string()),
});

export type FrameworkConfig = z.infer<typeof frameworkConfigSchema>;

// --- PackageManagerConfig ---

export const packageManagerNameSchema = z.enum(["bun", "npm", "yarn", "pnpm"]);

export const packageManagerConfigSchema = z.object({
  name: packageManagerNameSchema,
  binary: z.string().min(1),
  run: z.string().min(1),
  exec: z.string().min(1),
  install: z.string().min(1),
  lockfile: z.string().min(1),
  packageManagerField: z.string().min(1),
});

export type PackageManagerName = z.infer<typeof packageManagerNameSchema>;
export type PackageManagerConfig = z.infer<typeof packageManagerConfigSchema>;

// --- ScaffoldScope ---

export const scaffoldScopeSchema = z.enum([
  "standalone",
  "workspace-app",
  "workspace-package",
  "monorepo",
]);

export type ScaffoldScope = z.infer<typeof scaffoldScopeSchema>;

/**
 * Maps internal 4-value scope to 3 user-facing UI choices.
 * "workspace-app" and "workspace-package" are both shown as
 * "Add to existing workspace" in the UI, differentiated by a follow-up prompt.
 */
export const UI_SCOPE_LABELS: Record<string, string> = {
  standalone: "Standalone app",
  workspace: "Add to existing workspace",
  monorepo: "Full Turborepo monorepo",
};

// --- ResolvedStack ---

export const resolvedStackSchema = z.object({
  leafId: z.string().min(1),
  route: devStackRouteSchema,
  additiveRoutes: z.array(devStackRouteSchema).optional(),
  platformKey: z.enum(["webApp", "contentSite", "mobileApp", "desktopApp", "tooling"]),
  tools: z.array(z.custom<DevStackEntry>()),
  dependencies: z.record(z.string(), z.string()),
  devDependencies: z.record(z.string(), z.string()),
  frameworkConfig: frameworkConfigSchema,
});

export type ResolvedStack = z.infer<typeof resolvedStackSchema>;

// --- ScaffoldContext ---

export const scaffoldContextSchema = z.object({
  projectName: z
    .string()
    .min(1)
    .max(214)
    .regex(/^[a-z0-9@][a-z0-9._\-/]*$/, "Must be a valid npm package name"),
  targetDir: z.string().min(1),
  scope: scaffoldScopeSchema,
  stack: resolvedStackSchema,
  packageManager: packageManagerConfigSchema,
  claudeCode: z.boolean(),
  specKit: z.boolean(),
  dryRun: z.boolean(),
});

export type ScaffoldContext = z.infer<typeof scaffoldContextSchema>;

// --- SpecKitResult ---

/**
 * Per-rule outcome of the post-fetch archive-aware-numbering overlay
 * (`src/speckit/overlay.ts`). `anchorMissing` and `verifyFailed` are the two
 * fail-loud shapes; `skipped` is the informational `required:false` + file-absent
 * case only.
 */
export const overlayOutcomeSchema = z.enum([
  "applied",
  "already",
  "skipped",
  "anchorMissing",
  "verifyFailed",
]);

export type OverlayOutcome = z.infer<typeof overlayOutcomeSchema>;

export const overlayOutcomeRecordSchema = z.object({
  /** Project-relative POSIX path of the patched file. */
  file: z.string(),
  outcome: overlayOutcomeSchema,
});

export type OverlayOutcomeRecord = z.infer<typeof overlayOutcomeRecordSchema>;

export const specKitResultSchema = z.object({
  mode: z.enum(["init", "refresh", "verify"]),
  /** The pinned upstream ref this run installed/verified against. */
  upstreamRef: z.string(),
  uvReady: z.boolean(),
  installed: z.boolean(),
  initialized: z.boolean(),
  overlay: z.array(overlayOutcomeRecordSchema),
  /** Skill names bridged into `.agents/targets/codex/skills/`. */
  bridgedSkills: z.array(z.string()),
  /** Agent config files regenerated, or null when regeneration did not run. */
  regenerated: z.number().int().nullable(),
  errors: z.array(z.string()),
});

export type SpecKitResult = z.infer<typeof specKitResultSchema>;

// --- PostInstallResult ---

export const postInstallResultSchema = z.object({
  uvInstalled: z.boolean(),
  specKitInstalled: z.boolean(),
  specifyInitRan: z.boolean(),
  errors: z.array(z.string()),
  /**
   * Detail from `ensureSpecKit`. Optional so a post-install that never reached the
   * spec-kit branch (uv declined, uv install failed) still parses.
   */
  specKit: specKitResultSchema.optional(),
});

export type PostInstallResult = z.infer<typeof postInstallResultSchema>;

// --- ScaffoldResult ---

export const scaffoldResultSchema = z.object({
  success: z.boolean(),
  projectName: z.string(),
  targetDir: z.string(),
  filesCreated: z.array(z.string()),
  filesModified: z.array(z.string()),
  dirsCreated: z.array(z.string()),
  stack: resolvedStackSchema,
  durationMs: z.number(),
  error: z.string().optional(),
  postInstall: postInstallResultSchema.optional(),
});

export type ScaffoldResult = z.infer<typeof scaffoldResultSchema>;

// --- RollbackEntry ---

export const rollbackEntrySchema = z.object({
  type: z.enum(["file-created", "dir-created", "file-modified"]),
  path: z.string().min(1),
  originalContent: z.string().optional(),
});

export type RollbackEntry = z.infer<typeof rollbackEntrySchema>;
