import { describe, expect, it } from "bun:test";
import { DECISION_TREE, DECISION_TREE_LEAVES } from "./definition";
import { findLeafByPath, getNodeById, walkTreePath } from "./traversal";

describe("getNodeById", () => {
  it("returns the node with the given ID", () => {
    const node = getNodeById("project-type");
    expect(node).toBeDefined();
    expect(node?.id).toBe("project-type");
    expect(node?.question).toContain("building");
  });

  it("returns undefined for unknown ID", () => {
    const node = getNodeById("nonexistent");
    expect(node).toBeUndefined();
  });
});

describe("walkTreePath", () => {
  it("navigates the web app branch to a leaf", () => {
    const path = walkTreePath([
      { nodeId: "project-type", value: "web-app" },
      { nodeId: "web-framework", value: "nextjs" },
      { nodeId: "styling", value: "tailwind" },
    ]);
    expect(path.complete).toBe(true);
    expect(path.leafId).toBeDefined();
  });

  it("returns incomplete for a partial path", () => {
    const path = walkTreePath([{ nodeId: "project-type", value: "web-app" }]);
    expect(path.complete).toBe(false);
    expect(path.nextNodeId).toBe("web-framework");
  });

  it("returns error for invalid choice", () => {
    const path = walkTreePath([{ nodeId: "project-type", value: "nonexistent" }]);
    expect(path.error).toBeDefined();
  });
});

describe("findLeafByPath", () => {
  it("resolves web app / nextjs / tailwind to a valid leaf", () => {
    const leaf = findLeafByPath("nextjs-tailwind");
    expect(leaf).toBeDefined();
    expect(leaf?.route).toBe("framework:nextjs");
    expect(leaf?.platformKey).toBe("webApp");
    expect(leaf?.frameworkConfig.framework).toBe("next.js");
  });

  it("returns undefined for unknown leaf ID", () => {
    const leaf = findLeafByPath("nonexistent-leaf");
    expect(leaf).toBeUndefined();
  });
});

describe("decision tree structure", () => {
  it("first node is always project-type", () => {
    expect(DECISION_TREE[0]?.id).toBe("project-type");
  });

  it("has single-option nodes that will be auto-selected", () => {
    const singleOptionNodes = DECISION_TREE.filter(
      (n) => n.options.filter((o) => !o.disabled).length === 1,
    );
    expect(singleOptionNodes.length).toBeGreaterThan(0);
    for (const node of singleOptionNodes) {
      const enabled = node.options.filter((o) => !o.disabled);
      expect(enabled).toHaveLength(1);
    }
  });

  it("every terminal option maps to a valid leaf", () => {
    for (const node of DECISION_TREE) {
      for (const option of node.options) {
        if (option.next === null && !option.disabled) {
          // Terminal option — should have a corresponding leaf
          const leaf = DECISION_TREE_LEAVES[option.value];
          expect(leaf).toBeDefined();
        }
      }
    }
  });

  it("every non-terminal option references a valid node", () => {
    const nodeIds = new Set(DECISION_TREE.map((n) => n.id));
    for (const node of DECISION_TREE) {
      for (const option of node.options) {
        if (option.next !== null) {
          expect(nodeIds.has(option.next)).toBe(true);
        }
      }
    }
  });
});
