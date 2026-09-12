import { randomBytes } from "node:crypto";
import pkg from "../../../../package.json" with { type: "json" };
import { buildMarker, writeMarker } from "../../../marker/write";
import { generatePluginInstallScript, resolveAgentStack } from "../../../scaffold/agent-context";
import { buildAgentFiles, primarySpecKitIntegration } from "../../../scaffold/agent-seed";
import { cleanupScratch } from "../../../scaffold/cleanup";
import { PACKAGE_MANAGERS, resolveStack } from "../../../scaffold/context";
import { buildEnvExample } from "../../../scaffold/env-example";
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
import type { AgentTargetId } from "../../../schema/agent-targets";
import type { PackageManagerName, ScaffoldResult, ScaffoldScope } from "../../../schema/scaffold";
import { DECISION_TREE_LEAVES } from "../../../tree/definition";
import { getPreset, listPresets } from "../../../tree/presets";
import type { AdditiveRouteConfig, DecisionTreeLeaf } from "../../../tree/schema";
import { findLeafByPath } from "../../../tree/traversal";
import { getAutomationDeps, getFrameworkDeps } from "../../shared/deps-builder";
import { rerunGuard } from "../../shared/rerun-guard";
import { resolveAdditiveRoutes, resolveMarkerProjectType } from "../../shared/resolvers";
import { INVALID_NAME_MESSAGE, isValidProjectName } from "../../shared/validation";
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
  /**
   * Legacy single-agent flag (Claude Code infrastructure). Superseded by
   * `agentTargets`; when `agentTargets` is provided it takes precedence, and
   * `claude` is derived from whether the set includes `"claude"`.
   */
  claude: boolean;
  /**
   * Selected agent targets (spec 008, R10). When set, supersedes `claude`: the
   * scaffold emits the neutral `.agents/` seed plus generated configs for exactly
   * these targets. `["claude"]` reproduces the pre-feature Claude-only scaffold.
   */
  agentTargets?: AgentTargetId[];
  uv: boolean;
  specKit: boolean;
  scope?: ScaffoldScope;
  runtime?: string;
  backend?: string;
  force?: boolean;
  /**
   * Selectable plugin tool names picked at init. Picked plugins are emitted
   * uncommented in scripts/install-claude-plugins.sh; the rest stay in the
   * commented optional block. Omitted (preset / non-interactive) = none.
   */
  selectedPlugins?: string[];
  /**
   * The decision-tree leaf resolved by the interactive picker. Superseded by
   * `preset` when both are set; when both are absent, the webApp fallback
   * (`DECISION_TREE_LEAVES.tailwind`) applies. Threading this is what makes an
   * interactive non-webApp pick scaffold the right platform.
   */
  leaf?: DecisionTreeLeaf;
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
    if (!isValidProjectName(options.name)) {
      return makeError(
        options,
        startTime,
        `Invalid project name "${options.name}". ${INVALID_NAME_MESSAGE}`,
      );
    }

    // Validate target directory
    if (!options.dryRun) {
      validateTargetDir(options.targetDir, options.scope ?? "standalone", options.force ?? false);
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
    let leaf = options.preset ? resolvePresetToLeafLocal(options.preset) : options.leaf;
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

    /**
     * The backend the project actually resolves, which is not always the flag.
     * A preset pins its backend through its own additive routes, so `--preset
     * web-app-supabase` with no `--backend` yields `backend:supabase` here and
     * nothing in `options.backend`. The dev-stack resolution reads the merged
     * routes; the agent stack read the raw flag and therefore disagreed with it,
     * scaffolding a Supabase project whose `.mcp.json` had no Supabase server.
     *
     * Last match wins, matching how `resolveStack` merges exclusion overrides:
     * flag routes are appended after preset routes, so an explicit `--backend`
     * still overrides the preset's default.
     */
    const effectiveBackend =
      [...allAdditiveRoutes]
        .reverse()
        .find((ar) => ar.route.startsWith("backend:"))
        ?.route.slice("backend:".length) ?? options.backend;

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
      const automationDeps = getAutomationDeps(pkg.version);
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

    // Resolve the selected agent targets (spec 008, R10). `agentTargets` supersedes
    // the legacy `claude` boolean; when absent, fall back to it. Claude scaffold files
    // (CLAUDE.md, .claude/**, .mcp.json) are produced by the neutral-source generator
    // below, never the static Claude template path, so the template render always
    // runs with the Claude path disabled.
    const agentTargets: AgentTargetId[] =
      options.agentTargets ?? (options.claude ? ["claude"] : []);
    const claudeSelected = agentTargets.includes("claude");

    // Render templates based on scope
    let renderedFiles: RenderedFile[];

    if (options.scope === "monorepo") {
      renderedFiles = renderMonorepoTemplates(stack.frameworkConfig.framework, false, templateData);
    } else if (options.scope === "workspace-app") {
      renderedFiles = renderWorkspaceAppTemplates(
        stack.frameworkConfig.framework,
        false,
        templateData,
      );
    } else if (options.scope === "workspace-package") {
      renderedFiles = renderWorkspacePackageTemplates(
        stack.frameworkConfig.framework,
        false,
        templateData,
      );
    } else {
      const templateDirs = getTemplateDirs(stack.frameworkConfig.framework, false);
      const etaFiles = renderTemplates(templateDirs, templateData);
      const staticGroups = getStaticTemplateGroups(scope, false);
      const staticFiles = collectStaticFiles(staticGroups);
      renderedFiles = deduplicateFiles(etaFiles, staticFiles);
    }

    // Emit agent configuration from one neutral source (spec 008, FR-003/R10). A
    // Claude-only selection reproduces the pre-feature scaffold (no `.agents/`); any
    // non-Claude target additionally seeds `.agents/` for the generate/check loop.
    if (agentTargets.length > 0) {
      const agentResult = buildAgentFiles({
        templateData,
        platformKey: leaf.platformKey,
        backend: effectiveBackend,
        targets: agentTargets,
      });
      if (agentResult.exitCode !== 0) {
        return makeError(
          options,
          startTime,
          `Agent config generation failed: ${agentResult.errors.join("; ")}`,
        );
      }
      renderedFiles.push(...agentResult.files);

      // The plugin-install script stays a Claude-specific scaffold artifact
      // (plugin install is outside the neutral MCP/instructions scope).
      if (claudeSelected) {
        const agentStack = resolveAgentStack(leaf.platformKey, effectiveBackend);
        renderedFiles.push({
          relativePath: "scripts/install-claude-plugins.sh",
          content: generatePluginInstallScript(agentStack, options.selectedPlugins ?? []),
        });
      }
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
      if (!renderedFiles.some((f) => f.relativePath === ".env.example")) {
        renderedFiles.push({
          relativePath: ".env.example",
          content: buildEnvExample(stack),
        });
      }
    }

    // Write files
    const { filesCreated, filesModified, dirsCreated } = writeFiles(
      renderedFiles,
      { targetDir: options.targetDir, dryRun: options.dryRun },
      rollback,
    );

    // The `.outputease` marker is written AFTER post-install (below), not here:
    // post-install can block for minutes (Git/spec-kit), and a marker written
    // before it would survive an interrupt-triggered rollback, leaving a lone
    // marker that permanently locks the dir against re-init. Only standalone /
    // monorepo get a marker — workspace scopes inherit the parent's.
    const writesMarker = scope === "standalone" || scope === "monorepo";
    if (writesMarker) {
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
            // spec-kit installs commands for one integration (T061 / [C5]); pick the
            // primary selected agent (claude when present, else first supported).
            specKitIntegration: primarySpecKitIntegration(agentTargets) ?? "claude",
          })
        : undefined;

    // Now that the long-running post-install has completed, write the marker.
    // Track it in rollback for the (tiny) remaining window before success.
    if (writesMarker && !options.dryRun) {
      const marker = buildMarker({
        toolkitVersion: pkg.version,
        projectType: resolveMarkerProjectType(leaf.platformKey),
        scaffoldSeed: randomBytes(6).toString("hex"),
      });
      const markerPath = await writeMarker(options.targetDir, marker);
      rollback.trackFileCreated(markerPath);
    }

    const result: ScaffoldResult = {
      success: true,
      projectName: options.name,
      targetDir: options.targetDir,
      filesCreated,
      filesModified,
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
