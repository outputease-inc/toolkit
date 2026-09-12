import { z } from "zod";
import {
  devStackMaturitySchema,
  devStackPrioritySchema,
  devStackSelectionModeSchema,
} from "./dev-stacks";

/**
 * Zod schema for `data/agent-stacks.json` entries.
 *
 * Parallels the dev-stacks schema but adds agent-specific fields
 * for Claude Code plugin/MCP server provisioning.
 * This schema is the single source of truth for structural validation.
 */

export const agentStackRouteSchema = z
  .enum(["base", "backend:supabase", "has_frontend", "has_analytics", "has_e2e_tests"])
  .describe("Routing context that determines when this agent tool is included");

export const agentStackSectionSchema = z
  .enum([
    "Core Workflow",
    "Quality & Review",
    "Development Tools",
    "Infrastructure",
    "Design",
    "Observability",
    "Setup",
  ])
  .describe("Section grouping matching PLUGINS-INDEX tier structure");

export const agentStackCategorySchema = z
  .enum(["plugin", "mcp-server"])
  .describe("Entry classification: Claude Code plugin or MCP server");

export const agentStackLayerSchema = z
  .enum(["agent"])
  .describe("Architectural layer: all agent-stack entries operate at the agent layer");

export const agentStackConditionSchema = z
  .enum([
    "always",
    "optional",
    "has_frontend",
    "has_database",
    "has_ci",
    "has_analytics",
    "has_e2e_tests",
    "backend:supabase",
  ])
  .describe("Inclusion condition for agent plugin provisioning");

export const agentStackTierSchema = z
  .enum(["1", "2", "3", "4", "5", "6", "7"])
  .describe("Installation priority tier (1=core, 7=optional setup)");

export const agentStackExclusionGroupSchema = z
  .enum(["code-review"])
  .describe("Mutually exclusive agent tool group — only one member selected per project context");

export const agentStackBundleSchema = z
  .enum(["core-workflow", "quality-review"])
  .describe("Named bundle grouping agent tools installed together");

export const agentStackComponentCountsSchema = z.object({
  commands: z.number().int().min(0),
  skills: z.number().int().min(0),
  agents: z.number().int().min(0),
  hooks: z.number().int().min(0),
});

export const agentStackMcpConfigSchema = z
  .object({
    type: z.enum(["stdio", "sse"]),
    command: z.string().min(1),
    args: z.array(z.string()),
    env: z.record(z.string(), z.string()).optional(),
  })
  .nullable();

export const agentStackPlatformsSchema = z.object({
  contentSite: z.boolean(),
  desktopApp: z.boolean(),
  mobileApp: z.boolean(),
  tooling: z.boolean(),
  webApp: z.boolean(),
});

export const agentStackEntrySchema = z.object({
  tool: z.string().min(1).max(100),
  purpose: z.string().min(1).max(1000),
  role: z.string().min(1).max(100),
  route: agentStackRouteSchema,
  section: agentStackSectionSchema,
  category: agentStackCategorySchema,
  layer: agentStackLayerSchema,
  maturity: devStackMaturitySchema,
  condition: agentStackConditionSchema,
  platforms: agentStackPlatformsSchema,
  url: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), { message: "URL must use HTTPS" })
    .nullable(),
  hasMcp: z.boolean(),
  relatedTo: z.array(z.string()),
  dependsOn: z.array(z.string()),
  selectionMode: devStackSelectionModeSchema,
  exclusionGroup: agentStackExclusionGroupSchema.nullable(),
  bundle: agentStackBundleSchema.nullable(),
  priority: devStackPrioritySchema,
  agentNotes: z.string().max(500).nullable(),
  tier: agentStackTierSchema,
  installCommand: z.string().min(1).max(300),
  marketplace: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "must be a GitHub owner/repo slug")
    .nullable()
    .describe(
      "GitHub owner/repo of a third-party plugin marketplace; null for claude-plugins-official",
    ),
  componentCounts: agentStackComponentCountsSchema,
  mcpConfig: agentStackMcpConfigSchema,
  requiresAuth: z.boolean(),
});

export const agentStacksFileSchema = z.array(agentStackEntrySchema);

export type AgentStackRoute = z.infer<typeof agentStackRouteSchema>;
export type AgentStackSection = z.infer<typeof agentStackSectionSchema>;
export type AgentStackCategory = z.infer<typeof agentStackCategorySchema>;
export type AgentStackLayer = z.infer<typeof agentStackLayerSchema>;
export type AgentStackCondition = z.infer<typeof agentStackConditionSchema>;
export type AgentStackTier = z.infer<typeof agentStackTierSchema>;
export type AgentStackExclusionGroup = z.infer<typeof agentStackExclusionGroupSchema>;
export type AgentStackBundle = z.infer<typeof agentStackBundleSchema>;
export type AgentStackComponentCounts = z.infer<typeof agentStackComponentCountsSchema>;
export type AgentStackMcpConfig = z.infer<typeof agentStackMcpConfigSchema>;
export type AgentStackPlatforms = z.infer<typeof agentStackPlatformsSchema>;
export type AgentStackEntry = z.infer<typeof agentStackEntrySchema>;
