import * as p from "@clack/prompts";
import pkg from "../../../../package.json" with { type: "json" };
import { isUvAvailable } from "../../../scaffold/post-install";
import { detectWorkspace } from "../../../scaffold/workspace";
import type { ScaffoldScope } from "../../../schema/scaffold";
import { BACKEND_QUESTION, RUNTIME_QUESTION } from "../../../tree/additive-routes";
import { runInteractiveTree } from "../../../tree/traversal";
import { printBanner } from "../../banner";
import { resolveTargetDir } from "../../shared/resolvers";
import { askAdditiveRouteQuestion } from "./prompts";
import { runInit } from "./run";

/**
 * Commander action handler for `outputease-toolkit init [name]`.
 * Bridges CLI args to the programmatic runInit.
 */
export async function initAction(
  nameArg: string | undefined,
  options: {
    preset?: string;
    name?: string;
    pm: string;
    dryRun: boolean;
    claude?: boolean;
    uv?: boolean;
    speckit?: boolean;
    runtime?: string;
    backend?: string;
    scope?: string;
    banner?: boolean;
  },
): Promise<void> {
  printBanner({ version: pkg.version, noBanner: options.banner === false });
  p.intro("OutputEase Toolkit");

  const projectName = nameArg ?? options.name;
  const pmExplicit = process.argv.includes("--pm");
  const scopeExplicit = options.scope as ScaffoldScope | undefined;

  if (options.preset && projectName) {
    // Non-interactive preset mode
    const cwd = process.cwd();
    const ws = detectWorkspace(cwd);
    const targetDir = resolveTargetDir(cwd, projectName, scopeExplicit, ws);
    // Resolve cascading uv/speckit defaults for preset mode
    const presetUv = options.uv ?? true;
    const presetSpecKit = !presetUv ? false : (options.speckit ?? true);
    if (options.uv === false && options.speckit === true) {
      p.log.warn("--no-uv overrides --speckit (uv is required for spec-kit)");
    }

    const result = await runInit({
      name: projectName,
      targetDir,
      preset: options.preset,
      pm: options.pm,
      pmExplicit,
      dryRun: options.dryRun,
      claude: options.claude ?? false,
      uv: presetUv,
      specKit: presetSpecKit,
      scope: scopeExplicit,
      runtime: options.runtime,
      backend: options.backend,
    });

    if (!result.success) {
      p.cancel(result.error ?? "Scaffolding failed");
      process.exit(1);
    }
    return;
  }

  // Interactive mode
  const leaf = await runInteractiveTree();
  if (!leaf) {
    p.cancel("Cancelled");
    process.exit(130);
  }

  // Ask additive route questions if applicable
  let runtimeChoice: string | undefined = options.runtime;
  let backendChoice: string | undefined = options.backend;

  if (!runtimeChoice && RUNTIME_QUESTION.applicablePlatforms.has(leaf.platformKey)) {
    const result = await askAdditiveRouteQuestion(RUNTIME_QUESTION);
    if (result === null) {
      p.cancel("Cancelled");
      process.exit(130);
    }
    runtimeChoice = result;
  }

  if (!backendChoice && BACKEND_QUESTION.applicablePlatforms.has(leaf.platformKey)) {
    const result = await askAdditiveRouteQuestion(BACKEND_QUESTION);
    if (result === null) {
      p.cancel("Cancelled");
      process.exit(130);
    }
    backendChoice = result;
  }

  // Ask for project name if not provided
  let name = projectName;
  if (!name) {
    const nameResult = await p.text({
      message: "Project name?",
      placeholder: "my-app",
      validate: (v) => {
        if (!v || v.length === 0) return "Name is required";
        if (!/^[a-z0-9@][a-z0-9._\-/]*$/.test(v)) return "Must be a valid npm package name";
        return undefined;
      },
    });
    if (p.isCancel(nameResult)) {
      p.cancel("Cancelled");
      process.exit(130);
    }
    name = nameResult;
  }

  // Ask about Claude Code infrastructure if not specified via flags
  let claude = options.claude;
  if (claude === undefined) {
    const claudeResult = await p.confirm({
      message: "Include Claude Code infrastructure?",
      initialValue: true,
    });
    if (p.isCancel(claudeResult)) {
      p.cancel("Cancelled");
      process.exit(130);
    }
    claude = claudeResult;
  }

  // Ask about uv + spec-kit with cascading logic
  let uv = options.uv;
  let specKit = options.speckit;

  // Handle conflict: --no-uv --speckit
  if (options.uv === false && options.speckit === true) {
    p.log.warn("--no-uv overrides --speckit (uv is required for spec-kit)");
    specKit = false;
  }

  if (uv === undefined) {
    // If uv is already installed, skip the uv question
    if (isUvAvailable()) {
      uv = true;
    } else {
      const uvResult = await p.confirm({
        message: "Install uv (Python package manager for spec-kit)?",
        initialValue: true,
      });
      if (p.isCancel(uvResult)) {
        p.cancel("Cancelled");
        process.exit(130);
      }
      uv = uvResult;
    }
  }

  if (!uv) {
    specKit = false;
  } else if (specKit === undefined) {
    const specKitResult = await p.confirm({
      message: "Set up spec-kit for spec-driven development?",
      initialValue: true,
    });
    if (p.isCancel(specKitResult)) {
      p.cancel("Cancelled");
      process.exit(130);
    }
    specKit = specKitResult;
  }

  // Resolve project scope
  let scope: ScaffoldScope;
  const cwd = process.cwd();
  const ws = detectWorkspace(cwd);

  if (scopeExplicit) {
    scope = scopeExplicit;
  } else if (ws.detected && ws.supported) {
    // Workspace detected — offer workspace-aware options
    const scopeResult = await p.select({
      message: "Project scope?",
      options: [
        { value: "workspace-app", label: "Add app to workspace", hint: `Into ${ws.appsDir}/` },
        {
          value: "workspace-package",
          label: "Add package to workspace",
          hint: `Into ${ws.packagesDir}/`,
        },
        { value: "standalone", label: "Standalone (ignore workspace)", hint: "New directory" },
      ],
    });
    if (p.isCancel(scopeResult)) {
      p.cancel("Cancelled");
      process.exit(130);
    }
    scope = scopeResult as ScaffoldScope;
  } else {
    // No workspace — offer standalone or monorepo
    const scopeResult = await p.select({
      message: "Project scope?",
      options: [
        { value: "standalone", label: "Standalone app", hint: "Single project directory" },
        {
          value: "monorepo",
          label: "Full Turborepo monorepo",
          hint: "Root + shared packages + starter app",
        },
      ],
    });
    if (p.isCancel(scopeResult)) {
      p.cancel("Cancelled");
      process.exit(130);
    }
    scope = scopeResult as ScaffoldScope;
  }

  // Default pm based on runtime choice
  const pm = !pmExplicit && runtimeChoice === "node" ? "pnpm" : options.pm;

  const targetDir = resolveTargetDir(cwd, name, scope, ws);
  const result = await runInit({
    name,
    targetDir,
    pm,
    pmExplicit,
    dryRun: options.dryRun,
    claude,
    uv: uv ?? true,
    specKit: specKit ?? true,
    scope,
    runtime: runtimeChoice,
    backend: backendChoice,
  });

  if (!result.success) {
    p.cancel(result.error ?? "Scaffolding failed");
    process.exit(1);
  }

  p.outro(`Done! Created ${name} in ./${name}`);
}
