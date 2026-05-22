import { randomBytes } from "node:crypto";
import pkg from "../../../../package.json" with { type: "json" };
import { buildMarker, writeMarker } from "../../../marker/write";
import {
  generateMcpJson,
  generatePluginInstallScript,
  resolveAgentStack,
} from "../../../scaffold/agent-context";
import { cleanupScratch } from "../../../scaffold/cleanup";
import { PACKAGE_MANAGERS, resolveStack } from "../../../scaffold/context";
import { ENV_LOCAL_FILENAME, ENV_LOCAL_TEMPLATE } from "../../../scaffold/env-local-template";
import { runPostInstall } from "../../../scaffold/post-install";
import {
  collectStaticFiles,
  deduplicateFiles,
  type RenderedFile,
  renderTemplates,
  type TemplateData,
} from "../../../scaffold/renderer";
import { buildStackSummary, displayDryRunSummary, displaySummary } from "../../../scaffold/summary";
import { deriveTemplateTokens } from "../../../scaffold/template-tokens";
import {
  RollbackManager,
  registerSigintHandler,
  validateTargetDir,
  writeFiles,
} from "../../../scaffold/writer";
import type { PackageManagerName, ScaffoldResult, ScaffoldScope } from "../../../schema/scaffold";
import { DECISION_TREE_LEAVES } from "../../../tree/definition";
import { getPreset, listPresets } from "../../../tree/presets";
import type { AdditiveRouteConfig } from "../../../tree/schema";
import { findLeafByPath } from "../../../tree/traversal";
import { getAutomationDeps, getFrameworkDeps } from "../../shared/deps-builder";
import { rerunGuard } from "../../shared/rerun-guard";
import { resolveAdditiveRoutes, resolveMarkerProjectType } from "../../shared/resolvers";
import {
  getStaticTemplateGroups,
  getTemplateDirs,
  renderMonorepoTemplates,
  renderWorkspaceAppTemplates,
  renderWorkspacePackageTemplates,
} from "./templates";

/**
 * Options for the programmatic runInit function (used by tests and preset mode).
 */
export interface RunInitOptions {
  name: string;
  targetDir: string;
  preset?: string;
  pm: string;
  pmExplicit?: boolean;
  dryRun: boolean;
  claude: boolean;
  uv: boolean;
  specKit: boolean;
  scope?: ScaffoldScope;
  runtime?: string;
  backend?: string;
}

/**
 * Programmatic init entry point (testable, no interactive prompts).
 */
export async function runInit(options: RunInitOptions): Promise<ScaffoldResult> {
  const startTime = Date.now();
  const rollback = new RollbackManager();
  const removeSigintHandler = registerSigintHandler(rollback);

  try {
    // Validate project name (prevents injection via non-interactive --name flag).
    // Accepts either bare names (`foo-bar`) or scoped names (`@scope/name`).
    // Bare slashes and parent-directory segments are rejected to block path traversal.
    const SAFE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
    if (!SAFE_NAME.test(options.name) || options.name.includes("..")) {
      return makeError(
        options,
        startTime,
        `Invalid project name "${options.name}". Must be a valid npm package name (lowercase, alphanumeric, hyphens, dots, underscores, or @scope/name).`,
      );
    }

    // Validate target directory
    if (!options.dryRun) {
      validateTargetDir(options.targetDir, options.scope ?? "standalone");
    }

    // FR-012 rerun guard. Three cases:
    //   1. valid `.outputease` marker → refuse (this is `update` territory).
    //   2. partial state (no marker, but `.tmp-*` or scratch dirs present) → clean first, proceed.
    //   3. clean dir → proceed.
    if (!options.dryRun) {
      const guard = await rerunGuard(options.targetDir);
      if (guard.kind === "already-scaffolded") {
        return makeError(
          options,
          startTime,
          "Project already scaffolded. Use 'outputease update' to refresh tooling.",
        );
      }
    }

    // Resolve the leaf and preset additive routes
    let leaf = options.preset ? resolvePresetToLeafLocal(options.preset) : undefined;
    let presetAdditiveRoutes: AdditiveRouteConfig[] = [];

    if (options.preset) {
      const preset = getPreset(options.preset);
      if (!leaf) {
        const available = listPresets()
          .map((pr) => pr.name)
          .join(", ");
        return makeError(
          options,
          startTime,
          `Unknown preset "${options.preset}". Available: ${available}`,
        );
      }
      presetAdditiveRoutes = preset?.additiveRoutes ?? [];
    }

    // If no preset, find the default leaf (nextjs-tailwind for now)
    if (!leaf) {
      leaf = DECISION_TREE_LEAVES.tailwind;
    }

    if (!leaf) {
      return makeError(options, startTime, "Could not resolve a stack configuration");
    }

    // Resolve additive routes from CLI flags
    const flagAdditiveRoutes = resolveAdditiveRoutes(
      leaf.platformKey,
      options.runtime,
      options.backend,
    );
    const allAdditiveRoutes = [...presetAdditiveRoutes, ...flagAdditiveRoutes];

    // Default pm to pnpm when Node.js runtime is selected and pm wasn't explicit
    let pmName = options.pm as PackageManagerName;
    if (!options.pmExplicit && options.runtime === "node") {
      pmName = "pnpm";
    }
    if (
      !options.pmExplicit &&
      !options.runtime &&
      presetAdditiveRoutes.some((ar) => ar.route === "runtime:node")
    ) {
      pmName = "pnpm";
    }

    const pm = PACKAGE_MANAGERS[pmName];
    if (!pm) {
      return makeError(
        options,
        startTime,
        `Unknown package manager: "${pmName}". Use: bun, npm, yarn, pnpm`,
      );
    }

    // Resolve the stack from the leaf + additive routes
    const stack = resolveStack(leaf, allAdditiveRoutes.length > 0 ? allAdditiveRoutes : undefined);

    // Get framework-specific dependencies
    const deps = getFrameworkDeps(leaf.frameworkConfig.framework);

    // Merge dependencies
    const allDeps = { ...stack.dependencies, ...deps.dependencies };
    const allDevDeps = { ...stack.devDependencies, ...deps.devDependencies };

    // Merge automation deps for standalone/monorepo scopes
    const scope = options.scope ?? "standalone";
    if (scope === "standalone" || scope === "monorepo") {
      const automationDeps = getAutomationDeps();
      Object.assign(allDevDeps, automationDeps);
    }

    // Build template data, including derived tokens for CLI-resolvable placeholders.
    const derivedTokens = deriveTemplateTokens(pm, stack.frameworkConfig, scope, pkg.version);
    const templateData: TemplateData = {
      projectName: options.name,
      pm,
      frameworkConfig: stack.frameworkConfig,
      dependencies: allDeps,
      devDependencies: allDevDeps,
      stackSummary: buildStackSummary(stack.tools.map((t) => t.tool)),
      specKit: options.specKit,
      scope,
      ...derivedTokens,
    };

    // Render templates based on scope
    let renderedFiles: RenderedFile[];

    if (options.scope === "monorepo") {
      renderedFiles = renderMonorepoTemplates(
        stack.frameworkConfig.framework,
        options.claude,
        templateData,
      );
    } else if (options.scope === "workspace-app") {
      renderedFiles = renderWorkspaceAppTemplates(
        stack.frameworkConfig.framework,
        options.claude,
        templateData,
      );
    } else if (options.scope === "workspace-package") {
      renderedFiles = renderWorkspacePackageTemplates(
        stack.frameworkConfig.framework,
        options.claude,
        templateData,
      );
    } else {
      const templateDirs = getTemplateDirs(stack.frameworkConfig.framework, options.claude);
      const etaFiles = renderTemplates(templateDirs, templateData);
      const staticGroups = getStaticTemplateGroups(scope, options.claude);
      const staticFiles = collectStaticFiles(staticGroups);
      renderedFiles = deduplicateFiles(etaFiles, staticFiles);
    }

    // Resolve agent stack and inject dynamic Claude Code files when opted in
    if (options.claude) {
      const agentStack = resolveAgentStack(leaf.platformKey, options.backend);

      // Generate dynamic .mcp.json from resolved MCP server entries
      const mcpJson = generateMcpJson(agentStack);
      const mcpContent = `${JSON.stringify(mcpJson, null, 2)}\n`;

      // Replace static .mcp.json template with dynamic version
      const mcpIdx = renderedFiles.findIndex((f) => f.relativePath === ".mcp.json");
      if (mcpIdx >= 0) {
        renderedFiles[mcpIdx] = { relativePath: ".mcp.json", content: mcpContent };
      } else {
        renderedFiles.push({ relativePath: ".mcp.json", content: mcpContent });
      }

      // Generate plugin install script
      const installScript = generatePluginInstallScript(agentStack);
      renderedFiles.push({
        relativePath: "scripts/install-claude-plugins.sh",
        content: installScript,
      });
    }

    // Inject `.env.local` template (FR-003). Standalone + monorepo scaffold a
    // brand-new project root, so emit there. Workspace scopes attach to an
    // existing monorepo that already owns its env files.
    if (scope === "standalone" || scope === "monorepo") {
      if (!renderedFiles.some((f) => f.relativePath === ENV_LOCAL_FILENAME)) {
        renderedFiles.push({
          relativePath: ENV_LOCAL_FILENAME,
          content: ENV_LOCAL_TEMPLATE,
        });
      }
    }

    // Write files
    const { filesCreated, dirsCreated } = writeFiles(
      renderedFiles,
      { targetDir: options.targetDir, dryRun: options.dryRun },
      rollback,
    );

    // Write `.outputease` marker (FR-007). Only for fresh project roots — workspace
    // scopes inherit the parent monorepo's marker. Dry-run reports the marker in
    // filesCreated for parity with real runs but does not write to disk.
    if (scope === "standalone" || scope === "monorepo") {
      const marker = buildMarker({
        toolkitVersion: pkg.version,
        projectType: resolveMarkerProjectType(leaf.platformKey),
        scaffoldSeed: randomBytes(6).toString("hex"),
      });
      if (!options.dryRun) {
        await writeMarker(options.targetDir, marker);
      }
      filesCreated.push(".outputease");
    }

    // Run post-scaffold installations (uv + spec-kit)
    const postInstall =
      options.uv || options.specKit
        ? await runPostInstall({
            targetDir: options.targetDir,
            projectName: options.name,
            uv: options.uv,
            specKit: options.specKit,
            dryRun: options.dryRun,
          })
        : undefined;

    const result: ScaffoldResult = {
      success: true,
      projectName: options.name,
      targetDir: options.targetDir,
      filesCreated,
      filesModified: [],
      dirsCreated,
      stack,
      durationMs: Date.now() - startTime,
      postInstall,
    };

    if (options.dryRun) {
      displayDryRunSummary(result);
    } else {
      displaySummary(result, pm);
    }

    // FR-011: end-of-run cleanup. Removes any `.tmp-*` files / scratch dirs
    // left in the target directory by the scaffold pipeline.
    if (!options.dryRun) {
      await cleanupScratch(options.targetDir);
    }

    removeSigintHandler();
    return result;
  } catch (err) {
    rollback.rollback();
    removeSigintHandler();
    return makeError(options, startTime, err instanceof Error ? err.message : String(err));
  }
}

function resolvePresetToLeafLocal(presetName: string) {
  const preset = getPreset(presetName);
  if (!preset) return undefined;
  return findLeafByPath(preset.leafId) ?? DECISION_TREE_LEAVES[preset.leafId];
}

function makeError(options: RunInitOptions, startTime: number, error: string): ScaffoldResult {
  return {
    success: false,
    projectName: options.name,
    targetDir: options.targetDir,
    filesCreated: [],
    filesModified: [],
    dirsCreated: [],
    stack: {
      leafId: "",
      route: "base",
      platformKey: "webApp",
      tools: [],
      dependencies: {},
      devDependencies: {},
      frameworkConfig: {
        framework: "",
        entryPoint: "",
        devCommand: "",
        buildCommand: "",
        directories: [],
      },
    },
    durationMs: Date.now() - startTime,
    error,
  };
}
