import { describe, expect, it } from "bun:test";
import type { DecisionTreeLeaf } from "../tree/schema";
import { resolveStack } from "./context";

const NEXTJS_LEAF: DecisionTreeLeaf = {
  id: "nextjs-tailwind",
  route: "framework:nextjs",
  platformKey: "webApp",
  exclusionChoices: {
    "package-manager": "Bun install",
    runtime: "Bun",
    "test-runner": "Bun test",
  },
  frameworkConfig: {
    framework: "next.js",
    entryPoint: "app/page.tsx",
    devCommand: "next dev",
    buildCommand: "next build",
    directories: ["app", "public"],
  },
};

describe("resolveStack", () => {
  it("includes always-included tools for the matching platform", () => {
    const stack = resolveStack(NEXTJS_LEAF);
    const toolNames = stack.tools.map((t) => t.tool);
    // TypeScript is always-included + webApp platform
    expect(toolNames).toContain("TypeScript");
    // Biome is always-included + webApp platform
    expect(toolNames).toContain("Biome");
  });

  it("includes auto-included tools for the matching platform", () => {
    const stack = resolveStack(NEXTJS_LEAF);
    const _toolNames = stack.tools.map((t) => t.tool);
    // Auto-included tools for webApp should be present
    const autoIncluded = stack.tools.filter((t) => t.selectionMode === "auto-included");
    expect(autoIncluded.length).toBeGreaterThan(0);
  });

  it("filters by route (base + framework:nextjs + exclusion choice routes)", () => {
    const stack = resolveStack(NEXTJS_LEAF);
    const routes = new Set(stack.tools.map((t) => t.route));
    // Core routes from the leaf
    expect(routes.has("base")).toBe(true);
    expect(routes.has("framework:nextjs")).toBe(true);
    // Exclusion choices may pull tools from other routes (e.g., runtime:bun)
    // but no completely unrelated routes should appear
    const allowedRoutes = ["base", "framework:nextjs", "runtime:bun", "backend:supabase"];
    for (const route of routes) {
      expect(allowedRoutes).toContain(route);
    }
  });

  it("filters by platform (webApp only)", () => {
    const stack = resolveStack(NEXTJS_LEAF);
    for (const tool of stack.tools) {
      expect(tool.platforms.webApp).toBe(true);
    }
  });

  it("resolves exclusion group choices", () => {
    const stack = resolveStack(NEXTJS_LEAF);
    const toolNames = stack.tools.map((t) => t.tool);
    // The chosen tools from exclusion groups should be included
    expect(toolNames).toContain("Bun");
    expect(toolNames).toContain("Bun test");
  });

  it("does not include conflicting exclusion group members", () => {
    const stack = resolveStack(NEXTJS_LEAF);
    const _toolNames = stack.tools.map((t) => t.tool);
    // If Bun is chosen for runtime, Node.js should not be included
    // (both are in the "runtime" exclusion group)
    const runtimeTools = stack.tools.filter((t) => t.exclusionGroup === "runtime");
    expect(runtimeTools).toHaveLength(1);
    expect(runtimeTools.at(0)?.tool).toBe("Bun");
  });

  it("resolves dependsOn chains", () => {
    const stack = resolveStack(NEXTJS_LEAF);
    const toolNames = new Set(stack.tools.map((t) => t.tool));
    // For every tool in the stack, its dependsOn should also be present
    for (const tool of stack.tools) {
      for (const dep of tool.dependsOn) {
        expect(toolNames.has(dep)).toBe(true);
      }
    }
  });

  it("preserves frameworkConfig from the leaf", () => {
    const stack = resolveStack(NEXTJS_LEAF);
    expect(stack.frameworkConfig.framework).toBe("next.js");
    expect(stack.frameworkConfig.entryPoint).toBe("app/page.tsx");
  });

  it("populates dependencies and devDependencies from tool data", () => {
    const stack = resolveStack(NEXTJS_LEAF);
    expect(stack.dependencies).toBeDefined();
    expect(stack.devDependencies).toBeDefined();
  });
});

describe("resolveStack with additive routes", () => {
  it("includes runtime:node tools when additive route is provided", () => {
    const stack = resolveStack(NEXTJS_LEAF, [
      {
        route: "runtime:node",
        exclusionOverrides: {
          runtime: "Node.js",
          "package-manager": "pnpm",
          "test-runner": "Vitest",
        },
      },
    ]);
    const toolNames = stack.tools.map((t) => t.tool);
    expect(toolNames).toContain("Node.js");
    expect(toolNames).toContain("pnpm");
    expect(toolNames).toContain("Vitest");
  });

  it("excludes Bun when runtime:node overrides the runtime exclusion group", () => {
    const stack = resolveStack(NEXTJS_LEAF, [
      {
        route: "runtime:node",
        exclusionOverrides: {
          runtime: "Node.js",
          "package-manager": "pnpm",
          "test-runner": "Vitest",
        },
      },
    ]);
    const toolNames = stack.tools.map((t) => t.tool);
    expect(toolNames).not.toContain("Bun");
    expect(toolNames).not.toContain("Bun install");
    expect(toolNames).not.toContain("Bun test");
  });

  it("includes backend:supabase tools when additive route is provided", () => {
    const stack = resolveStack(NEXTJS_LEAF, [
      {
        route: "backend:supabase",
        exclusionOverrides: {
          database: "Supabase",
          auth: "Supabase Auth",
          storage: "Supabase Storage",
          realtime: "Supabase Realtime",
          vector: "Supabase pgvector",
        },
      },
    ]);
    const toolNames = stack.tools.map((t) => t.tool);
    expect(toolNames).toContain("Supabase");
    expect(toolNames).toContain("Supabase Auth");
    expect(toolNames).toContain("Supabase Storage");
  });

  it("includes backend:standalone tools when additive route is provided", () => {
    const stack = resolveStack(NEXTJS_LEAF, [
      {
        route: "backend:standalone",
        exclusionOverrides: {
          database: "Neon",
          auth: "BetterAuth",
          storage: "Cloudflare R2",
          realtime: "Upstash Realtime",
          vector: "Upstash Vector",
        },
      },
    ]);
    const toolNames = stack.tools.map((t) => t.tool);
    expect(toolNames).toContain("Neon");
    expect(toolNames).toContain("BetterAuth");
    expect(toolNames).toContain("Cloudflare R2");
  });

  it("combines runtime:node and backend:supabase additive routes", () => {
    const stack = resolveStack(NEXTJS_LEAF, [
      {
        route: "runtime:node",
        exclusionOverrides: {
          runtime: "Node.js",
          "package-manager": "pnpm",
          "test-runner": "Vitest",
        },
      },
      {
        route: "backend:supabase",
        exclusionOverrides: {
          database: "Supabase",
          auth: "Supabase Auth",
          storage: "Supabase Storage",
          realtime: "Supabase Realtime",
          vector: "Supabase pgvector",
        },
      },
    ]);
    const toolNames = stack.tools.map((t) => t.tool);
    // Runtime should be Node.js, not Bun
    expect(toolNames).toContain("Node.js");
    expect(toolNames).not.toContain("Bun");
    // Backend should include Supabase tools
    expect(toolNames).toContain("Supabase");
    expect(toolNames).toContain("Supabase Auth");
  });

  it("returns additiveRoutes in the result", () => {
    const stack = resolveStack(NEXTJS_LEAF, [
      { route: "runtime:node", exclusionOverrides: { runtime: "Node.js" } },
    ]);
    expect(stack.additiveRoutes).toEqual(["runtime:node"]);
  });

  it("returns undefined additiveRoutes when none provided", () => {
    const stack = resolveStack(NEXTJS_LEAF);
    expect(stack.additiveRoutes).toBeUndefined();
  });

  it("is backward compatible — no additive routes gives same result", () => {
    const withoutAdditive = resolveStack(NEXTJS_LEAF);
    const withEmptyAdditive = resolveStack(NEXTJS_LEAF, []);
    // Same tools (by name, ignoring order)
    const namesWithout = withoutAdditive.tools.map((t) => t.tool).sort();
    const namesWith = withEmptyAdditive.tools.map((t) => t.tool).sort();
    expect(namesWith).toEqual(namesWithout);
  });

  it("resolves dependsOn chains across additive route boundaries", () => {
    const stack = resolveStack(NEXTJS_LEAF, [
      {
        route: "runtime:node",
        exclusionOverrides: {
          runtime: "Node.js",
          "package-manager": "pnpm",
          "test-runner": "Vitest",
        },
      },
    ]);
    const toolNames = new Set(stack.tools.map((t) => t.tool));
    // Every included tool's deps should also be in the stack
    for (const tool of stack.tools) {
      for (const dep of tool.dependsOn) {
        expect(toolNames.has(dep)).toBe(true);
      }
    }
  });

  it("still filters by platform when additive routes are provided", () => {
    const stack = resolveStack(NEXTJS_LEAF, [
      {
        route: "backend:supabase",
        exclusionOverrides: {
          database: "Supabase",
          auth: "Supabase Auth",
          storage: "Supabase Storage",
          realtime: "Supabase Realtime",
          vector: "Supabase pgvector",
        },
      },
    ]);
    // All tools should have webApp=true (the leaf's platform)
    for (const tool of stack.tools) {
      expect(tool.platforms.webApp).toBe(true);
    }
  });
});
