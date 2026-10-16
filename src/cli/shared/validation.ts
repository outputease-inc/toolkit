/**
 * Project-name validation shared by the interactive prompt and the programmatic
 * `runInit` entry point, so a name accepted at the prompt can never be rejected
 * later (single source of truth).
 *
 * Accepts a bare npm name (`foo-bar`) or a scoped name (`@scope/name`). Bare
 * slashes and parent-directory segments (`..`) are rejected to block path
 * traversal via the project name.
 */
export const SAFE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;

export function isValidProjectName(name: string): boolean {
  return SAFE_NAME.test(name) && !name.includes("..");
}

export const INVALID_NAME_MESSAGE =
  "Must be a valid npm package name (lowercase alphanumerics, hyphens, dots, underscores, or @scope/name).";
