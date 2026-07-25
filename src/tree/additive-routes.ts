import { NODE_PREREQ, PNPM_PREREQ } from "./prereqs";
import type { AdditiveRouteConfig, PrereqCheck, PrereqId } from "./schema";

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

/**
 * Maps a `RUNTIME_QUESTION` answer to the prereqs that runtime adds and the
 * leaf-level prereq kinds it supersedes.
 *
 * Why a registry rather than a hardcoded `if (runtime === "node")` swap inside
 * preflight: the toolkit's runtime options change over time. Adding Deno or
 * dropping pnpm should be a one-file edit here, not a hunt across `preflight.ts`,
 * `definition.ts`, and the leaf prereq arrays.
 *
 * Conventions:
 * - The default runtime (currently Bun) is declared per-leaf in `definition.ts`
 *   via `BUN_PREREQ`. It has no entry here because no swap is needed.
 * - A non-default entry's `prereqs` array is INJECTED on top of the leaf's
 *   declared prereqs.
 * - `supersedes` lists detector kinds to strip from the leaf's declared
 *   prereqs — e.g. picking Node strips Bun-kind leaf prereqs so the user
 *   doesn't see a stale "install Bun" hint after choosing Node.
 *
 * Extension recipe:
 * 1. Add the new option to `RUNTIME_QUESTION.options`.
 * 2. If it's non-default, add a constant to `tree/prereqs.ts` and a mapping
 *    entry here.
 */
export interface RuntimePrereqMapping {
  /** Matches the `value` field of a `RUNTIME_QUESTION.options` entry. */
  value: string;
  /** Prereqs the user must satisfy for this runtime. */
  prereqs: PrereqCheck[];
  /** Leaf-prereq detect kinds to drop when this runtime is picked. */
  supersedes: PrereqId["kind"][];
}

export const RUNTIME_PREREQ_MAPPINGS: RuntimePrereqMapping[] = [
  {
    value: "node",
    prereqs: [NODE_PREREQ, PNPM_PREREQ],
    supersedes: ["bun"],
  },
];
