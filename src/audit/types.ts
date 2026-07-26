/**
 * Shared types for dataset validation (dev-stacks and agent-stacks).
 */

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  rule: string;
  tool: string;
  details: string;
  severity: ValidationSeverity;
}
