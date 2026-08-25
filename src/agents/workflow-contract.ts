export const WORKFLOW_CLASSES = [
  "agent-agnostic-required",
  "target-native",
  "claude-enhanced",
  "target-unsupported",
] as const;

export type WorkflowClass = (typeof WORKFLOW_CLASSES)[number];

export const CODEX_REQUIRED_WORKFLOWS = [
  "quickstart",
  "checkpoint",
  "continue",
  "session-end",
  "dev-check",
  "capture",
  "develop-idea",
  "load-context",
  "speckit-specify",
  "speckit-clarify",
  "speckit-plan",
  "speckit-tasks",
  "speckit-implement",
  "speckit-analyze",
  "speckit-checklist",
  "speckit-constitution",
  "speckit-archive",
  "speckit-git-feature",
  "speckit-git-commit",
  "speckit-git-remote",
  "speckit-git-validate",
  "speckit-git-initialize",
  "security-review",
  "release-recover",
] as const;

export type CodexRequiredWorkflow = (typeof CODEX_REQUIRED_WORKFLOWS)[number];

export const CODEX_WORKFLOW_GUIDE_REQUIRED_FRAGMENTS = [
  ...CODEX_REQUIRED_WORKFLOWS,
  ".agents/skills",
  ".specify/",
  "trailing text",
  "$ARGUMENTS",
] as const;

export const CLAUDE_ENHANCED_WORKFLOWS = [
  "hookify",
  "claude-settings",
  "claude-plugin-install",
  "claude-subagents",
  "claude-outputease-design-review",
] as const;

const CODEX_REQUIRED_WORKFLOW_SET = new Set<string>(CODEX_REQUIRED_WORKFLOWS);
const CLAUDE_ENHANCED_WORKFLOW_SET = new Set<string>(CLAUDE_ENHANCED_WORKFLOWS);

export function isCodexRequiredWorkflow(name: string): boolean {
  return CODEX_REQUIRED_WORKFLOW_SET.has(name);
}

export function getWorkflowClass(name: string): WorkflowClass {
  if (CODEX_REQUIRED_WORKFLOW_SET.has(name)) {
    return "agent-agnostic-required";
  }

  if (CLAUDE_ENHANCED_WORKFLOW_SET.has(name)) {
    return "claude-enhanced";
  }

  return "target-unsupported";
}
