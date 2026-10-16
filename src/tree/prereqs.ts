import type { PrereqCheck } from "./schema";

/**
 * Shared `PrereqCheck` constants reused across leaves and runtime mappings.
 *
 * Adding a new toolkit-wide prereq:
 *   1. Add a `const FOO_PREREQ: PrereqCheck = { ... }` here.
 *   2. Reference it from any leaf's `prerequisites: [FOO_PREREQ, ...]` array
 *      in `tree/definition.ts`, OR from a runtime entry in
 *      `tree/additive-routes.ts:RUNTIME_PREREQ_MAPPINGS`.
 *
 * Adding a new detector kind (e.g. `deno`, `cargo-with-version`):
 *   1. Extend `prereqIdSchema` in `tree/schema.ts` with the new discriminator.
 *   2. Handle the new kind in `runPrereqCheck` in `scaffold/preflight.ts`.
 *   3. Add a constant here if it's reusable across leaves.
 *
 * Adding a new runtime option (e.g. Deno):
 *   1. Add the option to `RUNTIME_QUESTION.options` in `additive-routes.ts`.
 *   2. Add an entry to `RUNTIME_PREREQ_MAPPINGS` with the runtime's prereqs
 *      and any leaf-level prereq kinds the runtime supersedes (e.g. picking
 *      Deno would supersede both `"bun"` and `"node"` detect kinds).
 */

export const BUN_PREREQ: PrereqCheck = {
  name: "Bun",
  detect: { kind: "bun" },
  severity: "required",
  reason: "Bun is the runtime + package manager + test runner for this stack",
  installHint: {
    url: "https://bun.sh",
    command:
      process.platform === "win32"
        ? 'powershell -c "irm bun.sh/install.ps1 | iex"'
        : "curl -fsSL https://bun.sh/install | bash",
  },
};

export const NODE_PREREQ: PrereqCheck = {
  name: "Node.js 20+",
  detect: { kind: "node", minVersion: "20.0.0" },
  severity: "required",
  reason: "Node was selected as the runtime for this project",
  installHint: {
    url: "https://nodejs.org",
    command:
      process.platform === "win32"
        ? "winget install OpenJS.NodeJS.LTS"
        : "Install Node 20+ from your platform package manager or https://nodejs.org",
  },
};

export const PNPM_PREREQ: PrereqCheck = {
  name: "pnpm",
  detect: { kind: "pnpm" },
  severity: "required",
  reason: "pnpm is the package manager for the Node runtime path",
  installHint: {
    url: "https://pnpm.io/installation",
    command: "npm install -g pnpm",
  },
};
