import type { AdditiveRouteConfig } from "./schema";

/**
 * An additive route question asked after the decision tree resolves a leaf.
 * These inject extra routes into stack resolution without requiring new leaves.
 */
export interface AdditiveRouteQuestion {
  id: string;
  question: string;
  applicablePlatforms: Set<string>;
  options: AdditiveRouteOption[];
}

export interface AdditiveRouteOption {
  value: string;
  label: string;
  hint: string;
  /** null = default/skip (no additive route added) */
  config: AdditiveRouteConfig | null;
}

export const RUNTIME_QUESTION: AdditiveRouteQuestion = {
  id: "runtime",
  question: "Runtime environment?",
  applicablePlatforms: new Set(["webApp", "contentSite", "desktopApp"]),
  options: [
    {
      value: "bun",
      label: "Bun",
      hint: "Fast all-in-one runtime, bundler, and test runner",
      config: null,
    },
    {
      value: "node",
      label: "Node.js",
      hint: "Established runtime with pnpm and Vitest",
      config: {
        route: "runtime:node",
        exclusionOverrides: {
          runtime: "Node.js",
          "package-manager": "pnpm",
          "test-runner": "Vitest",
        },
      },
    },
  ],
};

export const BACKEND_QUESTION: AdditiveRouteQuestion = {
  id: "backend",
  question: "Backend provider?",
  applicablePlatforms: new Set(["webApp", "mobileApp", "desktopApp"]),
  options: [
    {
      value: "none",
      label: "None",
      hint: "No backend — add later",
      config: null,
    },
    {
      value: "supabase",
      label: "Supabase",
      hint: "Postgres, Auth, Storage, Realtime, Edge Functions",
      config: {
        route: "backend:supabase",
        exclusionOverrides: {
          database: "Supabase",
          auth: "Supabase Auth",
          storage: "Supabase Storage",
          realtime: "Supabase Realtime",
          vector: "Supabase pgvector",
        },
      },
    },
    {
      value: "standalone",
      label: "Standalone",
      hint: "Neon Postgres, BetterAuth, Cloudflare R2, Upstash",
      config: {
        route: "backend:standalone",
        exclusionOverrides: {
          database: "Neon",
          auth: "BetterAuth",
          storage: "Cloudflare R2",
          realtime: "Upstash Realtime",
          vector: "Upstash Vector",
        },
      },
    },
  ],
};

export const ADDITIVE_QUESTIONS: AdditiveRouteQuestion[] = [RUNTIME_QUESTION, BACKEND_QUESTION];
