import { loadDevStacks } from "../data/dev-stacks-loader";
import type { DevStackEntry } from "../schema/dev-stacks";
import type { PackageManagerConfig, PackageManagerName, ResolvedStack } from "../schema/scaffold";
import type { AdditiveRouteConfig, DecisionTreeLeaf } from "../tree/schema";

/**
 * PackageManagerConfig constants for each supported package manager.
 * See: archive/specs/001-toolkit-cli-scaffolding/data-model.md
 */

export const PACKAGE_MANAGERS: Record<PackageManagerName, PackageManagerConfig> = {
  bun: {
    name: "bun",
    binary: "bun",
    run: "bun run",
    exec: "bunx",
    install: "bun install",
    lockfile: "bun.lock",
    packageManagerField: "bun@1.x",
  },
  npm: {
    name: "npm",
    binary: "npm",
    run: "npm run",
    exec: "npx",
    install: "npm install",
    lockfile: "package-lock.json",
    packageManagerField: "npm@10.x",
  },
  yarn: {
    name: "yarn",
    binary: "yarn",
    run: "yarn",
    exec: "yarn dlx",
    install: "yarn install",
    lockfile: "yarn.lock",
    packageManagerField: "yarn@4.x",
  },
  pnpm: {
    name: "pnpm",
    binary: "pnpm",
    run: "pnpm run",
    exec: "pnpm dlx",
    install: "pnpm install",
    lockfile: "pnpm-lock.yaml",
    packageManagerField: "pnpm@9.x",
  },
};

/**
 * Resolve a decision tree leaf into a complete stack by filtering the dev-stacks dataset.
 *
 * Algorithm:
 * 1. Load all DevStackEntry items
 * 2. Filter by active routes (base + primary + additive) and platform
 * 3. Include always-included and auto-included tools
 * 4. Apply merged exclusion choices (leaf defaults + additive overrides)
 * 5. Resolve dependsOn chains transitively
 * 6. Build final tool list
 *
 * When additiveRoutes is omitted, behavior is identical to the original single-route algorithm.
 */
export function resolveStack(
  leaf: DecisionTreeLeaf,
  additiveRoutes?: AdditiveRouteConfig[],
): ResolvedStack {
  const allTools = loadDevStacks();

  // Build a lookup of ALL tools by name (for exclusion choices + dependsOn
  // that may reference tools outside the route-filtered set)
  const globalToolMap = new Map<string, DevStackEntry>();
  for (const tool of allTools) {
    globalToolMap.set(tool.tool, tool);
  }

  // Build set of active routes: base + primary leaf route + any additive routes
  const activeRoutes = new Set(["base", leaf.route]);
  if (additiveRoutes) {
    for (const ar of additiveRoutes) {
      activeRoutes.add(ar.route);
    }
  }

  // Filter by active routes and platform
  const platformKey = leaf.platformKey;
  const matchingTools = allTools.filter((tool) => {
    const routeMatch = activeRoutes.has(tool.route);
    const platformMatch = tool.platforms[platformKey] === true;
    return routeMatch && platformMatch;
  });

  // Include always-included and auto-included from route-filtered set
  const included = new Set<string>();
  const toolMap = new Map<string, DevStackEntry>();

  for (const tool of matchingTools) {
    toolMap.set(tool.tool, tool);
    if (tool.selectionMode === "always-included" || tool.selectionMode === "auto-included") {
      included.add(tool.tool);
    }
  }

  // Merge exclusion choices: leaf defaults + additive route overrides (overrides win)
  const mergedExclusions: Record<string, string> = { ...leaf.exclusionChoices };
  if (additiveRoutes) {
    for (const ar of additiveRoutes) {
      for (const [group, choice] of Object.entries(ar.exclusionOverrides)) {
        mergedExclusions[group] = choice;
      }
    }
  }

  // Apply merged exclusion group choices.
  // Exclusion choices may reference tools outside the route-filtered set
  // (e.g., "Bun" at route "runtime:bun" when leaf route is "framework:nextjs").
  for (const [group, chosenTool] of Object.entries(mergedExclusions)) {
    // Add the chosen tool from the global dataset
    const globalTool = globalToolMap.get(chosenTool);
    if (globalTool) {
      toolMap.set(chosenTool, globalTool);
      included.add(chosenTool);
    }

    // Remove other members of the same exclusion group
    for (const [name, tool] of toolMap) {
      if (tool.exclusionGroup === group && name !== chosenTool) {
        included.delete(name);
      }
    }
  }

  // Resolve dependsOn chains transitively (also pulling from global dataset)
  let changed = true;
  while (changed) {
    changed = false;
    for (const toolName of [...included]) {
      const tool = toolMap.get(toolName) ?? globalToolMap.get(toolName);
      if (!tool) continue;
      for (const dep of tool.dependsOn) {
        if (!included.has(dep)) {
          const depTool = globalToolMap.get(dep);
          if (depTool) {
            toolMap.set(dep, depTool);
            included.add(dep);
            changed = true;
          }
        }
      }
    }
  }

  // Build final tool list from everything in the toolMap that's included
  const resolvedTools: DevStackEntry[] = [];
  for (const toolName of included) {
    const tool = toolMap.get(toolName);
    if (tool) resolvedTools.push(tool);
  }

  // Build dependency maps (placeholder — the dataset doesn't have version/package info,
  // so we leave these empty for now; templates will define deps directly)
  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {};

  return {
    leafId: leaf.id,
    route: leaf.route,
    additiveRoutes: additiveRoutes?.map((ar) => ar.route),
    platformKey: leaf.platformKey,
    tools: resolvedTools,
    dependencies,
    devDependencies,
    frameworkConfig: leaf.frameworkConfig,
  };
}
