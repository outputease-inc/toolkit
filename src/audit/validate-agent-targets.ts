import * as fs from "node:fs";
import * as path from "node:path";
import { KNOWN_FAMILIES } from "../agents/emitters";
import type { AgentTarget } from "../schema/agent-targets";
import { agentTargetsFileSchema } from "../schema/agent-targets";
import type { ValidationIssue } from "./types";

/**
 * Validates `agent-targets.json` against the Zod schema and the cross-field
 * integrity rules (spec 008, contracts/agent-targets-schema.md). Mirrors the
 * agent-stacks validator: structural parse, then deterministic cross-field rules.
 *
 * The `tool` field of each issue carries the target `id`.
 */

export interface AgentTargetsValidationResult {
  structuralErrors: string[];
  crossFieldIssues: ValidationIssue[];
  totalEntries: number;
  rulesChecked: number;
  hasErrors: boolean;
  hasWarnings: boolean;
}

/** Total number of cross-field rules executed. Update when adding rules. */
const RULE_COUNT = 9;

/** Freshness threshold (validator tier). The staleness-audit skill warns earlier (90d). */
const FRESHNESS_DAYS = 180;

/** Every EmitterFamily referenced by an entry, across all ref-bearing fields. */
function referencedFamilies(entry: AgentTarget): string[] {
  const families: string[] = [];
  if (entry.instructions.bridge) families.push(entry.instructions.bridge.emitter);
  if (entry.instructions.addendum) families.push(entry.instructions.addendum.emitter);
  if (entry.mcp.emit) families.push(entry.mcp.emit.family);
  if (entry.mcp.userGlobal) families.push(entry.mcp.userGlobal.family);
  if (entry.skills.wrapper) families.push(entry.skills.wrapper.family);
  return families;
}

/**
 * Run cross-field validation rules on parsed entries.
 * Every rule is deterministic (binary pass/fail).
 *
 * @internal Exported for unit testing.
 */
export function validateCrossField(entries: AgentTarget[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Rule 1: unique-target-ids
  {
    const seen = new Map<string, number>();
    for (const entry of entries) {
      const count = (seen.get(entry.id) ?? 0) + 1;
      seen.set(entry.id, count);
      if (count === 2) {
        issues.push({
          rule: "unique-target-ids",
          tool: entry.id,
          details: `Duplicate target id: "${entry.id}"`,
          severity: "error",
        });
      }
    }
  }

  for (const entry of entries) {
    // Rule 2: bridge-when-bridged
    if (entry.instructions.agentsMdSupport === "bridge" && entry.instructions.bridge === null) {
      issues.push({
        rule: "bridge-when-bridged",
        tool: entry.id,
        details: 'agentsMdSupport is "bridge" but instructions.bridge is null',
        severity: "error",
      });
    }

    // Rule 3: wrapper-when-substituted
    if (entry.skills.argPlaceholder === "{{args}}" && entry.skills.wrapper === null) {
      issues.push({
        rule: "wrapper-when-substituted",
        tool: entry.id,
        details: 'skills.argPlaceholder is "{{args}}" but skills.wrapper is null',
        severity: "error",
      });
    }

    // Rule 4: mcp-somewhere (warning)
    if (entry.mcp.emit === null && entry.mcp.userGlobal === null && entry.notes === null) {
      issues.push({
        rule: "mcp-somewhere",
        tool: entry.id,
        details:
          "mcp.emit and mcp.userGlobal are both null and notes is null (explain why MCP is unplaceable)",
        severity: "warning",
      });
    }

    // Rule 5: family-known
    for (const family of referencedFamilies(entry)) {
      if (!KNOWN_FAMILIES.has(family as never)) {
        issues.push({
          rule: "family-known",
          tool: entry.id,
          details: `references unknown EmitterFamily "${family}" (no registered emitter)`,
          severity: "error",
        });
      }
    }

    // Rule 6: skills-delivery-exclusive (exactly one delivery path)
    const readsInPlace = entry.skills.readsAgentsSkillsDir;
    const copies = entry.skills.copyPath !== null;
    if (readsInPlace === copies) {
      issues.push({
        rule: "skills-delivery-exclusive",
        tool: entry.id,
        details: `exactly one of readsAgentsSkillsDir / copyPath must be set (got readsAgentsSkillsDir=${readsInPlace}, copyPath=${entry.skills.copyPath === null ? "null" : "set"})`,
        severity: "error",
      });
    }

    // Rule 7: docs-present
    if (entry.docsUrl.length === 0) {
      issues.push({
        rule: "docs-present",
        tool: entry.id,
        details: "docsUrl is empty (at least one https docs URL required)",
        severity: "error",
      });
    }

    // Rule 8: asof-fresh (warning)
    const asOfMs = Date.parse(entry.asOf);
    if (!Number.isNaN(asOfMs)) {
      const ageDays = (Date.now() - asOfMs) / 86_400_000;
      if (ageDays > FRESHNESS_DAYS) {
        issues.push({
          rule: "asof-fresh",
          tool: entry.id,
          details: `asOf ${entry.asOf} is ${Math.floor(ageDays)}d old (>${FRESHNESS_DAYS}d; re-verify vendor facts)`,
          severity: "warning",
        });
      }
    }

    // Rule 9: char-limit-positive (descriptionCharLimit + addendum.charLimit)
    const descLimit = entry.skills.descriptionCharLimit;
    if (descLimit !== null && descLimit <= 0) {
      issues.push({
        rule: "char-limit-positive",
        tool: entry.id,
        details: `skills.descriptionCharLimit must be > 0 (got ${descLimit})`,
        severity: "error",
      });
    }
    const addLimit = entry.instructions.addendum?.charLimit;
    if (addLimit !== undefined && addLimit <= 0) {
      issues.push({
        rule: "char-limit-positive",
        tool: entry.id,
        details: `instructions.addendum.charLimit must be > 0 (got ${addLimit})`,
        severity: "error",
      });
    }
  }

  return issues;
}

/**
 * Validate the agent-targets JSON file.
 *
 * @param filePath - Absolute path to `agent-targets.json`
 */
export function validateAgentTargets(filePath: string): AgentTargetsValidationResult {
  const raw = fs.readFileSync(filePath, "utf-8");
  const json = JSON.parse(raw);

  const parseResult = agentTargetsFileSchema.safeParse(json);

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
function printReport(result: AgentTargetsValidationResult): void {
  console.log("=== Agent Targets Validation ===\n");
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
    path.resolve(import.meta.dirname ?? ".", "..", "..", "data", "agent-targets.json");

  try {
    const result = validateAgentTargets(filePath);
    printReport(result);
    process.exit(result.hasErrors ? 1 : 0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }
}
