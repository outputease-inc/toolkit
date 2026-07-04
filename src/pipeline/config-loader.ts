/**
 * Config Loader -- Phase 1 of the setup pipeline.
 *
 * Parses toolkit.config.json, validates required fields,
 * maps config paths to [TOKEN_NAME] placeholders, computes derived values,
 * and returns a flat Map<string, string> for the replacement engine.
 */

import * as fs from "node:fs";
import { getNestedValue } from "./utils";

// ---- Types ------------------------------------------------------------------

/** The parsed toolkit config object. */
export interface ToolkitConfig {
  project: Record<string, string>;
  tech_stack: Record<string, string>;
  commands: Record<string, string>;
  features: Record<string, boolean | string>;
  tools: Record<string, string>;
  optional: Record<string, string>;
}

/** Result of loading and validating a config file. */
export interface LoadConfigResult {
  config: ToolkitConfig | null;
  tokenMap: Map<string, string>;
  errors: string[];
}

// ---- Direct Token Map -------------------------------------------------------
// Maps config dot-paths to placeholder token names.

export const TOKEN_MAP: Record<string, string> = {
  // project
  "project.name": "PROJECT_NAME",
  "project.description": "PROJECT_DESCRIPTION",
  "project.status": "PROJECT_STATUS",
  "project.platform_type": "PLATFORM_TYPE",
  "project.repo_url": "REPO_URL",
  "project.default_branch": "DEFAULT_BRANCH",
  "project.license_type": "LICENSE_TYPE",

  // tech_stack
  "tech_stack.runtime": "RUNTIME",
  "tech_stack.runtime_version": "RUNTIME_VERSION",
  "tech_stack.package_manager": "PACKAGE_MANAGER",
  "tech_stack.package_manager_version": "PACKAGE_MANAGER_VERSION",
  "tech_stack.framework": "FRAMEWORK",
  "tech_stack.language": "LANGUAGE",
  "tech_stack.ext": "EXT",
  "tech_stack.source_extensions": "SOURCE_EXTENSIONS",
  "tech_stack.frontend_extensions": "FRONTEND_EXTENSIONS",
  "tech_stack.source_dir": "SOURCE_DIR",
  "tech_stack.test_dir": "TEST_DIR",
  "tech_stack.e2e_dir": "E2E_DIR",
  "tech_stack.components_dir": "COMPONENTS_DIR",
  "tech_stack.ui_primitives_dir": "UI_PRIMITIVES_DIR",
  "tech_stack.shared_components_dir": "SHARED_COMPONENTS_DIR",
  "tech_stack.feature_components_dir": "FEATURE_COMPONENTS_DIR",
  "tech_stack.lib_dir": "LIB_DIR",
  "tech_stack.styles_dir": "STYLES_DIR",
  "tech_stack.public_dir": "PUBLIC_DIR",
  "tech_stack.pages_dir": "PAGES_DIR",
  "tech_stack.routes_dir": "ROUTES_DIR",
  "tech_stack.types_dir": "TYPES_DIR",
  "tech_stack.build_cache_dir": "BUILD_CACHE_DIR",
  "tech_stack.styling": "STYLING",
  "tech_stack.component_library": "COMPONENT_LIBRARY",

  // commands
  "commands.dev": "DEV_COMMAND",
  "commands.build": "BUILD_COMMAND",
  "commands.test": "TEST_COMMAND",
  "commands.lint": "LINT_COMMAND",
  "commands.install": "INSTALL_COMMAND",
  "commands.formatter": "FORMATTER_COMMAND",
  "commands.security_scan": "SECURITY_SCAN_COMMAND",
  "commands.audit": "AUDIT_COMMAND",

  // tools
  "tools.test_runner": "TEST_RUNNER",
  "tools.linter": "LINTER",
  "tools.formatter_name": "FORMATTER",
  "tools.linter_formatter": "LINTER_FORMATTER",
  "tools.linter_config": "LINTER_CONFIG",
  "tools.formatter_config": "FORMATTER_CONFIG",
  "tools.build_lint_pattern": "BUILD_LINT_PATTERN",

  // optional
  "optional.hosting_provider": "HOSTING_PROVIDER",
  "optional.ci_platform": "CI_PLATFORM",
  "optional.database": "DATABASE",
  "optional.db_version": "DB_VERSION",
  "optional.auth_provider": "AUTH_PROVIDER",
  "optional.security_email": "SECURITY_EMAIL",
  "optional.dependabot_tool": "DEPENDABOT_OR_RENOVATE_OR_REMOVE",
  "optional.framework_imports": "FRAMEWORK_IMPORTS",
  "optional.component_library_imports": "COMPONENT_LIBRARY_IMPORTS",
  "optional.props_definition": "PROPS_DEFINITION",
  "optional.export_convention": "EXPORT_CONVENTION",
};

// ---- Derived Values ---------------------------------------------------------
// Computed from other config values. Each is a function (config) => string.
// Returns empty string if inputs are missing (token stays unfilled).

export const DERIVED: Record<string, (c: ToolkitConfig) => string> = {
  TECH_STACK_SUMMARY: (c) =>
    [c.tech_stack.language, c.tech_stack.framework, c.tech_stack.package_manager]
      .filter(Boolean)
      .join(" / ") || "",
  TECH_STACK: (c) =>
    [
      c.tech_stack.language,
      c.tech_stack.framework,
      c.tech_stack.styling,
      c.tech_stack.component_library,
    ]
      .filter(Boolean)
      .join(", ") || "",
  PM_VERSION: (c) => c.tech_stack.package_manager_version || "",
  DATE: () => new Date().toISOString().slice(0, 10),
  RELEASE_DATE: () => new Date().toISOString().slice(0, 10),
  FORMATTER_NAME: (c) => c.tools.formatter_name || c.tools.linter_formatter || "",
  PROJECT_ROOT: (c) => (c.project.name ? `${c.project.name}/` : ""),

  // Docs-derived tokens (auto-derived from existing config, no new fields)
  DATABASE_ENGINE: (c) => c.optional.database || "",
  ORM_OR_QUERY_BUILDER: (c) => c.optional.database || "",
  AUTH_PROVIDER: (c) => c.optional.auth_provider || "",
  DATABASE_URL_VAR: (c) => (c.optional.database ? "DATABASE_URL" : ""),
  AUTH_SECRET_VAR: (c) => (c.optional.auth_provider ? "AUTH_SECRET" : ""),
  API_URL_VAR: () => "API_URL",
  UNIT_FRAMEWORK: (c) => c.tools.test_runner || "",
  E2E_FRAMEWORK: (c) =>
    c.features.has_e2e_tests && c.tools.test_runner ? c.tools.test_runner : "",
  TEST_FRAMEWORK: (c) => c.tools.test_runner || "",
  UI_LIBRARY: (c) => c.tech_stack.component_library || "",
  CSS_NAMING_CONVENTION: (c) =>
    c.tech_stack.styling ? `${c.tech_stack.styling} utility classes` : "",
  SSR_SSG_CSR: (c) => c.tech_stack.framework || "",
  DATA_LAYER: (c) => c.optional.database || "",
  DEV_PORT: () => "3000",
  PRODUCTION_DOMAIN: (c) => {
    if (c.optional.hosting_provider && c.project.name) {
      return `${c.project.name.toLowerCase().replace(/\s+/g, "-")}.example.com`;
    }
    return "";
  },
};

// ---- Required Fields --------------------------------------------------------
// Config paths that must be non-empty for setup to proceed.

export const REQUIRED_FIELDS: string[] = [
  "project.name",
  "tech_stack.runtime",
  "tech_stack.package_manager",
  "tech_stack.source_dir",
  "commands.dev",
  "commands.build",
  "commands.test",
  "commands.lint",
  "commands.install",
];

/**
 * Load and validate the config file.
 * @param configPath - absolute path to toolkit.config.json
 */
export function loadConfig(configPath: string): LoadConfigResult {
  const errors: string[] = [];

  if (!fs.existsSync(configPath)) {
    errors.push(`Config not found: ${configPath}`);
    return { config: null, tokenMap: new Map(), errors };
  }

  let config: ToolkitConfig;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8")) as ToolkitConfig;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Failed to parse config: ${message}`);
    return { config: null, tokenMap: new Map(), errors };
  }

  // Validate structure: must have nested sections
  if (!config.project || !config.tech_stack || !config.commands || !config.features) {
    errors.push("Config must have project, tech_stack, commands, and features sections.");
    return { config: null, tokenMap: new Map(), errors };
  }

  // Ensure optional sections exist (DERIVED functions access these)
  if (!config.tools) config.tools = {};
  if (!config.optional) config.optional = {};

  // Validate required fields
  for (const field of REQUIRED_FIELDS) {
    const val = getNestedValue(config as unknown as Record<string, unknown>, field);
    if (!val || (typeof val === "string" && val.trim() === "")) {
      errors.push(`Required field "${field}" is empty.`);
    }
  }

  // Build token map from direct mappings
  const tokenMap = new Map<string, string>();

  for (const [dotPath, tokenName] of Object.entries(TOKEN_MAP)) {
    const val = getNestedValue(config as unknown as Record<string, unknown>, dotPath);
    if (typeof val === "string" && val.trim() !== "") {
      tokenMap.set(tokenName, val.trim());
    }
  }

  // Add derived values (only if they produce non-empty strings)
  for (const [tokenName, deriveFn] of Object.entries(DERIVED)) {
    // Don't overwrite direct mappings
    if (tokenMap.has(tokenName)) continue;
    try {
      const val = deriveFn(config);
      if (typeof val === "string" && val.trim() !== "") {
        tokenMap.set(tokenName, val.trim());
      }
    } catch {
      // Derivation failed -- leave token unfilled
    }
  }

  return { config, tokenMap, errors };
}
