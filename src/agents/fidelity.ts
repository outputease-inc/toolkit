import type { AgentTarget } from "../schema/agent-targets";
import type { NeutralSkillFile, SourceModel } from "./source";
import type { FidelityReport, FidelityRow } from "./source-schemas";
import {
  CODEX_WORKFLOW_GUIDE_REQUIRED_FRAGMENTS,
  isCodexRequiredWorkflow,
} from "./workflow-contract";

/**
 * Fidelity classification (spec 008, R13, data-model §6). For every target,
 * classifies each neutral skill plus one instructions row and one mcp row; for
 * the claude target it also lists the integration-owned passthrough skills,
 * and target passthrough trees are reported on their owning targets as well.
 * Claude also gets the Claude-scoped asset classes. Deterministic (rows sorted)
 * so the emitted report is byte-stable.
 *
 * Completeness invariant (FR-011/SC-004): every NeutralSkill × every target
 * appears exactly once. Externally installed assets never appear (FR-013) —
 * only the neutral source and the migrated target passthrough trees are
 * considered.
 */

/** Claude-only passthrough asset classes reported once each under the claude target. */
export const ASSET_CLASSES = [
  "docs",
  "hooks",
  "plugin-install-scripts",
  "settings",
  "subagents",
] as const;

function instructionsRow(target: AgentTarget): FidelityRow {
  if (target.id === "claude") {
    return { item: "instructions", tier: "clean", reason: "CLAUDE.md (core + claude blocks)" };
  }
  const support = target.instructions.agentsMdSupport;
  if (support === "native") {
    return { item: "instructions", tier: "clean", reason: "reads AGENTS.md natively" };
  }
  if (support === "bridge") {
    return {
      item: "instructions",
      tier: "clean",
      reason: `bridged via ${target.instructions.bridge?.file ?? "settings"}`,
    };
  }
  return {
    item: "instructions",
    tier: "unplaceable",
    reason: "no AGENTS.md support and no bridge",
  };
}

function mcpRow(target: AgentTarget): FidelityRow {
  if (target.mcp.emit) {
    return { item: "mcp", tier: "clean", reason: `emits ${target.mcp.emit.path}` };
  }
  if (target.mcp.userGlobal) {
    return {
      item: "mcp",
      tier: "degraded",
      reason: `user-global only (${target.mcp.userGlobal.path}); apply required`,
    };
  }
  return { item: "mcp", tier: "unplaceable", reason: target.notes ?? "no MCP config target" };
}

function hasCodexWorkflowGuide(files: SourceModel["codexPassthrough"]): boolean {
  const guide = files.find((file) => file.relPath === "README.md");
  return (
    guide !== undefined &&
    CODEX_WORKFLOW_GUIDE_REQUIRED_FRAGMENTS.every((fragment) => guide.content.includes(fragment))
  );
}

function hasCodexSkillAdapter(files: SourceModel["codexPassthrough"], skillName: string): boolean {
  return files.some((file) => file.relPath === `skills/${skillName}/SKILL.md`);
}

function skillRow(skill: NeutralSkillFile, target: AgentTarget, source: SourceModel): FidelityRow {
  const item = skill.dirName;
  const scopedTo = skill.frontmatter.targets;
  if (scopedTo && !scopedTo.includes(target.id)) {
    return { item, tier: "skipped", reason: `scoped to ${scopedTo.join(", ")}` };
  }
  if (target.id === "claude") {
    return { item, tier: "clean", reason: "copied to .claude/skills (all keys honored)" };
  }
  if (target.id === "codex" && isCodexRequiredWorkflow(skill.dirName)) {
    if (hasCodexSkillAdapter(source.codexPassthrough, skill.dirName)) {
      return {
        item,
        tier: "target-native",
        reason: "Codex target owns a native adapter for this workflow",
      };
    }
  }
  if (skill.frontmatter.args === "substituted") {
    if (target.id === "codex" && isCodexRequiredWorkflow(skill.dirName)) {
      if (hasCodexWorkflowGuide(source.codexPassthrough)) {
        return {
          item,
          tier: "target-native",
          reason: "Codex workflow guide adapts substituted arguments to trailing text",
        };
      }
    }
    if (target.skills.wrapper) {
      return { item, tier: "clean", reason: `arg wrapper in ${target.skills.wrapper.dir}` };
    }
    return {
      item,
      tier: "degraded",
      reason: "args arrive as trailing free text (no substitution)",
    };
  }
  return { item, tier: "clean", reason: "read in place from .agents/skills" };
}

function passthroughSkillNames(files: SourceModel["claudePassthrough"]): string[] {
  const names = new Set<string>();
  for (const file of files) {
    const match = file.relPath.match(/^skills\/([^/]+)\/SKILL\.md$/);
    if (match?.[1]) names.add(match[1]);
  }
  return [...names].sort();
}

export function classifyFidelity(source: SourceModel, targets: AgentTarget[]): FidelityReport {
  const perTarget: Record<string, FidelityRow[]> = {};
  const neutralSkillNames = new Set(source.skills.map((skill) => skill.dirName));
  for (const target of targets) {
    const rows: FidelityRow[] = [instructionsRow(target), mcpRow(target)];
    for (const skill of source.skills) rows.push(skillRow(skill, target, source));
    if (target.id === "claude") {
      for (const name of passthroughSkillNames(source.claudePassthrough)) {
        rows.push({
          item: name,
          tier: "integration-owned",
          reason: "owned by a spec-kit integration/extension manifest",
        });
      }
      for (const cls of ASSET_CLASSES) {
        rows.push({ item: cls, tier: "claude-scoped", reason: "Claude-only passthrough asset" });
      }
    }
    if (target.id === "codex") {
      for (const name of passthroughSkillNames(source.codexPassthrough)) {
        if (neutralSkillNames.has(name)) continue;
        rows.push({
          item: name,
          tier: isCodexRequiredWorkflow(name) ? "target-native" : "integration-owned",
          reason: isCodexRequiredWorkflow(name)
            ? "Codex target owns a native adapter for this workflow"
            : "Codex target owns this passthrough skill",
        });
      }
    }
    rows.sort((a, b) => (a.item < b.item ? -1 : a.item > b.item ? 1 : 0));
    perTarget[target.id] = rows;
  }
  return { perTarget };
}

/** Human-readable FIDELITY.md (committed alongside fidelity-report.json). */
export function renderFidelityMd(report: FidelityReport, targets: AgentTarget[]): string {
  const lines: string[] = [
    "# Fidelity Report",
    "",
    "Per-target translation fidelity of the neutral source.",
    "Tiers: clean, target-native, degraded, skipped, claude-scoped, integration-owned, unplaceable.",
    "",
  ];
  for (const target of targets) {
    const rows = report.perTarget[target.id] ?? [];
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.tier, (counts.get(row.tier) ?? 0) + 1);
    const summary = [...counts.entries()]
      .sort()
      .map(([tier, n]) => `${tier} ${n}`)
      .join(", ");
    lines.push(
      `## ${target.displayName} (${target.id})`,
      "",
      summary,
      "",
      "| Item | Tier | Reason |",
      "|------|------|--------|",
    );
    for (const row of rows) lines.push(`| ${row.item} | ${row.tier} | ${row.reason} |`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
