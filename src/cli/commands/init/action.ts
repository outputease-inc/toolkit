import * as p from "@clack/prompts";
import pkg from "../../../../package.json" with { type: "json" };
import { getOptionalPluginEntries, resolveAgentStack } from "../../../scaffold/agent-context";
import { listAgentTargetIds, resolveAgentTargets } from "../../../scaffold/agent-seed";
import { isUvAvailable } from "../../../scaffold/post-install";
import { displayPreflightReport, runPreflight } from "../../../scaffold/preflight";
import { detectWorkspace } from "../../../scaffold/workspace";
import type { AgentTargetId } from "../../../schema/agent-targets";
import type { ScaffoldScope } from "../../../schema/scaffold";
import { BACKEND_QUESTION, RUNTIME_QUESTION } from "../../../tree/additive-routes";
import { getPreset, listPresets } from "../../../tree/presets";
import type { DecisionTreeLeaf } from "../../../tree/schema";
import { findLeafByPath, runInteractiveTree } from "../../../tree/traversal";
import { printBanner } from "../../banner";
import { resolveTargetDir } from "../../shared/resolvers";
import { INVALID_NAME_MESSAGE, isValidProjectName } from "../../shared/validation";
import { askAdditiveRouteQuestion } from "./prompts";
import { runInit } from "./run";
import { buildInteractiveRunInitOptions } from "./run-init-options";

/**
 * Run per-leaf preflight (host prerequisite detection) and decide whether the
 * scaffold should proceed. Soft-fail by design: warns + (interactively)
 * confirms, or warns + continues in non-interactive (`--preset name`) mode.
 */
async function runLeafPreflight(
  leaf: DecisionTreeLeaf,
  opts: { runtime?: string; nonInteractive: boolean },
): Promise<{ blocked: boolean }> {
  const report = runPreflight(leaf, { runtime: opts.runtime });
  const blocking = displayPreflightReport(report);
  if (!blocking) return { blocked: false };
  if (opts.nonInteractive) {
    const message =
      "Continuing despite missing prerequisites. Install them before running the project.";
    if (process.stdout.isTTY === true) {
      p.log.warn(message);
    } else {
      // Non-TTY (CI, PowerShell Start-Transcript). Plain console.log so
      // captured logs include it; clack's cursor-based output otherwise drops.
      console.log(message);
    }
    return { blocked: false };
  }
  const proceed = await p.confirm({
    message: "Required prerequisites missing. Continue anyway?",
    initialValue: false,
  });
  if (p.isCancel(proceed) || !proceed) {
    return { blocked: true };
  }
  return { blocked: false };
}

/** Flatten a variadic `--agents` value (accepts both `a b` and `a,b` forms) into ids. */
function parseAgentsFlag(agents: string[] | undefined): string[] | undefined {
  if (!agents) return undefined;
  return agents
    .flatMap((a) => a.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Resolve the selected agent target set from CLI flags (spec 008, R10). `--agents`
 * supersedes `--claude`; `--claude`/`--no-claude` add/remove claude from the set.
 * Returns `{ targets: undefined }` when nothing was specified (caller applies the
 * mode-appropriate default), or `{ error }` on an unknown target id.
 */
function selectionFromFlags(options: { agents?: string[]; claude?: boolean }): {
  targets?: AgentTargetId[];
  error?: string;
} {
  const parsed = parseAgentsFlag(options.agents);
  if (!parsed && options.claude === undefined) return { targets: undefined };

  let ids: string[];
  if (parsed) {
    ids = [...parsed];
    if (options.claude === true && !ids.includes("claude")) ids.unshift("claude");
    if (options.claude === false) ids = ids.filter((id) => id !== "claude");
  } else {
    ids = options.claude ? ["claude"] : [];
  }

  const { valid, unknown } = resolveAgentTargets(ids);
  if (unknown.length > 0) {
    return {
      error: `Unknown agent target(s): ${unknown.join(", ")}. Valid: ${listAgentTargetIds().join(", ")}`,
    };
  }
  return { targets: valid };
}

/**
 * Resolve the effective project name for init.
 *
 * A nameless preset falls back to the preset's defaultName ONLY off-TTY
 * (CI / piped stdin), so `outputease init --preset web-app` can't hang
 * there. On a real terminal the fallback must not apply: the interactive
 * flow prompts for the name (the preset still skips the platform tree)
 * instead of silently scaffolding "my-web-app". Windows E2E T5 drives
 * that prompt.
 */
export function resolveInitialProjectName(args: {
  nameArg?: string;
  nameOption?: string;
  presetDefaultName?: string;
  stdinIsTTY: boolean;
}): string | undefined {
  return args.nameArg ?? args.nameOption ?? (args.stdinIsTTY ? undefined : args.presetDefaultName);
}

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
    agents?: string[];
    claude?: boolean;
    uv?: boolean;
    speckit?: boolean;
    runtime?: string;
    backend?: string;
    scope?: string;
    force?: boolean;
    banner?: boolean;
  },
  // Commander passes the command instance as the final action arg; we only need
  // its option-source lookup. Typed structurally to avoid extra-typings generics.
  command?: { getOptionValueSource(name: string): string | undefined },
): Promise<void> {
  printBanner({ version: pkg.version, noBanner: options.banner === false });
  p.intro("OutputEase Toolkit");

  const presetDefaultName = options.preset ? getPreset(options.preset)?.defaultName : undefined;
  const projectName = resolveInitialProjectName({
    nameArg,
    nameOption: options.name,
    presetDefaultName,
    stdinIsTTY: process.stdin.isTTY === true,
  });
  // Detect an explicitly-provided --pm via Commander's value source so both
  // `--pm x` and `--pm=x` are honored (argv.includes missed the equals form).
  const pmExplicit = command
    ? command.getOptionValueSource("pm") === "cli"
    : process.argv.some((a) => a === "--pm" || a.startsWith("--pm="));
  const scopeExplicit = options.scope as ScaffoldScope | undefined;

  // Validate preset early so both paths (with and without name) report
  // the same useful error.
  if (options.preset && !getPreset(options.preset)) {
    p.cancel(
      `Unknown preset "${options.preset}". Available: ${listPresets()
        .map((x) => x.name)
        .join(", ")}`,
    );
    process.exit(1);
  }

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

    // Per-leaf preflight (soft-fail in non-interactive mode).
    const presetForPreflight = getPreset(options.preset);
    const presetLeaf = presetForPreflight ? findLeafByPath(presetForPreflight.leafId) : undefined;
    if (presetLeaf) {
      await runLeafPreflight(presetLeaf, {
        runtime: options.runtime,
        nonInteractive: true,
      });
    }

    // Resolve agent targets from flags (non-interactive; default = none for presets).
    const presetSel = selectionFromFlags(options);
    if (presetSel.error) {
      p.cancel(presetSel.error);
      process.exit(1);
    }
    const presetAgentTargets = presetSel.targets ?? [];

    const result = await runInit({
      name: projectName,
      targetDir,
      preset: options.preset,
      pm: options.pm,
      pmExplicit,
      dryRun: options.dryRun,
      claude: presetAgentTargets.includes("claude"),
      agentTargets: presetAgentTargets,
      uv: presetUv,
      specKit: presetSpecKit,
      scope: scopeExplicit,
      runtime: options.runtime,
      backend: options.backend,
      force: options.force,
    });

    if (!result.success) {
      p.cancel(result.error ?? "Scaffolding failed");
      process.exit(1);
    }
    return;
  }

  // Interactive mode. Two entry shapes:
  //   - With `--preset`: skip the platform tree (preset already pins the leaf)
  //     and skip the additive route questions (preset's additiveRoutes are the
  //     answer). Continue to the name + claude + uv + speckit + scope prompts.
  //   - Without `--preset`: run the full interactive tree, then additive route
  //     questions, then the same trailing prompt set.
  let leaf: DecisionTreeLeaf | undefined;
  if (options.preset) {
    // Already validated above; this lookup cannot return undefined here.
    const preset = getPreset(options.preset);
    leaf = preset ? findLeafByPath(preset.leafId) : undefined;
    if (!leaf) {
      p.cancel(`Preset "${options.preset}" references unknown leaf "${preset?.leafId}"`);
      process.exit(1);
    }
  } else {
    leaf = await runInteractiveTree();
    if (!leaf) {
      p.cancel("Cancelled");
      process.exit(130);
    }
  }

  // Ask additive route questions only when no preset is set; presets carry
  // their own additiveRoutes via tree/presets.ts.
  let runtimeChoice: string | undefined = options.runtime;
  let backendChoice: string | undefined = options.backend;

  if (
    !options.preset &&
    !runtimeChoice &&
    RUNTIME_QUESTION.applicablePlatforms.has(leaf.platformKey)
  ) {
    const result = await askAdditiveRouteQuestion(RUNTIME_QUESTION);
    if (result === null) {
      p.cancel("Cancelled");
      process.exit(130);
    }
    runtimeChoice = result;
  }

  if (
    !options.preset &&
    !backendChoice &&
    BACKEND_QUESTION.applicablePlatforms.has(leaf.platformKey)
  ) {
    const result = await askAdditiveRouteQuestion(BACKEND_QUESTION);
    if (result === null) {
      p.cancel("Cancelled");
      process.exit(130);
    }
    backendChoice = result;
  }

  // Per-leaf preflight (soft-fail: warns, optionally confirms continue).
  // Runs before the rest of the prompts so the user finds missing host
  // prereqs (Rust for Tauri, Xcode for Capacitor iOS, Bun runtime, etc.)
  // before spending time on naming and scope.
  const preflight = await runLeafPreflight(leaf, {
    runtime: runtimeChoice,
    nonInteractive: false,
  });
  if (preflight.blocked) {
    p.cancel("Cancelled. Install prerequisites and re-run.");
    process.exit(0);
  }

  // Ask for project name if not provided. Fail fast in non-interactive mode
  // (CI / no TTY) rather than blocking forever on a prompt that can't be answered.
  let name = projectName;
  if (!name) {
    if (!process.stdin.isTTY) {
      p.cancel("A project name is required in non-interactive mode (pass a name or --name).");
      process.exit(1);
    }
    const nameResult = await p.text({
      message: "Project name?",
      placeholder: "my-app",
      validate: (v) => {
        if (!v || v.length === 0) return "Name is required";
        if (!isValidProjectName(v)) return INVALID_NAME_MESSAGE;
        return undefined;
      },
    });
    if (p.isCancel(nameResult)) {
      p.cancel("Cancelled");
      process.exit(130);
    }
    name = nameResult;
  }

  // Resolve agent targets: CLI flags win; otherwise a multiselect (claude preselected).
  const flagSel = selectionFromFlags(options);
  if (flagSel.error) {
    p.cancel(flagSel.error);
    process.exit(1);
  }
  let agentTargets: AgentTargetId[];
  if (flagSel.targets !== undefined) {
    agentTargets = flagSel.targets;
  } else {
    const picked = await p.multiselect({
      message: "Which agents should this project target?",
      options: listAgentTargetIds().map((id) => ({ value: id, label: id })),
      initialValues: ["claude"] as AgentTargetId[],
      required: false,
    });
    if (p.isCancel(picked)) {
      p.cancel("Cancelled");
      process.exit(130);
    }
    agentTargets = picked as AgentTargetId[];
  }

  // Optional Claude plugin picker (interactive only; claude-gated). Picked
  // plugins land uncommented in scripts/install-claude-plugins.sh; the rest
  // stay in its commented optional block.
  let selectedPlugins: string[] = [];
  if (agentTargets.includes("claude")) {
    const optionalPlugins = getOptionalPluginEntries(
      resolveAgentStack(leaf.platformKey, backendChoice),
    );
    if (optionalPlugins.length > 0) {
      const picked = await p.multiselect({
        message: "Optional Claude plugins? (space to select, enter to skip)",
        options: optionalPlugins.map((entry) => ({
          value: entry.tool,
          label: entry.tool,
          hint: entry.purpose.length > 64 ? `${entry.purpose.slice(0, 61)}...` : entry.purpose,
        })),
        initialValues: [] as string[],
        required: false,
      });
      if (p.isCancel(picked)) {
        p.cancel("Cancelled");
        process.exit(130);
      }
      selectedPlugins = picked as string[];
    }
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
  const result = await runInit(
    buildInteractiveRunInitOptions({
      name,
      targetDir,
      preset: options.preset,
      pm,
      pmExplicit,
      dryRun: options.dryRun,
      agentTargets,
      uv,
      specKit,
      scope,
      leaf,
      runtime: runtimeChoice,
      backend: backendChoice,
      force: options.force,
      selectedPlugins,
    }),
  );

  if (!result.success) {
    p.cancel(result.error ?? "Scaffolding failed");
    process.exit(1);
  }

  p.outro(`Done! Created ${name} in ./${name}`);
}
