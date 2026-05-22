import { describe, expect, test } from "bun:test";
import { getDevStacksPath } from "../data/dev-stacks-loader";
import { validateDevStacks } from "./validate-dev-stacks";

describe("dev-stacks dataset — post-refresh validation", () => {
  test("every entry passes all 24 cross-field rules (FR-014, SC-005)", () => {
    const result = validateDevStacks(getDevStacksPath());
    expect(result.structuralErrors).toEqual([]);
    expect(result.hasErrors).toBe(false);
  });
});
