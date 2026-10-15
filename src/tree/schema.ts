import { z } from "zod";
import { devStackExclusionGroupSchema, devStackRouteSchema } from "../schema/dev-stacks";
import { frameworkConfigSchema } from "../schema/scaffold";

/**
 * Zod schemas for decision tree entities.
 * See: archive/specs/001-toolkit-cli-scaffolding/data-model.md
 */

// --- DecisionTreeOption ---

export const decisionTreeOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  hint: z.string().optional(),
  next: z.string().nullable(),
  disabled: z.boolean().optional(),
  disabledReason: z.string().optional(),
});

export type DecisionTreeOption = z.infer<typeof decisionTreeOptionSchema>;

// --- DecisionTreeNode ---

export const decisionTreeNodeSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  options: z.array(decisionTreeOptionSchema).min(2).max(8),
});

export type DecisionTreeNode = z.infer<typeof decisionTreeNodeSchema>;

// --- Prerequisite checks (per-leaf preflight) ---

/**
 * Discriminated union for prerequisite detection strategies.
 *
 * `binary` — spawn a command and require exit code 0
 * `node` — require Node.js available with optional minVersion semver gate
 * `bun` — require bun on PATH
 * `pnpm` — require pnpm on PATH
 */
export const prereqIdSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("binary"),
    cmd: z.string().min(1),
    args: z.array(z.string()).default([]),
  }),
  z.object({
    kind: z.literal("node"),
    minVersion: z.string().optional(),
  }),
  z.object({ kind: z.literal("bun") }),
  z.object({ kind: z.literal("pnpm") }),
]);

export type PrereqId = z.infer<typeof prereqIdSchema>;

export const prereqInstallHintSchema = z.object({
  url: z.string().url().optional(),
  command: z.string().optional(),
  os: z.array(z.enum(["win32", "darwin", "linux"])).optional(),
});

export type PrereqInstallHint = z.infer<typeof prereqInstallHintSchema>;

export const prereqCheckSchema = z.object({
  name: z.string().min(1),
  detect: prereqIdSchema,
  severity: z.enum(["required", "recommended"]),
  reason: z.string().optional(),
  installHint: prereqInstallHintSchema,
  /**
   * Restrict the check to specific host platforms. If omitted, the check runs
   * on every platform. Use this for Xcode (darwin-only) and similar cases.
   */
  appliesTo: z.array(z.enum(["win32", "darwin", "linux"])).optional(),
});

export type PrereqCheck = z.infer<typeof prereqCheckSchema>;

// --- DecisionTreeLeaf ---

export const decisionTreeLeafSchema = z.object({
  id: z.string().min(1),
  route: devStackRouteSchema,
  platformKey: z.enum(["webApp", "contentSite", "mobileApp", "desktopApp", "tooling"]),
  exclusionChoices: z.partialRecord(devStackExclusionGroupSchema, z.string()),
  featureFlags: z.record(z.string(), z.boolean()).optional(),
  frameworkConfig: frameworkConfigSchema,
  /**
   * Optional host-machine prerequisites for this leaf (e.g. Rust for Tauri,
   * Xcode for Capacitor iOS). Surfaced before scaffold writes via
   * `runPreflight` in scaffold/preflight.ts.
   */
  prerequisites: z.array(prereqCheckSchema).optional(),
});

export type DecisionTreeLeaf = z.infer<typeof decisionTreeLeafSchema>;

// --- AdditiveRouteConfig ---

export const additiveRouteConfigSchema = z.object({
  route: devStackRouteSchema,
  exclusionOverrides: z.partialRecord(devStackExclusionGroupSchema, z.string()),
});

export type AdditiveRouteConfig = z.infer<typeof additiveRouteConfigSchema>;

// --- Preset ---

export const presetSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  leafId: z.string().min(1),
  defaultName: z.string().min(1),
  additiveRoutes: z.array(additiveRouteConfigSchema).optional(),
});

export type Preset = z.infer<typeof presetSchema>;
