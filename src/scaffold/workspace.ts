import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Result of workspace detection.
 */
export interface WorkspaceInfo {
  detected: boolean;
  type?: "turborepo" | "pnpm" | "npm-workspaces";
  /** Whether the workspace type is supported for scaffolding in V1 */
  supported?: boolean;
  /** Apps directory (e.g., "apps") */
  appsDir?: string;
  /** Packages directory (e.g., "packages") */
  packagesDir?: string;
  /** Root package.json workspaces globs */
  workspaces?: string[];
}

/**
 * Detect workspace type by checking for workspace-related files.
 *
 * Detection order:
 * 1. turbo.json → Turborepo (supported in V1)
 * 2. pnpm-workspace.yaml → pnpm workspace (not supported in V1)
 * 3. package.json with "workspaces" field → npm/yarn/bun workspace
 */
export function detectWorkspace(dir: string): WorkspaceInfo {
  // Check for Turborepo
  if (existsSync(join(dir, "turbo.json"))) {
    const workspaces = readWorkspacesFromPackageJson(dir);
    const appsDir = workspaces?.find((w) => w.startsWith("apps")) ? "apps" : undefined;
    const packagesDir = workspaces?.find((w) => w.startsWith("packages")) ? "packages" : undefined;

    return {
      detected: true,
      type: "turborepo",
      supported: true,
      appsDir: appsDir ?? "apps",
      packagesDir: packagesDir ?? "packages",
      workspaces,
    };
  }

  // Check for pnpm workspace
  if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
    return {
      detected: true,
      type: "pnpm",
      supported: false,
    };
  }

  // Check for npm/yarn/bun workspaces in package.json
  const workspaces = readWorkspacesFromPackageJson(dir);
  if (workspaces && workspaces.length > 0) {
    return {
      detected: true,
      type: "npm-workspaces",
      supported: true,
      workspaces,
    };
  }

  return { detected: false };
}

/**
 * Read the "workspaces" field from a directory's package.json.
 */
function readWorkspacesFromPackageJson(dir: string): string[] | undefined {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) return undefined;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    if (Array.isArray(pkg.workspaces)) {
      return pkg.workspaces as string[];
    }
    return undefined;
  } catch {
    return undefined;
  }
}
