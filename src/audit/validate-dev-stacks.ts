import * as fs from "node:fs";
import * as path from "node:path";
import type { DevStackEntry } from "../schema/dev-stacks";
import { devStacksFileSchema } from "../schema/dev-stacks";
import { detectCycle, getFeatureFlags } from "./shared";
import type { ValidationIssue, ValidationSeverity } from "./types";

/**
 * Validates `outputease-dev-stacks.json` against the Zod schema
 * and cross-field integrity rules (see RULE_COUNT below).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { ValidationIssue, ValidationSeverity };

export interface DevStacksValidationResult {
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
const RULE_COUNT = 24;

/** Application platform keys (excludes tooling for platform propagation checks). */
const APP_PLATFORMS = ["contentSite", "desktopApp", "mobileApp", "webApp"] as const;

/** Maps routes to the platform flag they require. */
const ROUTE_PLATFORM_RULES: Record<string, keyof DevStackEntry["platforms"]> = {
  "platform:tauri": "desktopApp",
  "platform:capacitor": "mobileApp",
  "framework:nextjs": "webApp",
  "framework:astro": "contentSite",
};

/** Maps bundles to their required route. */
const BUNDLE_ROUTE_RULES: Record<string, string> = {
  "tauri-core": "platform:tauri",
  "tauri-extended": "platform:tauri",
  "capacitor-core": "platform:capacitor",
  "capacitor-extended": "platform:capacitor",
  "supabase-suite": "backend:supabase",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run cross-field validation rules on parsed entries.
 * Every rule is deterministic (binary pass/fail, zero ambiguity).
 *
 * @internal Exported for unit testing.
 */
export function validateCrossField(entries: DevStackEntry[]): ValidationIssue[] {
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

  // Rule 2: Referential integrity (relatedTo + dependsOn)
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

  // Rule 3: Exclusion group minimum size (≥2 members)
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

  // Rule 4: has_* conditions must exist in featuresSchema
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

  // Rule 5: condition:"optional" → selectionMode:"selectable"
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

  // Rule 6: condition:"platform_default:*" → selectionMode:"always-included"
  for (const entry of entries) {
    if (
      entry.condition.startsWith("platform_default:") &&
      entry.selectionMode !== "always-included"
    ) {
      issues.push({
        rule: "platform-default-always-included",
        tool: entry.tool,
        details: `condition is "${entry.condition}" but selectionMode is "${entry.selectionMode}" (expected "always-included")`,
        severity: "error",
      });
    }
  }

  // Rule 7: Route-platform consistency
  for (const entry of entries) {
    const requiredPlatform = ROUTE_PLATFORM_RULES[entry.route];
    if (requiredPlatform && !entry.platforms[requiredPlatform]) {
      issues.push({
        rule: "route-platform",
        tool: entry.tool,
        details: `route "${entry.route}" requires platforms.${requiredPlatform} to be true`,
        severity: "error",
      });
    }
  }

  // Rule 8: Category-layer consistency
  for (const entry of entries) {
    if (entry.category === "template" && entry.layer !== "template") {
      issues.push({
        rule: "category-layer",
        tool: entry.tool,
        details: `category is "template" but layer is "${entry.layer}" (expected "template")`,
        severity: "error",
      });
    }
    if (entry.category === "template" && entry.url !== null) {
      issues.push({
        rule: "template-url-null",
        tool: entry.tool,
        details: 'category is "template" but url is not null',
        severity: "error",
      });
    }
    if (entry.category !== "template" && entry.url === null) {
      issues.push({
        rule: "non-template-url-required",
        tool: entry.tool,
        details: `category is "${entry.category}" but url is null (expected a URL)`,
        severity: "error",
      });
    }
  }

  // Rule 9: Bundle-route consistency
  for (const entry of entries) {
    if (entry.bundle) {
      const expectedRoute = BUNDLE_ROUTE_RULES[entry.bundle];
      if (expectedRoute && entry.route !== expectedRoute) {
        issues.push({
          rule: "bundle-route",
          tool: entry.tool,
          details: `bundle "${entry.bundle}" requires route "${expectedRoute}" but got "${entry.route}"`,
          severity: "error",
        });
      }
    }
  }

  // Rule 10: dependsOn route compatibility
  const toolRouteMap = new Map(entries.map((e) => [e.tool, e.route]));
  for (const entry of entries) {
    for (const dep of entry.dependsOn) {
      const depRoute = toolRouteMap.get(dep);
      if (depRoute && depRoute !== "base" && depRoute !== entry.route) {
        issues.push({
          rule: "dependsOn-route-compat",
          tool: entry.tool,
          details: `depends on "${dep}" (route "${depRoute}") which is incompatible with own route "${entry.route}"`,
          severity: "error",
        });
      }
    }
  }

  // Rule 11: Self-reference in relatedTo or dependsOn
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

  // Rule 12: Circular dependencies in dependsOn graph (DFS)
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

  // Rule 13: Duplicate entries within relatedTo or dependsOn arrays
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

  // Rule 14: All platforms false = unreachable tool
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

  // Rule 15: condition:"always" → valid selectionMode combination
  for (const entry of entries) {
    if (entry.condition === "always") {
      const isAlwaysIncluded = entry.selectionMode === "always-included";
      const isAutoWithGroup =
        entry.selectionMode === "auto-included" && entry.exclusionGroup !== null;
      if (!isAlwaysIncluded && !isAutoWithGroup) {
        issues.push({
          rule: "always-condition-selectionMode",
          tool: entry.tool,
          details:
            `condition is "always" but selectionMode is "${entry.selectionMode}"` +
            (entry.exclusionGroup === null ? " with no exclusionGroup" : "") +
            ' (expected "always-included" or "auto-included" with non-null exclusionGroup)',
          severity: "error",
        });
      }
    }
  }

  // Rule 16: priority:"required" + selectionMode:"selectable" contradiction
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

  // Rule 17: maturity:"beta" + priority:"required" contradiction
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

  // Rule 18: maturity:"beta" must have non-null agentNotes (error)
  // Schema documents beta as "experimental (requires agentNotes)" — this is a hard invariant.
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

  // Rule 19: dependsOn and relatedTo must not overlap (error)
  // dependsOn implies relatedness — duplicating in relatedTo causes agent confusion.
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

  // Rule 20: relatedTo symmetry — if A lists B in relatedTo, B must list A in relatedTo or dependsOn
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

  // Rule 21: dependsOn implies reverse relatedTo — if A dependsOn B, B must list A in relatedTo
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

  // Rule 22: selectionMode:"always-included" requires priority:"required"
  // "always-included" = mandatory (per schema). Mandatory tools must have priority:"required".
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

  // Rule 23: dependency platform coverage — if A dependsOn B, B's platforms must cover A's
  // Exempt when B is a tooling-only tool (tooling deps are platform-agnostic build tools).
  {
    const toolPlatforms = new Map(entries.map((e) => [e.tool, e.platforms]));
    for (const entry of entries) {
      for (const dep of entry.dependsOn) {
        const depPlatforms = toolPlatforms.get(dep);
        if (!depPlatforms) continue;
        // Skip if dependency is tooling-only (build tool — runs regardless of target platform)
        const depIsToolingOnly =
          depPlatforms.tooling &&
          !depPlatforms.webApp &&
          !depPlatforms.contentSite &&
          !depPlatforms.desktopApp &&
          !depPlatforms.mobileApp;
        if (depIsToolingOnly) continue;
        for (const platform of APP_PLATFORMS) {
          if (entry.platforms[platform] && !depPlatforms[platform]) {
            issues.push({
              rule: "dependency-platform-coverage",
              tool: entry.tool,
              details: `platforms.${platform} is true but dependency "${dep}" has ${platform}=false`,
              severity: "error",
            });
          }
        }
      }
    }
  }

  // Rule 24: unique URLs — non-null URLs must be unique across entries
  {
    const urlMap = new Map<string, string[]>();
    for (const entry of entries) {
      if (entry.url !== null) {
        const tools = urlMap.get(entry.url) ?? [];
        tools.push(entry.tool);
        urlMap.set(entry.url, tools);
      }
    }
    for (const [url, tools] of urlMap) {
      if (tools.length > 1) {
        for (const tool of tools) {
          issues.push({
            rule: "unique-urls",
            tool,
            details: `URL "${url}" is shared with: ${tools.filter((t) => t !== tool).join(", ")}`,
            severity: "error",
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Validate the dev stacks JSON file.
 *
 * @param filePath - Absolute path to `outputease-dev-stacks.json`
 * @returns Structured validation result
 */
export function validateDevStacks(filePath: string): DevStacksValidationResult {
  const raw = fs.readFileSync(filePath, "utf-8");
  const json = JSON.parse(raw);

  // Structural validation via Zod
  const parseResult = devStacksFileSchema.safeParse(json);

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
function printReport(result: DevStacksValidationResult): void {
  console.log("=== Dev Stacks Validation ===\n");
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
    path.resolve(import.meta.dirname ?? ".", "..", "..", "data", "dev-stacks.json");

  try {
    const result = validateDevStacks(filePath);
    printReport(result);
    process.exit(result.hasErrors ? 1 : 0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }
}
