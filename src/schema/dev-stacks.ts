import { z } from "zod";

/**
 * Zod schema for `data/dev-stacks.json` entries.
 *
 * All enum values are exhaustive — derived from the actual dataset.
 * This schema is the single source of truth for structural validation.
 */

export const devStackRouteSchema = z
  .enum([
    "base",
    "framework:nextjs",
    "framework:astro",
    "platform:tauri",
    "platform:capacitor",
    "backend:supabase",
    "backend:standalone",
    "runtime:bun",
    "runtime:node",
  ])
  .describe("Routing context that determines when this tool is included");

export const devStackSectionSchema = z
  .enum(["Application & Data", "DevOps", "Developer Tools", "Documentation Templates", "Utilities"])
  .describe("StackShare-style section grouping");

export const devStackCategorySchema = z
  .enum(["platform-feature", "template", "tool"])
  .describe("Entry classification: platform-feature, template, or tool");

export const devStackLayerSchema = z
  .enum(["devtime", "infra", "runtime", "template"])
  .describe("Architectural layer: devtime, infra, runtime, or template");

export const devStackMaturitySchema = z
  .enum(["beta", "stable"])
  .describe("beta=experimental (requires agentNotes), stable=production-ready");

export const devStackConditionSchema = z
  .enum([
    "always",
    "optional",
    "has_analytics",
    "has_api",
    "has_auth",
    "has_ci",
    "has_cms",
    "has_database",
    "has_dependabot",
    "has_docs",
    "has_e2e_tests",
    "has_email",
    "has_file_uploads",
    "has_frontend",
    "has_integration_tests",
    "has_payments",
    "has_realtime",
    "platform_default:ContentSite",
    "platform_default:DesktopApp",
    "platform_default:MobileApp",
    "platform_default:WebApp",
  ])
  .describe("Inclusion condition: always, optional, has_* feature flag, or platform_default:*");

export const devStackSelectionModeSchema = z
  .enum(["always-included", "auto-included", "selectable"])
  .describe("always-included=mandatory, auto-included=default-on, selectable=user-chosen");

export const devStackPrioritySchema = z
  .enum(["optional", "recommended", "required"])
  .describe("optional=nice-to-have, recommended=best-practice, required=mandatory");

export const devStackExclusionGroupSchema = z
  .enum([
    "auth",
    "database",
    "docs-framework",
    "i18n",
    "media-optimization",
    "package-manager",
    "realtime",
    "runtime",
    "sitemap",
    "storage",
    "test-runner",
    "vector",
  ])
  .describe("Mutually exclusive tool group — only one member selected per project context");

export const devStackBundleSchema = z
  .enum([
    "capacitor-core",
    "capacitor-extended",
    "observability",
    "storybook-suite",
    "supabase-suite",
    "tauri-core",
    "tauri-extended",
    "versioning",
  ])
  .describe("Named bundle grouping tools that are installed together");

export const devStackPlatformsSchema = z.object({
  contentSite: z.boolean(),
  desktopApp: z.boolean(),
  mobileApp: z.boolean(),
  tooling: z.boolean(),
  webApp: z.boolean(),
});

export const devStackEntrySchema = z.object({
  tool: z.string().min(1).max(100),
  purpose: z.string().min(1).max(1000),
  role: z.string().min(1).max(100),
  route: devStackRouteSchema,
  section: devStackSectionSchema,
  category: devStackCategorySchema,
  layer: devStackLayerSchema,
  maturity: devStackMaturitySchema,
  condition: devStackConditionSchema,
  platforms: devStackPlatformsSchema,
  url: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), { message: "URL must use HTTPS" })
    .nullable(),
  hasMcp: z.boolean(),
  relatedTo: z.array(z.string()),
  dependsOn: z.array(z.string()),
  selectionMode: devStackSelectionModeSchema,
  exclusionGroup: devStackExclusionGroupSchema.nullable(),
  bundle: devStackBundleSchema.nullable(),
  priority: devStackPrioritySchema,
  agentNotes: z.string().max(500).nullable(),
});

export const devStacksFileSchema = z.array(devStackEntrySchema);

export type DevStackRoute = z.infer<typeof devStackRouteSchema>;
export type DevStackSection = z.infer<typeof devStackSectionSchema>;
export type DevStackCategory = z.infer<typeof devStackCategorySchema>;
export type DevStackLayer = z.infer<typeof devStackLayerSchema>;
export type DevStackMaturity = z.infer<typeof devStackMaturitySchema>;
export type DevStackCondition = z.infer<typeof devStackConditionSchema>;
export type DevStackSelectionMode = z.infer<typeof devStackSelectionModeSchema>;
export type DevStackPriority = z.infer<typeof devStackPrioritySchema>;
export type DevStackExclusionGroup = z.infer<typeof devStackExclusionGroupSchema>;
export type DevStackBundle = z.infer<typeof devStackBundleSchema>;
export type DevStackPlatforms = z.infer<typeof devStackPlatformsSchema>;
export type DevStackEntry = z.infer<typeof devStackEntrySchema>;
