import { z } from "zod";
import { devStackExclusionGroupSchema, devStackRouteSchema } from "../schema/dev-stacks";
import { frameworkConfigSchema } from "../schema/scaffold";

/**
 * Zod schemas for decision tree entities.
 * See: specs/001-toolkit-cli-scaffolding/data-model.md
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

// --- DecisionTreeLeaf ---

export const decisionTreeLeafSchema = z.object({
  id: z.string().min(1),
  route: devStackRouteSchema,
  platformKey: z.enum(["webApp", "contentSite", "mobileApp", "desktopApp", "tooling"]),
  exclusionChoices: z.partialRecord(devStackExclusionGroupSchema, z.string()),
  featureFlags: z.record(z.string(), z.boolean()).optional(),
  frameworkConfig: frameworkConfigSchema,
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
