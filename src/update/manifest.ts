import { z } from "zod";

export const UpdateScopeSchema = z
  .object({
    /**
     * Optional prefix (POSIX-style) that lives inside the staged tarball but
     * should be stripped when mapping to the project tree. When the toolkit
     * is published to npm, its tarball ships `templates/.claude/...` etc.,
     * but those map to project paths `.claude/...`.
     */
    sourcePrefix: z.string().default(""),
    directories: z.array(z.string()).readonly(),
    rootFiles: z.array(z.string()).readonly(),
  })
  .strict();

export type UpdateScope = z.infer<typeof UpdateScopeSchema>;

export const UPDATE_SCOPE: UpdateScope = {
  sourcePrefix: "templates",
  directories: [".claude"],
  rootFiles: [".mcp.json"],
} as const;

/**
 * Update scope for a multi-agent project (spec 008). Refreshes the toolkit-owned
 * neutral source (skills + Claude passthrough); NEVER `.agents/instructions/`
 * (project-owned), `.agents/mcp/` (user-owned), or the generated trees (`.claude/`,
 * `.codex/`, `.mcp.json`, `AGENTS.md`, …) — those are regenerated, not diffed. The
 * toolkit-owned source is re-derived into staging at update time, not shipped.
 *
 * `.specify` left this scope (and UPDATE_SCOPE) with the ask-4 payload gate: spec-kit
 * is no longer vendored, so there is nothing in the tarball to deliver. Refresh moved
 * to `outputease speckit refresh` plus the update-time prompt (design §5.7).
 */
export const MULTI_AGENT_UPDATE_SCOPE: UpdateScope = {
  sourcePrefix: "templates",
  directories: [".agents/skills", ".agents/targets"],
  rootFiles: [],
} as const;

/**
 * Join `sourcePrefix` with a target-tree relative path to get the staged-tree
 * relative path. Returns `path` unchanged when `sourcePrefix` is empty.
 */
export function toStagedPath(path: string, scope: UpdateScope = UPDATE_SCOPE): string {
  if (!scope.sourcePrefix) return path;
  return `${scope.sourcePrefix}/${path}`;
}

/**
 * Strip `sourcePrefix` from a staged-tree relative path to get the project-
 * relative target path. Returns null when the staged path doesn't live under
 * the prefix (caller should treat as out-of-scope).
 */
export function toTargetPath(stagedPath: string, scope: UpdateScope = UPDATE_SCOPE): string | null {
  if (!scope.sourcePrefix) return stagedPath;
  const prefix = `${scope.sourcePrefix}/`;
  if (!stagedPath.startsWith(prefix)) return null;
  return stagedPath.slice(prefix.length);
}

export function isPathInScope(relativePath: string, scope: UpdateScope = UPDATE_SCOPE): boolean {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
  if (normalized === "" || normalized.startsWith("..")) {
    return false;
  }
  if (scope.rootFiles.includes(normalized)) {
    return true;
  }
  return scope.directories.some((dir) => {
    const prefix = `${dir}/`;
    return normalized === dir || normalized.startsWith(prefix);
  });
}
