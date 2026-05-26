import { describe, expect, test } from "bun:test";
import { getAgentStacksPath } from "../data/agent-stacks-loader";
import { validateAgentStacks } from "./validate-agent-stacks";

describe("agent-stacks dataset — post-audit validation", () => {
  test("every entry passes all 23 cross-field rules (FR-015)", () => {
    const result = validateAgentStacks(getAgentStacksPath());
    expect(result.structuralErrors).toEqual([]);
    expect(result.hasErrors).toBe(false);
  });
});
