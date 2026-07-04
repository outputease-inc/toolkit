import type { Preset } from "./schema";

/**
 * Hardcoded preset definitions mapping short names to decision tree leaves.
 * Each preset bypasses the interactive tree and goes straight to a leaf.
 */
const PRESETS: Preset[] = [
  {
    name: "web-app",
    description: "Full-stack Web App with Next.js + Tailwind CSS",
    leafId: "nextjs-tailwind",
    defaultName: "my-web-app",
  },
  {
    name: "content-site",
    description: "Content site with Astro + Tailwind CSS",
    leafId: "astro-tailwind",
    defaultName: "my-content-site",
  },
  {
    name: "mobile-app",
    description: "Cross-platform mobile app with Capacitor + React",
    leafId: "capacitor-react",
    defaultName: "my-mobile-app",
  },
  {
    name: "desktop-app",
    description: "Desktop app with Tauri + React",
    leafId: "tauri-react",
    defaultName: "my-desktop-app",
  },
  {
    name: "cli-tool",
    description: "CLI tool with Bun + Commander",
    leafId: "bun-cli",
    defaultName: "my-cli",
  },
  {
    name: "library",
    description: "Shared TypeScript library package",
    leafId: "typescript-library",
    defaultName: "my-lib",
  },
  {
    name: "web-app-supabase",
    description: "Full-stack Web App with Next.js + Tailwind + Supabase",
    leafId: "nextjs-tailwind",
    defaultName: "my-web-app",
    additiveRoutes: [
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
    ],
  },
  {
    name: "web-app-standalone",
    description: "Full-stack Web App with Next.js + Tailwind + Neon + BetterAuth",
    leafId: "nextjs-tailwind",
    defaultName: "my-web-app",
    additiveRoutes: [
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
    ],
  },
  {
    name: "web-app-node",
    description: "Full-stack Web App with Next.js + Tailwind + Node.js runtime",
    leafId: "nextjs-tailwind",
    defaultName: "my-web-app",
    additiveRoutes: [
      {
        route: "runtime:node",
        exclusionOverrides: {
          runtime: "Node.js",
          "package-manager": "pnpm",
          "test-runner": "Vitest",
        },
      },
    ],
  },
];

/**
 * Get a preset by name. Returns undefined if not found.
 */
export function getPreset(name: string): Preset | undefined {
  return PRESETS.find((p) => p.name === name);
}

/**
 * List all available presets.
 */
export function listPresets(): Preset[] {
  return [...PRESETS];
}
