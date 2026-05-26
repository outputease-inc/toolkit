import { describe, expect, test } from "bun:test";
import * as path from "node:path";
import type { DevStackEntry } from "../schema/dev-stacks";
import { validateCrossField, validateDevStacks } from "./validate-dev-stacks";

/** Factory: creates a minimal valid entry with overrides. */
function makeEntry(overrides: Partial<DevStackEntry> = {}): DevStackEntry {
  return {
    tool: "test-tool",
    purpose: "Test purpose",
    role: "Test",
    route: "base",
    section: "Developer Tools",
    category: "tool",
    layer: "devtime",
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
    ...overrides,
  };
}

function issuesByRule(issues: ReturnType<typeof validateCrossField>, rule: string) {
  return issues.filter((i) => i.rule === rule);
}

// Rules 1-10 (existing rules with severity)

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

describe("Rule 2: referential integrity", () => {
  test("passes valid relatedTo", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", relatedTo: ["B"] }),
      makeEntry({ tool: "B" }),
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

describe("Rule 3: exclusion-group-size", () => {
  test("passes >=2 members", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", exclusionGroup: "runtime" }),
      makeEntry({ tool: "B", exclusionGroup: "runtime" }),
    ]);
    expect(issuesByRule(i, "exclusion-group-size")).toHaveLength(0);
  });
  test("fails single member", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", exclusionGroup: "runtime" }),
      makeEntry({ tool: "B" }),
    ]);
    expect(issuesByRule(i, "exclusion-group-size")).toHaveLength(1);
  });
});

describe("Rule 4: condition-feature-alignment", () => {
  test("passes with valid has_*", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        condition: "has_auth",
        selectionMode: "auto-included",
        priority: "recommended",
      }),
    ]);
    expect(issuesByRule(i, "condition-feature-alignment")).toHaveLength(0);
  });
  test("fails with unknown has_*", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        condition: "has_nonexistent" as DevStackEntry["condition"],
        selectionMode: "auto-included",
        priority: "recommended",
      }),
    ]);
    expect(issuesByRule(i, "condition-feature-alignment")).toHaveLength(1);
  });
});

describe("Rule 5: optional-selectable", () => {
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

describe("Rule 6: platform-default-always-included", () => {
  test("passes: platform_default + always-included", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        condition: "platform_default:WebApp",
        selectionMode: "always-included",
      }),
    ]);
    expect(issuesByRule(i, "platform-default-always-included")).toHaveLength(0);
  });
  test("fails: platform_default + selectable", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        condition: "platform_default:WebApp",
        selectionMode: "selectable",
        priority: "optional",
      }),
    ]);
    expect(issuesByRule(i, "platform-default-always-included")).toHaveLength(1);
  });
});

describe("Rule 7: route-platform", () => {
  test("passes: tauri has desktopApp=true", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        route: "platform:tauri",
        platforms: {
          contentSite: false,
          desktopApp: true,
          mobileApp: false,
          webApp: false,
          tooling: false,
        },
      }),
    ]);
    expect(issuesByRule(i, "route-platform")).toHaveLength(0);
  });
  test("fails: tauri with desktopApp=false", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        route: "platform:tauri",
        platforms: {
          contentSite: false,
          desktopApp: false,
          mobileApp: false,
          webApp: true,
          tooling: false,
        },
      }),
    ]);
    expect(issuesByRule(i, "route-platform")).toHaveLength(1);
  });
});

describe("Rule 8: category-layer", () => {
  test("passes: template + template layer + null url", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        category: "template",
        layer: "template",
        url: null,
        condition: "optional",
        selectionMode: "selectable",
        priority: "optional",
      }),
    ]);
    expect(issuesByRule(i, "category-layer")).toHaveLength(0);
    expect(issuesByRule(i, "template-url-null")).toHaveLength(0);
  });
  test("fails: template + non-template layer", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        category: "template",
        layer: "runtime",
        url: null,
        condition: "optional",
        selectionMode: "selectable",
        priority: "optional",
      }),
    ]);
    expect(issuesByRule(i, "category-layer")).toHaveLength(1);
  });
  test("fails: non-template with null url", () => {
    const i = validateCrossField([makeEntry({ tool: "A", category: "tool", url: null })]);
    expect(issuesByRule(i, "non-template-url-required")).toHaveLength(1);
  });
});

describe("Rule 9: bundle-route", () => {
  test("passes: tauri-core + platform:tauri", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        bundle: "tauri-core",
        route: "platform:tauri",
        platforms: {
          contentSite: false,
          desktopApp: true,
          mobileApp: false,
          webApp: false,
          tooling: false,
        },
      }),
    ]);
    expect(issuesByRule(i, "bundle-route")).toHaveLength(0);
  });
  test("fails: tauri-core + base route", () => {
    const i = validateCrossField([makeEntry({ tool: "A", bundle: "tauri-core", route: "base" })]);
    expect(issuesByRule(i, "bundle-route")).toHaveLength(1);
  });
});

describe("Rule 10: dependsOn-route-compat", () => {
  test("passes: dep on base-route tool", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        route: "framework:nextjs",
        dependsOn: ["B"],
        platforms: {
          contentSite: false,
          desktopApp: false,
          mobileApp: false,
          webApp: true,
          tooling: false,
        },
      }),
      makeEntry({ tool: "B", route: "base" }),
    ]);
    expect(issuesByRule(i, "dependsOn-route-compat")).toHaveLength(0);
  });
  test("fails: dep on incompatible route", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        route: "framework:nextjs",
        dependsOn: ["B"],
        platforms: {
          contentSite: false,
          desktopApp: false,
          mobileApp: false,
          webApp: true,
          tooling: false,
        },
      }),
      makeEntry({
        tool: "B",
        route: "platform:tauri",
        platforms: {
          contentSite: false,
          desktopApp: true,
          mobileApp: false,
          webApp: false,
          tooling: false,
        },
      }),
    ]);
    expect(issuesByRule(i, "dependsOn-route-compat")).toHaveLength(1);
  });
});

// New rules 11-19

describe("Rule 11: self-reference", () => {
  test("passes: no self-refs", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", relatedTo: ["B"], dependsOn: ["B"] }),
      makeEntry({ tool: "B" }),
    ]);
    expect(issuesByRule(i, "no-self-relatedTo")).toHaveLength(0);
    expect(issuesByRule(i, "no-self-dependsOn")).toHaveLength(0);
  });
  test("fails: self in relatedTo", () => {
    const i = validateCrossField([makeEntry({ tool: "A", relatedTo: ["A"] })]);
    expect(issuesByRule(i, "no-self-relatedTo")).toHaveLength(1);
  });
  test("fails: self in dependsOn", () => {
    const i = validateCrossField([makeEntry({ tool: "A", dependsOn: ["A"] })]);
    expect(issuesByRule(i, "no-self-dependsOn")).toHaveLength(1);
  });
});

describe("Rule 12: circular dependencies", () => {
  test("passes: acyclic graph", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", dependsOn: ["B"] }),
      makeEntry({ tool: "B", dependsOn: ["C"] }),
      makeEntry({ tool: "C" }),
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
  test("fails: A->B->C->A", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", dependsOn: ["B"] }),
      makeEntry({ tool: "B", dependsOn: ["C"] }),
      makeEntry({ tool: "C", dependsOn: ["A"] }),
    ]);
    expect(issuesByRule(i, "no-circular-dependsOn")).toHaveLength(1);
  });
});

describe("Rule 13: duplicate entries in arrays", () => {
  test("passes: no duplicates", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", relatedTo: ["B", "C"], dependsOn: ["B"] }),
      makeEntry({ tool: "B" }),
      makeEntry({ tool: "C" }),
    ]);
    expect(issuesByRule(i, "no-duplicate-relatedTo")).toHaveLength(0);
    expect(issuesByRule(i, "no-duplicate-dependsOn")).toHaveLength(0);
  });
  test("fails: duplicate in relatedTo", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", relatedTo: ["B", "B"] }),
      makeEntry({ tool: "B" }),
    ]);
    expect(issuesByRule(i, "no-duplicate-relatedTo")).toHaveLength(1);
  });
  test("fails: duplicate in dependsOn", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", dependsOn: ["B", "B"] }),
      makeEntry({ tool: "B" }),
    ]);
    expect(issuesByRule(i, "no-duplicate-dependsOn")).toHaveLength(1);
  });
});

describe("Rule 14: reachable platforms", () => {
  test("passes: at least one true", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        platforms: {
          contentSite: false,
          desktopApp: false,
          mobileApp: false,
          webApp: true,
          tooling: false,
        },
      }),
    ]);
    expect(issuesByRule(i, "reachable-platforms")).toHaveLength(0);
  });
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

describe("Rule 15: always-condition-selectionMode", () => {
  test("passes: always + always-included", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", condition: "always", selectionMode: "always-included" }),
    ]);
    expect(issuesByRule(i, "always-condition-selectionMode")).toHaveLength(0);
  });
  test("passes: always + auto-included + exclusionGroup", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        condition: "always",
        selectionMode: "auto-included",
        exclusionGroup: "runtime",
      }),
      makeEntry({
        tool: "B",
        condition: "always",
        selectionMode: "auto-included",
        exclusionGroup: "runtime",
      }),
    ]);
    expect(issuesByRule(i, "always-condition-selectionMode")).toHaveLength(0);
  });
  test("fails: always + selectable", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        condition: "always",
        selectionMode: "selectable",
        priority: "optional",
      }),
    ]);
    expect(issuesByRule(i, "always-condition-selectionMode")).toHaveLength(1);
  });
  test("fails: always + auto-included + no exclusionGroup", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        condition: "always",
        selectionMode: "auto-included",
        exclusionGroup: null,
      }),
    ]);
    expect(issuesByRule(i, "always-condition-selectionMode")).toHaveLength(1);
  });
});

describe("Rule 16: required-not-selectable", () => {
  test("passes: required + always-included", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", priority: "required", selectionMode: "always-included" }),
    ]);
    expect(issuesByRule(i, "required-not-selectable")).toHaveLength(0);
  });
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

describe("Rule 17: beta-not-required", () => {
  test("passes: beta + optional", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        maturity: "beta",
        priority: "optional",
        condition: "optional",
        selectionMode: "selectable",
        agentNotes: "Beta note",
      }),
    ]);
    expect(issuesByRule(i, "beta-not-required")).toHaveLength(0);
  });
  test("fails: beta + required", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", maturity: "beta", priority: "required", agentNotes: "Beta note" }),
    ]);
    expect(issuesByRule(i, "beta-not-required")).toHaveLength(1);
  });
});

describe("Rule 18: beta-needs-agentNotes", () => {
  test("passes: beta + agentNotes", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        maturity: "beta",
        agentNotes: "Reason",
        priority: "optional",
        condition: "optional",
        selectionMode: "selectable",
      }),
    ]);
    expect(issuesByRule(i, "beta-needs-agentNotes")).toHaveLength(0);
  });
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

describe("Rule 19: dependsOn-relatedTo-disjoint", () => {
  test("passes: no overlap", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", dependsOn: ["B"], relatedTo: ["C"] }),
      makeEntry({ tool: "B" }),
      makeEntry({ tool: "C" }),
    ]);
    expect(issuesByRule(i, "dependsOn-relatedTo-disjoint")).toHaveLength(0);
  });
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

// Rules 20-24

describe("Rule 20: relatedTo-symmetry", () => {
  test("passes: bidirectional relatedTo", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", relatedTo: ["B"] }),
      makeEntry({ tool: "B", relatedTo: ["A"] }),
    ]);
    expect(issuesByRule(i, "relatedTo-symmetry")).toHaveLength(0);
  });
  test("passes: A relatedTo B, B dependsOn A (dependsOn satisfies symmetry)", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", relatedTo: ["B"] }),
      makeEntry({ tool: "B", dependsOn: ["A"] }),
    ]);
    expect(issuesByRule(i, "relatedTo-symmetry")).toHaveLength(0);
  });
  test("errors: A relatedTo B, B has neither", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", relatedTo: ["B"] }),
      makeEntry({ tool: "B" }),
    ]);
    const hits = issuesByRule(i, "relatedTo-symmetry");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.severity).toBe("error");
  });
});

describe("Rule 21: dependsOn-reverse-relatedTo", () => {
  test("passes: A dependsOn B, B relatedTo A", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", dependsOn: ["B"] }),
      makeEntry({ tool: "B", relatedTo: ["A"] }),
    ]);
    expect(issuesByRule(i, "dependsOn-reverse-relatedTo")).toHaveLength(0);
  });
  test("errors: A dependsOn B, B has empty relatedTo", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", dependsOn: ["B"] }),
      makeEntry({ tool: "B" }),
    ]);
    const hits = issuesByRule(i, "dependsOn-reverse-relatedTo");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.severity).toBe("error");
    expect(hits[0]?.details).toContain("does not list");
  });
  test("errors: multiple dependents, none listed in parent relatedTo", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", dependsOn: ["C"] }),
      makeEntry({ tool: "B", dependsOn: ["C"] }),
      makeEntry({ tool: "C" }),
    ]);
    const hits = issuesByRule(i, "dependsOn-reverse-relatedTo");
    expect(hits).toHaveLength(2);
  });
});

describe("Rule 22: always-included-requires-required", () => {
  test("passes: always-included + required", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", selectionMode: "always-included", priority: "required" }),
    ]);
    expect(issuesByRule(i, "always-included-requires-required")).toHaveLength(0);
  });
  test("passes: auto-included + recommended (no constraint)", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        selectionMode: "auto-included",
        priority: "recommended",
        condition: "has_auth",
      }),
    ]);
    expect(issuesByRule(i, "always-included-requires-required")).toHaveLength(0);
  });
  test("errors: always-included + recommended", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", selectionMode: "always-included", priority: "recommended" }),
    ]);
    const hits = issuesByRule(i, "always-included-requires-required");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.severity).toBe("error");
  });
  test("errors: always-included + optional", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", selectionMode: "always-included", priority: "optional" }),
    ]);
    expect(issuesByRule(i, "always-included-requires-required")).toHaveLength(1);
  });
});

describe("Rule 23: dependency-platform-coverage", () => {
  test("passes: dependency covers all platforms", () => {
    const platforms = {
      contentSite: false,
      desktopApp: false,
      mobileApp: false,
      webApp: true,
      tooling: false,
    };
    const i = validateCrossField([
      makeEntry({ tool: "A", dependsOn: ["B"], platforms }),
      makeEntry({ tool: "B", platforms, relatedTo: ["A"] }),
    ]);
    expect(issuesByRule(i, "dependency-platform-coverage")).toHaveLength(0);
  });
  test("passes: dependency is tooling-only (exempt)", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        dependsOn: ["B"],
        platforms: {
          contentSite: false,
          desktopApp: false,
          mobileApp: true,
          webApp: true,
          tooling: true,
        },
      }),
      makeEntry({
        tool: "B",
        relatedTo: ["A"],
        platforms: {
          contentSite: false,
          desktopApp: false,
          mobileApp: false,
          webApp: false,
          tooling: true,
        },
      }),
    ]);
    expect(issuesByRule(i, "dependency-platform-coverage")).toHaveLength(0);
  });
  test("errors: dependent has platform dep lacks", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        dependsOn: ["B"],
        platforms: {
          contentSite: true,
          desktopApp: false,
          mobileApp: false,
          webApp: true,
          tooling: false,
        },
      }),
      makeEntry({
        tool: "B",
        relatedTo: ["A"],
        platforms: {
          contentSite: false,
          desktopApp: false,
          mobileApp: false,
          webApp: true,
          tooling: false,
        },
      }),
    ]);
    const hits = issuesByRule(i, "dependency-platform-coverage");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.details).toContain("contentSite");
  });
});

describe("Rule 24: unique-urls", () => {
  test("passes: unique URLs", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", url: "https://example.com/a" }),
      makeEntry({ tool: "B", url: "https://example.com/b" }),
    ]);
    expect(issuesByRule(i, "unique-urls")).toHaveLength(0);
  });
  test("passes: null URLs not checked", () => {
    const i = validateCrossField([
      makeEntry({
        tool: "A",
        url: null,
        category: "template",
        layer: "template",
        condition: "optional",
        selectionMode: "selectable",
        priority: "optional",
      }),
      makeEntry({
        tool: "B",
        url: null,
        category: "template",
        layer: "template",
        condition: "optional",
        selectionMode: "selectable",
        priority: "optional",
      }),
    ]);
    expect(issuesByRule(i, "unique-urls")).toHaveLength(0);
  });
  test("errors: duplicate URLs", () => {
    const i = validateCrossField([
      makeEntry({ tool: "A", url: "https://example.com/same" }),
      makeEntry({ tool: "B", url: "https://example.com/same" }),
      makeEntry({ tool: "C", url: "https://example.com/same" }),
    ]);
    const hits = issuesByRule(i, "unique-urls");
    expect(hits).toHaveLength(3);
    expect(hits[0]?.severity).toBe("error");
  });
});

// Integration test
describe("Integration: outputease-dev-stacks.json", () => {
  test("parses structurally and runs all 24 rules", () => {
    const filePath = path.resolve(import.meta.dir, "..", "..", "data", "dev-stacks.json");
    const result = validateDevStacks(filePath);
    expect(result.structuralErrors).toHaveLength(0);
    expect(result.rulesChecked).toBe(24);
    // Dataset passes all validation rules after audit remediation
    expect(result.hasErrors).toBe(false);
    const errors = result.crossFieldIssues.filter((i) => i.severity === "error");
    expect(errors.length).toBe(0);
  });
});
