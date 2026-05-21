import { describe, expect, test } from "bun:test";
import * as path from "node:path";
import type { AgentStackEntry } from "../schema/agent-stacks";
import { validateAgentStacks, validateCrossField } from "./validate-agent-stacks";

/** Factory: creates a minimal valid agent-stack entry with overrides. */
function makeEntry(overrides: Partial<AgentStackEntry> = {}): AgentStackEntry {
  return {
    tool: "test-tool",
    purpose: "Test purpose",
    role: "Plugin",
    route: "base",
    section: "Core Workflow",
    category: "plugin",
    layer: "agent",
    maturity: "stable",
    condition: "always",
    platforms: {
      contentSite: true,
      desktopApp: true,
      mobileApp: true,
      webApp: true,
      tooling: true,
    },
    url: "https://example.com",
    hasMcp: false,
    relatedTo: [],
    dependsOn: [],
    selectionMode: "always-included",
    exclusionGroup: null,
    bundle: null,
    priority: "required",
    agentNotes: null,
    tier: "1",
    installCommand: "claude plugin install test-tool@claude-plugins-official",
    componentCounts: { commands: 0, skills: 0, agents: 0, hooks: 0 },
    mcpConfig: null,
    requiresAuth: false,
    ...overrides,
  };
}

function issuesByRule(issues: ReturnType<typeof validateCrossField>, rule: string) {
  return issues.filter((i) => i.rule === rule);
}

// --- Rules 1-17 (carried over from dev-stacks, adapted) ---

describe("Rule 1: unique-tool-names", () => {
  test("passes with unique tools", () => {
    const issues = validateCrossField([makeEntry({ tool: "A" }), makeEntry({ tool: "B" })]);
    expect(issuesByRule(issues, "unique-tool-names")).toHaveLength(0);
  });
  test("fails with duplicate", () => {
    const issues = validateCrossField([makeEntry({ tool: "A" }), makeEntry({ tool: "A" })]);
    const hits = issuesByRule(issues, "unique-tool-names");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.severity).toBe("error");
  });
});

describe("Rule 2-3: referential integrity", () => {
  test("passes valid relatedTo", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", relatedTo: ["B"] }),
      makeEntry({ tool: "B", relatedTo: ["A"] }),
    ]);
    expect(issuesByRule(i, "relatedTo-ref")).toHaveLength(0);
  });
  test("fails unknown relatedTo", () => {
    expect(
      issuesByRule(
        validateCrossField([makeEntry({ tool: "A", relatedTo: ["X"] })]),
        "relatedTo-ref",
      ),
    ).toHaveLength(1);
  });
  test("fails unknown dependsOn", () => {
    expect(
      issuesByRule(
        validateCrossField([makeEntry({ tool: "A", dependsOn: ["X"] })]),
        "dependsOn-ref",
      ),
    ).toHaveLength(1);
  });
});

describe("Rule 4: exclusion-group-size", () => {
  test("passes >=2 members", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        exclusionGroup: "code-review",
        selectionMode: "auto-included",
        priority: "recommended",
        condition: "always",
      }),
      makeEntry({
        tool: "B",
        exclusionGroup: "code-review",
        selectionMode: "selectable",
        priority: "recommended",
        condition: "always",
      }),
    ]);
    expect(issuesByRule(i, "exclusion-group-size")).toHaveLength(0);
  });
  test("fails single member", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        exclusionGroup: "code-review",
        selectionMode: "auto-included",
        priority: "recommended",
        condition: "always",
      }),
      makeEntry({ tool: "B" }),
    ]);
    expect(issuesByRule(i, "exclusion-group-size")).toHaveLength(1);
  });
});

describe("Rule 5: condition-feature-alignment", () => {
  test("passes with valid has_frontend", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        condition: "has_frontend",
        selectionMode: "auto-included",
        priority: "recommended",
        route: "has_frontend",
      }),
    ]);
    expect(issuesByRule(i, "condition-feature-alignment")).toHaveLength(0);
  });
});

describe("Rule 6: optional-selectable", () => {
  test("passes: optional + selectable", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        condition: "optional",
        selectionMode: "selectable",
        priority: "optional",
      }),
    ]);
    expect(issuesByRule(i, "optional-selectable")).toHaveLength(0);
  });
  test("fails: optional + always-included", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        condition: "optional",
        selectionMode: "always-included",
        priority: "optional",
      }),
    ]);
    expect(issuesByRule(i, "optional-selectable")).toHaveLength(1);
  });
});

describe("Rule 7: self-reference", () => {
  test("fails: self in relatedTo", () => {
    const i = validateCrossField([makeEntry({ tool: "A", relatedTo: ["A"] })]);
    expect(issuesByRule(i, "no-self-relatedTo")).toHaveLength(1);
  });
  test("fails: self in dependsOn", () => {
    const i = validateCrossField([makeEntry({ tool: "A", dependsOn: ["A"] })]);
    expect(issuesByRule(i, "no-self-dependsOn")).toHaveLength(1);
  });
});

describe("Rule 8: circular dependencies", () => {
  test("passes: acyclic", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", dependsOn: ["B"] }),
      makeEntry({ tool: "B", relatedTo: ["A"] }),
    ]);
    expect(issuesByRule(i, "no-circular-dependsOn")).toHaveLength(0);
  });
  test("fails: A->B->A", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", dependsOn: ["B"] }),
      makeEntry({ tool: "B", dependsOn: ["A"] }),
    ]);
    expect(issuesByRule(i, "no-circular-dependsOn")).toHaveLength(1);
  });
});

describe("Rule 9: duplicate entries in arrays", () => {
  test("fails: duplicate in relatedTo", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", relatedTo: ["B", "B"] }),
      makeEntry({ tool: "B", relatedTo: ["A"] }),
    ]);
    expect(issuesByRule(i, "no-duplicate-relatedTo")).toHaveLength(1);
  });
});

describe("Rule 10: reachable platforms", () => {
  test("fails: all false", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        platforms: {
          contentSite: false,
          desktopApp: false,
          mobileApp: false,
          webApp: false,
          tooling: false,
        },
      }),
    ]);
    expect(issuesByRule(i, "reachable-platforms")).toHaveLength(1);
  });
});

describe("Rule 11: required-not-selectable", () => {
  test("fails: required + selectable", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        priority: "required",
        selectionMode: "selectable",
        condition: "optional",
      }),
    ]);
    expect(issuesByRule(i, "required-not-selectable")).toHaveLength(1);
  });
});

describe("Rule 12: beta-not-required", () => {
  test("fails: beta + required", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", maturity: "beta", priority: "required", agentNotes: "Beta note" }),
    ]);
    expect(issuesByRule(i, "beta-not-required")).toHaveLength(1);
  });
});

describe("Rule 13: beta-needs-agentNotes", () => {
  test("errors: beta + null agentNotes", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        maturity: "beta",
        agentNotes: null,
        priority: "optional",
        condition: "optional",
        selectionMode: "selectable",
      }),
    ]);
    const hits = issuesByRule(i, "beta-needs-agentNotes");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.severity).toBe("error");
  });
});

describe("Rule 14: dependsOn-relatedTo-disjoint", () => {
  test("errors: same tool in both", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", dependsOn: ["B"], relatedTo: ["B"] }),
      makeEntry({ tool: "B", relatedTo: ["A"] }),
    ]);
    const hits = issuesByRule(i, "dependsOn-relatedTo-disjoint");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.severity).toBe("error");
  });
});

describe("Rule 15: relatedTo-symmetry", () => {
  test("errors: A relatedTo B, B has neither", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", relatedTo: ["B"] }),
      makeEntry({ tool: "B" }),
    ]);
    const hits = issuesByRule(i, "relatedTo-symmetry");
    expect(hits).toHaveLength(1);
  });
});

describe("Rule 16: dependsOn-reverse-relatedTo", () => {
  test("errors: A dependsOn B, B has empty relatedTo", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", dependsOn: ["B"] }),
      makeEntry({ tool: "B" }),
    ]);
    const hits = issuesByRule(i, "dependsOn-reverse-relatedTo");
    expect(hits).toHaveLength(1);
  });
});

describe("Rule 17: always-included-requires-required", () => {
  test("passes: always-included + required", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", selectionMode: "always-included", priority: "required" }),
    ]);
    expect(issuesByRule(i, "always-included-requires-required")).toHaveLength(0);
  });
  test("errors: always-included + recommended", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", selectionMode: "always-included", priority: "recommended" }),
    ]);
    expect(issuesByRule(i, "always-included-requires-required")).toHaveLength(1);
  });
});

// --- Agent-specific rules (18-23) ---

describe("Rule 18: hasMcp-needs-mcpConfig", () => {
  test("passes: hasMcp + mcpConfig present", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        hasMcp: true,
        category: "mcp-server",
        mcpConfig: { type: "stdio", command: "bunx", args: ["-y", "test"] },
        installCommand: "claude mcp add A -- bunx -y test",
        tier: "4",
        section: "Infrastructure",
      }),
    ]);
    expect(issuesByRule(i, "hasMcp-needs-mcpConfig")).toHaveLength(0);
  });
  test("errors: hasMcp + mcp-server + null mcpConfig", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        hasMcp: true,
        category: "mcp-server",
        mcpConfig: null,
        installCommand: "claude mcp add A -- bunx -y test",
        tier: "4",
        section: "Infrastructure",
      }),
    ]);
    expect(issuesByRule(i, "hasMcp-needs-mcpConfig")).toHaveLength(1);
  });
  test("passes: hasMcp + plugin + null mcpConfig (plugins can have MCP without config)", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        hasMcp: true,
        category: "plugin",
        mcpConfig: null,
        condition: "optional",
        selectionMode: "selectable",
        priority: "optional",
        tier: "4",
        section: "Infrastructure",
      }),
    ]);
    expect(issuesByRule(i, "hasMcp-needs-mcpConfig")).toHaveLength(0);
  });
});

describe("Rule 19: mcpConfig-needs-hasMcp", () => {
  test("errors: mcpConfig present + hasMcp=false", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        hasMcp: false,
        mcpConfig: { type: "stdio", command: "bunx", args: [] },
      }),
    ]);
    expect(issuesByRule(i, "mcpConfig-needs-hasMcp")).toHaveLength(1);
  });
});

describe("Rule 20: category-mcp-consistency", () => {
  test("errors: mcp-server + hasMcp=false", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        category: "mcp-server",
        hasMcp: false,
        installCommand: "claude mcp add A -- bunx test",
        tier: "4",
        section: "Infrastructure",
      }),
    ]);
    expect(issuesByRule(i, "category-mcp-consistency")).toHaveLength(1);
  });
  test("passes: mcp-server + hasMcp=true", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        category: "mcp-server",
        hasMcp: true,
        mcpConfig: { type: "stdio", command: "bunx", args: [] },
        installCommand: "claude mcp add A -- bunx test",
        tier: "4",
        section: "Infrastructure",
      }),
    ]);
    expect(issuesByRule(i, "category-mcp-consistency")).toHaveLength(0);
  });
});

describe("Rule 21: tier-section-consistency", () => {
  test("passes: tier 1 + Core Workflow", () => {
    const i = validateCrossField([makeEntry({ tool: "A", tier: "1", section: "Core Workflow" })]);
    expect(issuesByRule(i, "tier-section-consistency")).toHaveLength(0);
  });
  test("errors: tier 1 + wrong section", () => {
    const i = validateCrossField([makeEntry({ tool: "A", tier: "1", section: "Infrastructure" })]);
    expect(issuesByRule(i, "tier-section-consistency")).toHaveLength(1);
  });
  test("passes: tier 4 + Infrastructure", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        tier: "4",
        section: "Infrastructure",
        condition: "optional",
        selectionMode: "selectable",
        priority: "optional",
      }),
    ]);
    expect(issuesByRule(i, "tier-section-consistency")).toHaveLength(0);
  });
});

describe("Rule 22: installCommand-category", () => {
  test("passes: plugin + claude plugin install", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        category: "plugin",
        installCommand: "claude plugin install test@claude-plugins-official",
      }),
    ]);
    expect(issuesByRule(i, "installCommand-category")).toHaveLength(0);
  });
  test("errors: plugin + claude mcp add", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        category: "plugin",
        installCommand: "claude mcp add test -- bunx test",
      }),
    ]);
    expect(issuesByRule(i, "installCommand-category")).toHaveLength(1);
  });
  test("passes: mcp-server + claude mcp add", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        category: "mcp-server",
        hasMcp: true,
        mcpConfig: { type: "stdio", command: "bunx", args: [] },
        installCommand: "claude mcp add test -- bunx test",
        tier: "4",
        section: "Infrastructure",
      }),
    ]);
    expect(issuesByRule(i, "installCommand-category")).toHaveLength(0);
  });
  test("errors: mcp-server + claude plugin install", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        category: "mcp-server",
        hasMcp: true,
        mcpConfig: { type: "stdio", command: "bunx", args: [] },
        installCommand: "claude plugin install test@claude-plugins-official",
        tier: "4",
        section: "Infrastructure",
      }),
    ]);
    expect(issuesByRule(i, "installCommand-category")).toHaveLength(1);
  });
});

describe("Rule 23: requiresAuth-agentNotes", () => {
  test("passes: requiresAuth + agentNotes present", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        requiresAuth: true,
        agentNotes: "Requires API key",
        condition: "optional",
        selectionMode: "selectable",
        priority: "optional",
      }),
    ]);
    expect(issuesByRule(i, "requiresAuth-agentNotes")).toHaveLength(0);
  });
  test("warns: requiresAuth + null agentNotes", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        requiresAuth: true,
        agentNotes: null,
        condition: "optional",
        selectionMode: "selectable",
        priority: "optional",
      }),
    ]);
    const hits = issuesByRule(i, "requiresAuth-agentNotes");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.severity).toBe("warning");
  });
  test("passes: requiresAuth=false + null agentNotes", () => {
    const i = validateCrossField([makeEntry({ tool: "A", requiresAuth: false, agentNotes: null })]);
    expect(issuesByRule(i, "requiresAuth-agentNotes")).toHaveLength(0);
  });
});

// --- Integration test ---

describe("Integration: agent-stacks.json", () => {
  test("parses structurally and runs all 23 rules", () => {
    const filePath = path.resolve(import.meta.dir, "..", "..", "data", "agent-stacks.json");
    const result = validateAgentStacks(filePath);
    expect(result.structuralErrors).toHaveLength(0);
    expect(result.rulesChecked).toBe(23);
    expect(result.hasErrors).toBe(false);
    const errors = result.crossFieldIssues.filter((i) => i.severity === "error");
    expect(errors.length).toBe(0);
  });
});
