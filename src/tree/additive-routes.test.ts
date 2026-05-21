import { describe, expect, it } from "bun:test";
import { ADDITIVE_QUESTIONS, BACKEND_QUESTION, RUNTIME_QUESTION } from "./additive-routes";

describe("RUNTIME_QUESTION", () => {
  it("applies to webApp, contentSite, desktopApp", () => {
    expect(RUNTIME_QUESTION.applicablePlatforms.has("webApp")).toBe(true);
    expect(RUNTIME_QUESTION.applicablePlatforms.has("contentSite")).toBe(true);
    expect(RUNTIME_QUESTION.applicablePlatforms.has("desktopApp")).toBe(true);
  });

  it("does not apply to mobileApp or tooling", () => {
    expect(RUNTIME_QUESTION.applicablePlatforms.has("mobileApp")).toBe(false);
    expect(RUNTIME_QUESTION.applicablePlatforms.has("tooling")).toBe(false);
  });

  it("has bun as default with null config", () => {
    const bun = RUNTIME_QUESTION.options.find((o) => o.value === "bun");
    expect(bun).toBeDefined();
    expect(bun?.config).toBeNull();
  });

  it("has node option with runtime:node route and correct overrides", () => {
    const node = RUNTIME_QUESTION.options.find((o) => o.value === "node");
    expect(node).toBeDefined();
    expect(node?.config).not.toBeNull();
    expect(node?.config?.route).toBe("runtime:node");
    expect(node?.config?.exclusionOverrides.runtime).toBe("Node.js");
    expect(node?.config?.exclusionOverrides["package-manager"]).toBe("pnpm");
    expect(node?.config?.exclusionOverrides["test-runner"]).toBe("Vitest");
  });
});

describe("BACKEND_QUESTION", () => {
  it("applies to webApp, mobileApp, desktopApp", () => {
    expect(BACKEND_QUESTION.applicablePlatforms.has("webApp")).toBe(true);
    expect(BACKEND_QUESTION.applicablePlatforms.has("mobileApp")).toBe(true);
    expect(BACKEND_QUESTION.applicablePlatforms.has("desktopApp")).toBe(true);
  });

  it("does not apply to contentSite or tooling", () => {
    expect(BACKEND_QUESTION.applicablePlatforms.has("contentSite")).toBe(false);
    expect(BACKEND_QUESTION.applicablePlatforms.has("tooling")).toBe(false);
  });

  it("has none as default with null config", () => {
    const none = BACKEND_QUESTION.options.find((o) => o.value === "none");
    expect(none).toBeDefined();
    expect(none?.config).toBeNull();
  });

  it("has supabase option with backend:supabase route", () => {
    const supabase = BACKEND_QUESTION.options.find((o) => o.value === "supabase");
    expect(supabase).toBeDefined();
    expect(supabase?.config?.route).toBe("backend:supabase");
    expect(supabase?.config?.exclusionOverrides.database).toBe("Supabase");
    expect(supabase?.config?.exclusionOverrides.auth).toBe("Supabase Auth");
  });

  it("has standalone option with backend:standalone route", () => {
    const standalone = BACKEND_QUESTION.options.find((o) => o.value === "standalone");
    expect(standalone).toBeDefined();
    expect(standalone?.config?.route).toBe("backend:standalone");
    expect(standalone?.config?.exclusionOverrides.database).toBe("Neon");
    expect(standalone?.config?.exclusionOverrides.auth).toBe("BetterAuth");
  });
});

describe("ADDITIVE_QUESTIONS", () => {
  it("contains both runtime and backend questions", () => {
    expect(ADDITIVE_QUESTIONS).toHaveLength(2);
    expect(ADDITIVE_QUESTIONS[0]?.id).toBe("runtime");
    expect(ADDITIVE_QUESTIONS[1]?.id).toBe("backend");
  });
});
