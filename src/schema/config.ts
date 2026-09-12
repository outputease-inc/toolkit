import { z } from "zod";

/**
 * Zod schemas for the toolkit configuration file.
 *
 * Defines the shape of `toolkit.config.json` which drives
 * the 6-phase setup pipeline (LOAD -> PRUNE -> REMOVE -> REPLACE -> OPERATE -> VALIDATE).
 */

export const platformTypeSchema = z.enum([
  "ContentSite",
  "DesktopApp",
  "MobileApp",
  "WebApp",
  "Tooling",
]);

export const projectSchema = z.object({
  name: z.string(),
  description: z.string(),
  status: z.string(),
  platform_type: platformTypeSchema,
  repo_url: z.string(),
  default_branch: z.string().default("main"),
  license_type: z.string(),
});

export const techStackSchema = z.object({
  runtime: z.string(),
  runtime_version: z.string(),
  package_manager: z.string(),
  package_manager_version: z.string(),
  framework: z.string(),
  language: z.string(),
  ext: z.string(),
  source_extensions: z.string(),
  frontend_extensions: z.string(),
  source_dir: z.string(),
  test_dir: z.string(),
  e2e_dir: z.string(),
  components_dir: z.string(),
  ui_primitives_dir: z.string(),
  shared_components_dir: z.string(),
  feature_components_dir: z.string(),
  lib_dir: z.string(),
  styles_dir: z.string(),
  public_dir: z.string(),
  pages_dir: z.string(),
  routes_dir: z.string(),
  types_dir: z.string(),
  build_cache_dir: z.string(),
  styling: z.string(),
  component_library: z.string(),
});

export const commandsSchema = z.object({
  dev: z.string(),
  build: z.string(),
  test: z.string(),
  lint: z.string(),
  install: z.string(),
  formatter: z.string(),
  security_scan: z.string(),
  audit: z.string(),
});

export const toolsSchema = z.object({
  test_runner: z.string(),
  linter: z.string(),
  formatter_name: z.string(),
  linter_formatter: z.string(),
  linter_config: z.string(),
  formatter_config: z.string(),
  build_lint_pattern: z.string(),
});

export const featuresSchema = z.object({
  has_frontend: z.boolean().default(true),
  has_auth: z.boolean().default(false),
  has_database: z.boolean().default(false),
  has_ci: z.boolean().default(false),
  has_e2e_tests: z.boolean().default(false),
  has_integration_tests: z.boolean().default(false),
  has_typecheck: z.boolean().default(false),
  has_dependabot: z.boolean().default(false),
  has_github_mcp: z.boolean().default(false),
  has_docs: z.boolean().default(false),
  has_email: z.boolean().default(false),
  has_payments: z.boolean().default(false),
  has_api: z.boolean().default(false),
  has_realtime: z.boolean().default(false),
  has_cms: z.boolean().default(false),
  has_analytics: z.boolean().default(false),
  has_file_uploads: z.boolean().default(false),
  package_runner: z.string().default("npx"),
});

export const optionalSchema = z.object({
  hosting_provider: z.string(),
  ci_platform: z.string(),
  database: z.string(),
  db_version: z.string(),
  auth_provider: z.string(),
  security_email: z.string(),
  dependabot_tool: z.string(),
  github_mcp_url: z.string(),
  framework_imports: z.string(),
  component_library_imports: z.string(),
  props_definition: z.string(),
  export_convention: z.string(),
});

export const toolkitConfigSchema = z.object({
  project: projectSchema,
  tech_stack: techStackSchema,
  commands: commandsSchema,
  tools: toolsSchema,
  features: featuresSchema,
  optional: optionalSchema,
});

export type PlatformType = z.infer<typeof platformTypeSchema>;
export type Project = z.infer<typeof projectSchema>;
export type TechStack = z.infer<typeof techStackSchema>;
export type Commands = z.infer<typeof commandsSchema>;
export type Tools = z.infer<typeof toolsSchema>;
export type Features = z.infer<typeof featuresSchema>;
export type Optional = z.infer<typeof optionalSchema>;
export type ToolkitConfig = z.infer<typeof toolkitConfigSchema>;
