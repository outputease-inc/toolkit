import { describe, expect, it } from "bun:test";
import { detectScriptType, isSpecifyAvailable, isUvAvailable } from "./post-install";

describe("detectScriptType", () => {
  it("returns 'sh' or 'ps' based on platform", () => {
    const result = detectScriptType();
    expect(["sh", "ps"]).toContain(result);
  });

  it("returns 'ps' on Windows", () => {
    if (process.platform === "win32") {
      expect(detectScriptType()).toBe("ps");
    }
  });

  it("returns 'sh' on non-Windows", () => {
    if (process.platform !== "win32") {
      expect(detectScriptType()).toBe("sh");
    }
  });
});

describe("isUvAvailable", () => {
  it("returns a boolean without throwing", () => {
    const result = isUvAvailable();
    expect(typeof result).toBe("boolean");
  });
});

describe("isSpecifyAvailable", () => {
  it("returns a boolean without throwing", () => {
    const result = isSpecifyAvailable();
    expect(typeof result).toBe("boolean");
  });
});
