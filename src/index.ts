export { detectPhantoms } from "./audit/detect-phantoms";
export { lintPlaceholders } from "./audit/lint-placeholders";
export type { ValidationIssue, ValidationSeverity } from "./audit/types";
export {
  type AgentStacksValidationResult,
  validateAgentStacks,
} from "./audit/validate-agent-stacks";
export {
  type AgentTargetsValidationResult,
  validateAgentTargets,
} from "./audit/validate-agent-targets";
export {
  type DevStacksValidationResult,
  validateDevStacks,
} from "./audit/validate-dev-stacks";
export { validateInventory } from "./audit/validate-inventory";
export { getAgentStacksPath, loadAgentStacks } from "./data/agent-stacks-loader";
export { getAgentTargetsPath, loadAgentTargets } from "./data/agent-targets-loader";
export { getDevStacksPath, loadDevStacks } from "./data/dev-stacks-loader";
export {
  DERIVED,
  loadConfig,
  REQUIRED_FIELDS,
  TOKEN_MAP,
} from "./pipeline/config-loader";
export { runListTokens } from "./pipeline/run";
export { listTokens } from "./pipeline/token-replacer";
export { validate } from "./pipeline/validator";
export {
  type AgentStackEntry,
  agentStackEntrySchema,
  agentStacksFileSchema,
} from "./schema/agent-stacks";
export {
  type AgentTarget,
  type AgentTargetId,
  agentTargetSchema,
  agentTargetsFileSchema,
  type EmitterFamily,
  emitterFamilySchema,
} from "./schema/agent-targets";
export {
  type PlatformType,
  platformTypeSchema,
  type ToolkitConfig,
  toolkitConfigSchema,
} from "./schema/config";
export {
  type DevStackEntry,
  devStackEntrySchema,
  devStacksFileSchema,
} from "./schema/dev-stacks";
export {
  PLACEHOLDER_REGISTRY,
  type PlaceholderRegistry,
} from "./schema/registry";
export {
  type FrameworkConfig,
  frameworkConfigSchema,
  type PackageManagerConfig,
  type PackageManagerName,
  packageManagerConfigSchema,
  packageManagerNameSchema,
  type ResolvedStack,
  type RollbackEntry,
  resolvedStackSchema,
  rollbackEntrySchema,
  type ScaffoldContext,
  type ScaffoldResult,
  type ScaffoldScope,
  scaffoldContextSchema,
  scaffoldResultSchema,
  scaffoldScopeSchema,
  UI_SCOPE_LABELS,
} from "./schema/scaffold";
export {
  ADDITIVE_QUESTIONS,
  type AdditiveRouteOption,
  type AdditiveRouteQuestion,
  BACKEND_QUESTION,
  RUNTIME_QUESTION,
} from "./tree/additive-routes";
export {
  type AdditiveRouteConfig,
  additiveRouteConfigSchema,
  type DecisionTreeLeaf,
  type DecisionTreeNode,
  type DecisionTreeOption,
  decisionTreeLeafSchema,
  decisionTreeNodeSchema,
  decisionTreeOptionSchema,
  type Preset,
  presetSchema,
} from "./tree/schema";
