import * as fs from "node:fs";
import * as path from "node:path";
import type { AgentStackEntry } from "../schema/agent-stacks";
import { agentStacksFileSchema } from "../schema/agent-stacks";
import { featuresSchema } from "../schema/config";
import type { ValidationIssue } from "./types";

/**
 * Validates `agent-stacks.json` against the Zod schema
 * and cross-field integrity rules (23 deterministic rules).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentStacksValidationResult {
  structuralErrors: string[];
  crossFieldIssues: ValidationIssue[];
  totalEntries: number;
  rulesChecked: number;
  hasErrors: boolean;
  hasWarnings: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Total number of cross-field rules executed. Update when adding rules. */
const RULE_COUNT = 23;

/** Maps tier numbers to their expected section names. */
const TIER_SECTION_MAP: Record<string, string> = {
  "1": "Core Workflow",
  "2": "Quality & Review",
  "3": "Development Tools",
  "4": "Infrastructure",
  "5": "Design",
  "6": "Observability",
  "7": "Setup",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract `has_*` keys from the features schema shape. */
function getFeatureFlags(): Set<string> {
  const shape = featuresSchema.shape;
  return new Set(Object.keys(shape).filter((k) => k.startsWith("has_")));
}

/**
 * Run cross-field validation rules on parsed entries.
 * Every rule is deterministic (binary pass/fail, zero ambiguity).
 *
 * @internal Exported for unit testing.
 */
export function validateCrossField(entries: AgentStackEntry[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const toolNames = new Set(entries.map((e) => e.tool));
  const featureFlags = getFeatureFlags();

  // Rule 1: Unique tool names
  const seen = new Map<string, number>();
  for (const entry of entries) {
    const count = (seen.get(entry.tool) ?? 0) + 1;
    seen.set(entry.tool, count);
    if (count === 2) {
      issues.push({
        rule: "unique-tool-names",
        tool: entry.tool,
        details: `Duplicate tool name: "${entry.tool}"`,
        severity: "error",
      });
    }
  }

  // Rule 2: Referential integrity (relatedTo)
  for (const entry of entries) {
    for (const ref of entry.relatedTo) {
      if (!toolNames.has(ref)) {
        issues.push({
          rule: "relatedTo-ref",
          tool: entry.tool,
          details: `relatedTo references unknown tool: "${ref}"`,
          severity: "error",
        });
      }
    }
  }

  // Rule 3: Referential integrity (dependsOn)
  for (const entry of entries) {
    for (const ref of entry.dependsOn) {
      if (!toolNames.has(ref)) {
        issues.push({
          rule: "dependsOn-ref",
          tool: entry.tool,
          details: `dependsOn references unknown tool: "${ref}"`,
          severity: "error",
        });
      }
    }
  }

  // Rule 4: Exclusion group minimum size (≥2 members)
  const groupMembers = new Map<string, string[]>();
  for (const entry of entries) {
    if (entry.exclusionGroup) {
      const members = groupMembers.get(entry.exclusionGroup) ?? [];
      members.push(entry.tool);
      groupMembers.set(entry.exclusionGroup, members);
    }
  }
  for (const [group, members] of groupMembers) {
    if (members.length < 2) {
      issues.push({
        rule: "exclusion-group-size",
        tool: members[0] ?? group,
        details: `Exclusion group "${group}" has only ${members.length} member(s): [${members.join(", ")}]`,
        severity: "error",
      });
    }
  }

  // Rule 5: has_* conditions must exist in featuresSchema
  for (const entry of entries) {
    if (entry.condition.startsWith("has_") && !featureFlags.has(entry.condition)) {
      issues.push({
        rule: "condition-feature-alignment",
        tool: entry.tool,
        details: `Condition "${entry.condition}" not found in featuresSchema`,
        severity: "error",
      });
    }
  }

  // Rule 6: condition:"optional" → selectionMode:"selectable"
  for (const entry of entries) {
    if (entry.condition === "optional" && entry.selectionMode !== "selectable") {
      issues.push({
        rule: "optional-selectable",
        tool: entry.tool,
        details: `condition is "optional" but selectionMode is "${entry.selectionMode}" (expected "selectable")`,
        severity: "error",
      });
    }
  }

  // Rule 7: Self-reference in relatedTo or dependsOn
  for (const entry of entries) {
    if (entry.relatedTo.includes(entry.tool)) {
      issues.push({
        rule: "no-self-relatedTo",
        tool: entry.tool,
        details: `relatedTo contains self-reference "${entry.tool}"`,
        severity: "error",
      });
    }
    if (entry.dependsOn.includes(entry.tool)) {
      issues.push({
        rule: "no-self-dependsOn",
        tool: entry.tool,
        details: `dependsOn contains self-reference "${entry.tool}"`,
        severity: "error",
      });
    }
  }

  // Rule 8: Circular dependencies in dependsOn graph (DFS)
  {
    const depGraph = new Map<string, string[]>();
    for (const entry of entries) {
      depGraph.set(entry.tool, entry.dependsOn);
    }
    const reportedCycles = new Set<string>();
    const globalVisited = new Set<string>();

    for (const entry of entries) {
      const cycle = detectCycle(entry.tool, depGraph, globalVisited);
      if (cycle) {
        const cycleKey = [...cycle].sort().join(",");
        if (!reportedCycles.has(cycleKey)) {
          reportedCycles.add(cycleKey);
          issues.push({
            rule: "no-circular-dependsOn",
            tool: entry.tool,
            details: `Circular dependency: ${cycle.join(" -> ")}`,
            severity: "error",
          });
        }
      }
    }
  }

  // Rule 9: Duplicate entries within relatedTo or dependsOn arrays
  for (const entry of entries) {
    const relatedDupes = entry.relatedTo.filter(
      (item, idx) => entry.relatedTo.indexOf(item) !== idx,
    );
    for (const dupe of new Set(relatedDupes)) {
      issues.push({
        rule: "no-duplicate-relatedTo",
        tool: entry.tool,
        details: `relatedTo contains duplicate: "${dupe}"`,
        severity: "error",
      });
    }
    const depDupes = entry.dependsOn.filter((item, idx) => entry.dependsOn.indexOf(item) !== idx);
    for (const dupe of new Set(depDupes)) {
      issues.push({
        rule: "no-duplicate-dependsOn",
        tool: entry.tool,
        details: `dependsOn contains duplicate: "${dupe}"`,
        severity: "error",
      });
    }
  }

  // Rule 10: All platforms false = unreachable tool
  for (const entry of entries) {
    const { contentSite, desktopApp, mobileApp, webApp, tooling } = entry.platforms;
    if (!contentSite && !desktopApp && !mobileApp && !webApp && !tooling) {
      issues.push({
        rule: "reachable-platforms",
        tool: entry.tool,
        details: "All platforms are false; tool is unreachable",
        severity: "error",
      });
    }
  }

  // Rule 11: priority:"required" + selectionMode:"selectable" contradiction
  for (const entry of entries) {
    if (entry.priority === "required" && entry.selectionMode === "selectable") {
      issues.push({
        rule: "required-not-selectable",
        tool: entry.tool,
        details: 'priority is "required" but selectionMode is "selectable" (contradictory)',
        severity: "error",
      });
    }
  }

  // Rule 12: maturity:"beta" + priority:"required" contradiction
  for (const entry of entries) {
    if (entry.maturity === "beta" && entry.priority === "required") {
      issues.push({
        rule: "beta-not-required",
        tool: entry.tool,
        details: 'maturity is "beta" but priority is "required" (contradictory)',
        severity: "error",
      });
    }
  }

  // Rule 13: maturity:"beta" must have non-null agentNotes
  for (const entry of entries) {
    if (entry.maturity === "beta" && entry.agentNotes === null) {
      issues.push({
        rule: "beta-needs-agentNotes",
        tool: entry.tool,
        details:
          'maturity is "beta" but agentNotes is null (required to document beta justification)',
        severity: "error",
      });
    }
  }

  // Rule 14: dependsOn and relatedTo must not overlap
  for (const entry of entries) {
    const overlap = entry.dependsOn.filter((dep) => entry.relatedTo.includes(dep));
    for (const item of overlap) {
      issues.push({
        rule: "dependsOn-relatedTo-disjoint",
        tool: entry.tool,
        details: `"${item}" appears in both dependsOn and relatedTo (dependsOn is sufficient)`,
        severity: "error",
      });
    }
  }

  // Rule 15: relatedTo symmetry
  {
    const toolRelatedTo = new Map(entries.map((e) => [e.tool, new Set(e.relatedTo)]));
    const toolDependsOn = new Map(entries.map((e) => [e.tool, new Set(e.dependsOn)]));
    for (const entry of entries) {
      for (const ref of entry.relatedTo) {
        const refRelated = toolRelatedTo.get(ref);
        const refDeps = toolDependsOn.get(ref);
        if (refRelated && !refRelated.has(entry.tool) && refDeps && !refDeps.has(entry.tool)) {
          issues.push({
            rule: "relatedTo-symmetry",
            tool: entry.tool,
            details: `relatedTo lists "${ref}" but "${ref}" does not list "${entry.tool}" in relatedTo or dependsOn`,
            severity: "error",
          });
        }
      }
    }
  }

  // Rule 16: dependsOn implies reverse relatedTo
  {
    const toolRelatedTo = new Map(entries.map((e) => [e.tool, new Set(e.relatedTo)]));
    for (const entry of entries) {
      for (const dep of entry.dependsOn) {
        const depRelated = toolRelatedTo.get(dep);
        if (depRelated && !depRelated.has(entry.tool)) {
          issues.push({
            rule: "dependsOn-reverse-relatedTo",
            tool: entry.tool,
            details: `dependsOn "${dep}" but "${dep}" does not list "${entry.tool}" in relatedTo`,
            severity: "error",
          });
        }
      }
    }
  }

  // Rule 17: selectionMode:"always-included" requires priority:"required"
  for (const entry of entries) {
    if (entry.selectionMode === "always-included" && entry.priority !== "required") {
      issues.push({
        rule: "always-included-requires-required",
        tool: entry.tool,
        details: `selectionMode is "always-included" (mandatory) but priority is "${entry.priority}" (expected "required")`,
        severity: "error",
      });
    }
  }

  // --- Agent-specific rules ---

  // Rule 18: hasMcp=true requires non-null mcpConfig
  for (const entry of entries) {
    if (entry.hasMcp && entry.mcpConfig === null && entry.category === "mcp-server") {
      issues.push({
        rule: "hasMcp-needs-mcpConfig",
        tool: entry.tool,
        details: 'hasMcp is true and category is "mcp-server" but mcpConfig is null',
        severity: "error",
      });
    }
  }

  // Rule 19: mcpConfig non-null requires hasMcp=true
  for (const entry of entries) {
    if (entry.mcpConfig !== null && !entry.hasMcp) {
      issues.push({
        rule: "mcpConfig-needs-hasMcp",
        tool: entry.tool,
        details: "mcpConfig is defined but hasMcp is false",
        severity: "error",
      });
    }
  }

  // Rule 20: category:"mcp-server" requires hasMcp=true
  for (const entry of entries) {
    if (entry.category === "mcp-server" && !entry.hasMcp) {
      issues.push({
        rule: "category-mcp-consistency",
        tool: entry.tool,
        details: 'category is "mcp-server" but hasMcp is false',
        severity: "error",
      });
    }
  }

  // Rule 21: tier-section consistency
  for (const entry of entries) {
    const expectedSection = TIER_SECTION_MAP[entry.tier];
    if (expectedSection && entry.section !== expectedSection) {
      issues.push({
        rule: "tier-section-consistency",
        tool: entry.tool,
        details: `tier "${entry.tier}" expects section "${expectedSection}" but got "${entry.section}"`,
        severity: "error",
      });
    }
  }

  // Rule 22: installCommand must match category
  for (const entry of entries) {
    if (entry.category === "plugin" && !entry.installCommand.startsWith("claude plugin install")) {
      issues.push({
        rule: "installCommand-category",
        tool: entry.tool,
        details: `category is "plugin" but installCommand does not start with "claude plugin install"`,
        severity: "error",
      });
    }
    if (entry.category === "mcp-server" && !entry.installCommand.startsWith("claude mcp add")) {
      issues.push({
        rule: "installCommand-category",
        tool: entry.tool,
        details: `category is "mcp-server" but installCommand does not start with "claude mcp add"`,
        severity: "error",
      });
    }
  }

  // Rule 23: requiresAuth=true should have agentNotes documenting auth requirements (warning)
  for (const entry of entries) {
    if (entry.requiresAuth && entry.agentNotes === null) {
      issues.push({
        rule: "requiresAuth-agentNotes",
        tool: entry.tool,
        details: "requiresAuth is true but agentNotes is null (should document auth requirements)",
        severity: "warning",
      });
    }
  }

  return issues;
}

/** DFS cycle detection helper for Rule 8. */
function detectCycle(
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

/**
 * Validate the agent stacks JSON file.
 *
 * @param filePath - Absolute path to `agent-stacks.json`
 * @returns Structured validation result
 */
export function validateAgentStacks(filePath: string): AgentStacksValidationResult {
  const raw = fs.readFileSync(filePath, "utf-8");
  const json = JSON.parse(raw);

  // Structural validation via Zod
  const parseResult = agentStacksFileSchema.safeParse(json);

  if (!parseResult.success) {
    const structuralErrors = parseResult.error.issues.map((issue) => {
      const issuePath = issue.path.join(".");
      return `[${issuePath}] ${issue.message}`;
    });

    return {
      structuralErrors,
      crossFieldIssues: [],
      totalEntries: Array.isArray(json) ? json.length : 0,
      rulesChecked: 0,
      hasErrors: true,
      hasWarnings: false,
    };
  }

  // Cross-field validation on parsed data
  const entries = parseResult.data;
  const crossFieldIssues = validateCrossField(entries);
  const errors = crossFieldIssues.filter((i) => i.severity === "error");
  const warnings = crossFieldIssues.filter((i) => i.severity === "warning");

  return {
    structuralErrors: [],
    crossFieldIssues,
    totalEntries: entries.length,
    rulesChecked: RULE_COUNT,
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0,
  };
}

/** Print a human-readable report to stdout. */
function printReport(result: AgentStacksValidationResult): void {
  console.log("=== Agent Stacks Validation ===\n");
  console.log(`Entries: ${result.totalEntries}`);
  console.log(`Rules checked: ${result.rulesChecked}\n`);

  if (result.structuralErrors.length > 0) {
    console.log(`STRUCTURAL ERRORS (${result.structuralErrors.length}):`);
    for (const err of result.structuralErrors) {
      console.log(`  ${err}`);
    }
    console.log();
  }

  const errors = result.crossFieldIssues.filter((i) => i.severity === "error");
  const warnings = result.crossFieldIssues.filter((i) => i.severity === "warning");

  if (errors.length > 0) {
    console.log(`ERRORS (${errors.length}):`);
    for (const issue of errors) {
      console.log(`  [${issue.rule}] ${issue.tool}: ${issue.details}`);
    }
    console.log();
  }

  if (warnings.length > 0) {
    console.log(`WARNINGS (${warnings.length}):`);
    for (const issue of warnings) {
      console.log(`  [${issue.rule}] ${issue.tool}: ${issue.details}`);
    }
    console.log();
  }

  if (!result.hasErrors && !result.hasWarnings) {
    console.log("OK: All validation rules pass.");
  } else if (!result.hasErrors) {
    console.log(`OK: ${warnings.length} warning(s), 0 errors.`);
  } else {
    const total = result.structuralErrors.length + errors.length;
    console.log(`FAILED: ${total} error(s), ${warnings.length} warning(s).`);
  }
}

// CLI mode
if (import.meta.main) {
  const filePath =
    process.argv[2] ??
    path.resolve(import.meta.dirname ?? ".", "..", "..", "data", "agent-stacks.json");

  try {
    const result = validateAgentStacks(filePath);
    printReport(result);
    process.exit(result.hasErrors ? 1 : 0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }
}
