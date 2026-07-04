#!/usr/bin/env bun
/**
 * Build-time validation: walk all possible decision tree paths
 * and verify each terminates at a valid leaf with a resolvable stack.
 * Also validates additive route combinations for each leaf.
 */
import { resolveStack } from "../scaffold/context";
import { ADDITIVE_QUESTIONS } from "./additive-routes";
import { DECISION_TREE, DECISION_TREE_LEAVES } from "./definition";
import { listPresets } from "./presets";
import { type AdditiveRouteConfig, type DecisionTreeNode, presetSchema } from "./schema";
import { findLeafByPath } from "./traversal";

interface ValidationResult {
  path: string[];
  leafId: string | null;
  error?: string;
}

function getNodeById(id: string): DecisionTreeNode | undefined {
  return DECISION_TREE.find((n) => n.id === id);
}

function walkAllPaths(nodeId: string, currentPath: string[], results: ValidationResult[]): void {
  const node = getNodeById(nodeId);
  if (!node) {
    results.push({ path: currentPath, leafId: null, error: `Node "${nodeId}" not found` });
    return;
  }

  for (const option of node.options) {
    const stepPath = [...currentPath, `${node.id}=${option.value}`];

    if (option.disabled) continue;

    if (option.next === null) {
      // Terminal — verify leaf exists and stack resolves
      const leaf = DECISION_TREE_LEAVES[option.value];
      if (!leaf) {
        results.push({
          path: stepPath,
          leafId: null,
          error: `No leaf for terminal option "${option.value}"`,
        });
        continue;
      }

      try {
        const stack = resolveStack(leaf);
        if (stack.tools.length === 0) {
          results.push({
            path: stepPath,
            leafId: leaf.id,
            error: "Stack resolved to zero tools",
          });
        } else {
          results.push({ path: stepPath, leafId: leaf.id });
        }
      } catch (err) {
        results.push({
          path: stepPath,
          leafId: leaf.id,
          error: `Stack resolution failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    } else {
      walkAllPaths(option.next, stepPath, results);
    }
  }
}

// Run validation when executed directly
const results: ValidationResult[] = [];
const rootId = DECISION_TREE[0]?.id;
if (!rootId) {
  console.error("ERROR: Decision tree has no root node");
  process.exit(1);
}

walkAllPaths(rootId, [], results);

// Validate additive route combinations for each unique leaf
const testedLeaves = new Set<string>();
for (const r of results) {
  if (r.leafId && !r.error) testedLeaves.add(r.leafId);
}

const additiveResults: ValidationResult[] = [];
for (const leafKey of Object.keys(DECISION_TREE_LEAVES)) {
  const leaf = DECISION_TREE_LEAVES[leafKey];
  if (!leaf || !testedLeaves.has(leaf.id)) continue;

  // Build all applicable additive route combos for this leaf
  const applicableCombos: AdditiveRouteConfig[][] = [[]]; // start with no additive routes
  for (const question of ADDITIVE_QUESTIONS) {
    if (!question.applicablePlatforms.has(leaf.platformKey)) continue;
    const newCombos: AdditiveRouteConfig[][] = [];
    for (const existing of applicableCombos) {
      // Option: skip this question
      newCombos.push(existing);
      // Option: each non-null config
      for (const opt of question.options) {
        if (opt.config) {
          newCombos.push([...existing, opt.config]);
        }
      }
    }
    applicableCombos.length = 0;
    applicableCombos.push(...newCombos);
  }

  // Skip the empty combo (already tested by base tree walk)
  for (const combo of applicableCombos) {
    if (combo.length === 0) continue;
    const comboLabel = combo.map((c) => c.route).join("+");
    const pathDesc = [`leaf=${leaf.id}`, `additive=${comboLabel}`];

    try {
      const stack = resolveStack(leaf, combo);
      if (stack.tools.length === 0) {
        additiveResults.push({
          path: pathDesc,
          leafId: leaf.id,
          error: "Stack resolved to zero tools",
        });
      } else {
        additiveResults.push({ path: pathDesc, leafId: leaf.id });
      }
    } catch (err) {
      additiveResults.push({
        path: pathDesc,
        leafId: leaf.id,
        error: `Stack resolution failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}

// Validate every preset: schema-valid, leaf resolves, and the resolved stack
// (with the preset's additive routes) is non-empty. Closes the gap where a
// preset with a mistyped leafId or a no-op exclusionOverrides shipped unchecked.
const presetResults: ValidationResult[] = [];
for (const preset of listPresets()) {
  const pathDesc = [`preset=${preset.name}`, `leaf=${preset.leafId}`];
  const parsed = presetSchema.safeParse(preset);
  if (!parsed.success) {
    presetResults.push({
      path: pathDesc,
      leafId: null,
      error: `Preset failed schema validation: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    });
    continue;
  }
  const leaf = findLeafByPath(preset.leafId) ?? DECISION_TREE_LEAVES[preset.leafId];
  if (!leaf) {
    presetResults.push({
      path: pathDesc,
      leafId: null,
      error: `Preset references unknown leaf "${preset.leafId}"`,
    });
    continue;
  }
  try {
    const stack = resolveStack(leaf, preset.additiveRoutes);
    if (stack.tools.length === 0) {
      presetResults.push({
        path: pathDesc,
        leafId: leaf.id,
        error: "Stack resolved to zero tools",
      });
    } else {
      presetResults.push({ path: pathDesc, leafId: leaf.id });
    }
  } catch (err) {
    presetResults.push({
      path: pathDesc,
      leafId: leaf.id,
      error: `Stack resolution failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

const allResults = [...results, ...additiveResults, ...presetResults];
const errors = allResults.filter((r) => r.error);
const valid = allResults.filter((r) => !r.error);

console.log(`Decision tree validation: ${valid.length} valid paths, ${errors.length} errors`);
console.log(
  `  (${results.length - results.filter((r) => r.error).length} base paths + ${additiveResults.length - additiveResults.filter((r) => r.error).length} additive combos)`,
);

for (const result of valid) {
  console.log(`  OK: ${result.path.join(" > ")} → ${result.leafId}`);
}

for (const result of errors) {
  console.error(`  ERROR: ${result.path.join(" > ")} — ${result.error}`);
}

if (errors.length > 0) {
  process.exit(1);
}
