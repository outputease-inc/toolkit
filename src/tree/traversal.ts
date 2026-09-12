import * as p from "@clack/prompts";
import { DECISION_TREE, DECISION_TREE_LEAVES } from "./definition";
import type { DecisionTreeLeaf, DecisionTreeNode } from "./schema";

/**
 * Find a decision tree node by its ID.
 */
export function getNodeById(id: string): DecisionTreeNode | undefined {
  return DECISION_TREE.find((n) => n.id === id);
}

/**
 * Find a leaf by its ID (the leaf's own `id` field, not the LEAVES key).
 */
export function findLeafByPath(leafId: string): DecisionTreeLeaf | undefined {
  return Object.values(DECISION_TREE_LEAVES).find((l) => l.id === leafId);
}

/**
 * Result of walking a decision tree path programmatically.
 */
export interface WalkResult {
  complete: boolean;
  leafId?: string;
  nextNodeId?: string;
  error?: string;
}

/**
 * Walk the tree with pre-determined answers (for testing / non-interactive use).
 */
export function walkTreePath(answers: Array<{ nodeId: string; value: string }>): WalkResult {
  let currentNodeId = DECISION_TREE[0]?.id;

  for (const answer of answers) {
    if (!currentNodeId) {
      return { complete: false, error: "Tree exhausted before all answers consumed" };
    }

    const node = getNodeById(currentNodeId);
    if (!node) {
      return { complete: false, error: `Node "${currentNodeId}" not found` };
    }

    if (node.id !== answer.nodeId) {
      return {
        complete: false,
        error: `Expected node "${answer.nodeId}" but at "${node.id}"`,
      };
    }

    const option = node.options.find((o) => o.value === answer.value);
    if (!option) {
      return {
        complete: false,
        error: `Option "${answer.value}" not found in node "${node.id}"`,
      };
    }

    if (option.disabled) {
      return {
        complete: false,
        error: `Option "${answer.value}" is disabled: ${option.disabledReason}`,
      };
    }

    if (option.next === null) {
      // Terminal — look up the leaf
      const leaf = DECISION_TREE_LEAVES[option.value];
      if (!leaf) {
        return {
          complete: false,
          error: `No leaf found for terminal option "${option.value}"`,
        };
      }
      return { complete: true, leafId: leaf.id };
    }

    currentNodeId = option.next;
  }

  return { complete: false, nextNodeId: currentNodeId };
}

/**
 * Run the interactive decision tree using @clack/prompts.
 * Returns the resolved leaf, or undefined if the user cancelled.
 */
export async function runInteractiveTree(): Promise<DecisionTreeLeaf | undefined> {
  let currentNodeId: string | undefined = DECISION_TREE[0]?.id;

  while (currentNodeId) {
    const node = getNodeById(currentNodeId);
    if (!node) break;

    const enabledOptions = node.options.filter((o) => !o.disabled);

    // Auto-select when only one option is available
    const auto = enabledOptions.length === 1 ? enabledOptions[0] : undefined;
    if (auto) {
      p.log.info(`${node.question} ${auto.label}`);
      if (auto.next === null) {
        return DECISION_TREE_LEAVES[auto.value];
      }
      currentNodeId = auto.next;
      continue;
    }

    const result = await p.select({
      message: node.question,
      options: node.options.map((o) => ({
        value: o.value,
        label: o.label,
        hint: o.disabled ? o.disabledReason : o.hint,
      })),
    });

    if (p.isCancel(result)) {
      return undefined;
    }

    const chosen = node.options.find((o) => o.value === result);
    if (!chosen || chosen.disabled) continue;

    if (chosen.next === null) {
      return DECISION_TREE_LEAVES[chosen.value];
    }

    currentNodeId = chosen.next;
  }

  return undefined;
}
