import { z } from "zod";

/**
 * Zod schema for `data/agent-targets.json` — the per-vendor mapping table
 * (spec 008, data-model.md §1). Single source of truth for the dataset; the
 * generated JSON Schema and all TypeScript types derive from here.
 *
 * Per-target facts (paths, format families, capability flags) live in the data;
 * emitters are code keyed by `EmitterFamily`. A new target that reuses existing
 * families is a data-only change (FR-015).
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const agentTargetIdSchema = z
  .enum(["claude", "codex", "gemini", "opencode", "cursor", "copilot", "windsurf"])
  .describe("Supported agent target id (primary key; extensible enum)");

/**
 * Output format families. Emitters are registered against these in
 * `agents/emitters/index.ts`; the `family-known` cross-field rule asserts every
 * referenced family has a registered emitter.
 */
export const emitterFamilySchema = z
  .enum([
    "instructions-agentsmd",
    "instructions-claudemd",
    "instructions-gemini-settings",
    "instructions-mdc-rule",
    "instructions-windsurf-rule",
    "instructions-copilot-md",
    "instructions-opencode-json",
    "mcp-json-mcpServers",
    "mcp-json-servers",
    "mcp-toml-codex",
    "mcp-opencode-json",
    "mcp-gemini-settings",
    "mcp-devin-json",
    "commands-toml-gemini",
    "commands-md-opencode",
    "skills-copy",
    "claude-passthrough",
    "codex-passthrough",
  ])
  .describe("Output format family an emitter is keyed by");

export const agentBucketSchema = z
  .enum(["cli", "ide"])
  .describe("Delivery bucket: CLI agent or IDE agent");

export const agentPhaseSchema = z
  .enum(["dogfood", "toolkit"])
  .describe("Delivery sequencing: monorepo-first (dogfood) vs published-surface (toolkit)");

export const agentsMdSupportSchema = z
  .enum(["native", "bridge", "none"])
  .describe("How the target discovers AGENTS.md");

export const argPlaceholderSchema = z
  .enum(["$ARGUMENTS", "{{args}}", "free-text", "input-vars"])
  .describe("Argument substitution dialect for user-invoked skills");

// ---------------------------------------------------------------------------
// Shared field shapes
// ---------------------------------------------------------------------------

const httpsUrl = z
  .string()
  .url()
  .refine((u) => u.startsWith("https://"), { message: "docsUrl must use HTTPS" });

/** `{ file, emitter }` — bridge that teaches a target to read AGENTS.md. */
export const bridgeRefSchema = z
  .strictObject({
    file: z.string().min(1),
    emitter: emitterFamilySchema,
  })
  .nullable();

/** `{ placement, emitter, charLimit? }` — where a target's addendum instructions land. */
export const addendumRefSchema = z
  .strictObject({
    placement: z.string().min(1),
    emitter: emitterFamilySchema,
    charLimit: z.number().int().optional(),
  })
  .nullable();

/** `{ path, family }` — a concrete emit target (MCP config, wrapper dir, etc.). */
export const emitRefSchema = z
  .strictObject({
    path: z.string().min(1),
    family: emitterFamilySchema,
  })
  .nullable();

export const wrapperRefSchema = z
  .strictObject({
    dir: z.string().min(1),
    family: emitterFamilySchema,
  })
  .nullable();

export const instructionsSchema = z.strictObject({
  agentsMdSupport: agentsMdSupportSchema,
  bridge: bridgeRefSchema,
  addendum: addendumRefSchema,
});

export const mcpSchema = z.strictObject({
  emit: emitRefSchema,
  scopeCaveat: z.string().nullable(),
  userGlobal: emitRefSchema,
});

export const skillsSchema = z.strictObject({
  readsAgentsSkillsDir: z.boolean(),
  copyPath: z.string().nullable(),
  argPlaceholder: argPlaceholderSchema,
  wrapper: wrapperRefSchema,
  // Loosely typed (int, no positivity constraint) so `char-limit-positive`
  // cross-field rule owns the >0 check (data-model.md §1).
  descriptionCharLimit: z.number().int().nullable(),
});

export const capabilitiesSchema = z.strictObject({
  toolRestriction: z.boolean(),
  modelInvocationControl: z.boolean(),
  subagents: z.boolean(),
  hooks: z.boolean(),
});

// ---------------------------------------------------------------------------
// Entry + file
// ---------------------------------------------------------------------------

export const agentTargetSchema = z.strictObject({
  id: agentTargetIdSchema,
  displayName: z.string().min(1).max(100),
  bucket: agentBucketSchema,
  phase: agentPhaseSchema,
  instructions: instructionsSchema,
  mcp: mcpSchema,
  skills: skillsSchema,
  capabilities: capabilitiesSchema,
  docsUrl: z.array(httpsUrl),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "asOf must be an ISO date (YYYY-MM-DD)"),
  notes: z.string().nullable(),
});

export const agentTargetsFileSchema = z.array(agentTargetSchema);

// ---------------------------------------------------------------------------
// Types (derived — never hand-written)
// ---------------------------------------------------------------------------

export type AgentTargetId = z.infer<typeof agentTargetIdSchema>;
export type EmitterFamily = z.infer<typeof emitterFamilySchema>;
export type AgentBucket = z.infer<typeof agentBucketSchema>;
export type AgentPhase = z.infer<typeof agentPhaseSchema>;
export type AgentsMdSupport = z.infer<typeof agentsMdSupportSchema>;
export type ArgPlaceholder = z.infer<typeof argPlaceholderSchema>;
export type BridgeRef = z.infer<typeof bridgeRefSchema>;
export type AddendumRef = z.infer<typeof addendumRefSchema>;
export type EmitRef = z.infer<typeof emitRefSchema>;
export type WrapperRef = z.infer<typeof wrapperRefSchema>;
export type AgentTargetInstructions = z.infer<typeof instructionsSchema>;
export type AgentTargetMcp = z.infer<typeof mcpSchema>;
export type AgentTargetSkills = z.infer<typeof skillsSchema>;
export type AgentTargetCapabilities = z.infer<typeof capabilitiesSchema>;
export type AgentTarget = z.infer<typeof agentTargetSchema>;
