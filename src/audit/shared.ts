import { featuresSchema } from "../schema/config";

/**
 * Helpers shared by the dev-stacks and agent-stacks validators (previously
 * duplicated byte-for-byte in both files).
 */

/** Extract `has_*` keys from the features schema shape. */
export function getFeatureFlags(): Set<string> {
  const shape = featuresSchema.shape;
  return new Set(Object.keys(shape).filter((k) => k.startsWith("has_")));
}

/** DFS cycle detection over a dependency graph. Returns the cycle path or null. */
export function detectCycle(
  start: string,
  graph: Map<string, string[]>,
  globalVisited: Set<string>,
): string[] | null {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const nodePath: string[] = [];

  function dfs(node: string): string[] | null {
    if (stack.has(node)) {
      const cycleStart = nodePath.indexOf(node);
      return nodePath.slice(cycleStart).concat(node);
    }
    if (visited.has(node) || globalVisited.has(node)) return null;
    visited.add(node);
    stack.add(node);
    nodePath.push(node);
    for (const dep of graph.get(node) ?? []) {
      const cycle = dfs(dep);
      if (cycle) return cycle;
    }
    stack.delete(node);
    nodePath.pop();
    return null;
  }

  const result = dfs(start);
  for (const v of visited) {
    globalVisited.add(v);
  }
  return result;
}
