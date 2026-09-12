import { z } from "zod";
import { agentTargetIdSchema, emitterFamilySchema } from "../schema/agent-targets";

/**
 * Zod schemas for the neutral source layer (spec 008, data-model.md §2-§5).
 *
 * The neutral source is hand-edited Markdown + JSON under `.agents/`; every
 * frontmatter block is parsed then validated here. Unknown keys are rejected —
 * vendor-tolerant leniency applies to generated OUTPUTS, not to the source.
 */

// ---------------------------------------------------------------------------
// §2 InstructionBlock
// ---------------------------------------------------------------------------

/** scope: core (→ AGENTS.md + every surface) | a target id (→ that surface only). */
export const blockScopeSchema = z.union([z.literal("core"), agentTargetIdSchema]);

/**
 * Authored serialization for `paths` is the INLINE array and nothing else.
 * `parseFrontmatterFields` (`source.ts:94`) reads only `^key:` lines and skips
 * indented continuations; `parseScalar` (`:81`) knows `[a, b]`, `true`/`false`,
 * `|`/`>` blocks and bare scalars. A YAML block sequence therefore arrives as
 * the empty string — hence the explicit message, so that mistake fails with a
 * pointer to the fix rather than a bare "expected array, received string".
 * Precedent for the inline form: `targets: [claude]` in `.agents/skills/`.
 */
const INLINE_PATHS_HINT =
  'paths must be an inline array — paths: ["a/**", "b/**"]. A YAML block sequence parses to the empty string and scopes nothing.';

export const instructionBlockFrontmatterSchema = z.strictObject({
  scope: blockScopeSchema,
  title: z.string().min(1),
  // Distinguished SPECKIT block: opaque passthrough spec-kit keeps rewriting.
  speckit: z.boolean().optional(),
  /** US7: path-scoped block — deferred to `.claude/rules/` on the claude surface. */
  paths: z
    .array(z.string().min(1, "a path glob must be non-empty"), {
      error: (iss) => (iss.code === "invalid_type" ? INLINE_PATHS_HINT : undefined),
    })
    .min(1, "paths must list at least one glob — omit the key for an always-loaded block")
    .optional(),
});

/** order.json — filenames in assembly order; loader asserts each listed exactly once. */
export const instructionOrderSchema = z.array(z.string().min(1));

// ---------------------------------------------------------------------------
// §3 NeutralSkill
// ---------------------------------------------------------------------------

export const skillArgsSchema = z.enum(["substituted", "free-text", "none"]);

export const neutralSkillFrontmatterSchema = z.strictObject({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "name must be lowercase kebab-case"),
  description: z.string().min(1).max(1024),
  "allowed-tools": z.string().optional(),
  "disable-model-invocation": z.boolean().optional(),
  "argument-hint": z.string().optional(),
  targets: z.array(agentTargetIdSchema).optional(),
  args: skillArgsSchema.optional(),
});

/**
 * Full skill validation: frontmatter + body + directory name.
 * - dirName must equal frontmatter.name
 * - a literal `$ARGUMENTS` in the body requires `args: substituted`
 */
export const neutralSkillSchema = z
  .strictObject({
    frontmatter: neutralSkillFrontmatterSchema,
    body: z.string(),
    dirName: z.string(),
  })
  .superRefine((skill, ctx) => {
    if (skill.dirName !== skill.frontmatter.name) {
      ctx.addIssue({
        code: "custom",
        path: ["dirName"],
        message: `skill directory "${skill.dirName}" must equal frontmatter name "${skill.frontmatter.name}"`,
      });
    }
    if (skill.body.includes("$ARGUMENTS") && skill.frontmatter.args !== "substituted") {
      ctx.addIssue({
        code: "custom",
        path: ["frontmatter", "args"],
        message: 'body contains "$ARGUMENTS" but args is not "substituted"',
      });
    }
  });

// ---------------------------------------------------------------------------
// §4 McpServerDef
// ---------------------------------------------------------------------------

/**
 * Patterns that flag an env VALUE as a likely literal secret. The neutral source
 * must reference secrets via env-var expansion (e.g. `${MY_TOKEN}`), never inline
 * them (extends the protect-sensitive conventions to the mapping layer).
 */
const SECRET_ISH_PATTERNS: RegExp[] = [
  /\b(sk|pk|rk)-[A-Za-z0-9]{16,}/, // OpenAI / Stripe style
  /\bgh[pousr]_[A-Za-z0-9]{20,}/, // GitHub tokens
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/, // Slack tokens
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // JWT
  /^[A-Fa-f0-9]{40,}$/, // long hex blob
  /^[A-Za-z0-9+/]{40,}={0,2}$/, // long base64 blob
];

function looksLikeSecret(value: string): boolean {
  return SECRET_ISH_PATTERNS.some((re) => re.test(value));
}

export const mcpTransportSchema = z.enum(["stdio", "http", "sse"]);

export const mcpServerDefSchema = z
  .strictObject({
    name: z.string().min(1),
    transport: mcpTransportSchema,
    command: z.string().min(1).optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    url: z.string().min(1).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    targets: z.array(agentTargetIdSchema).optional(),
  })
  .superRefine((server, ctx) => {
    if (server.transport === "stdio" && !server.command) {
      ctx.addIssue({
        code: "custom",
        path: ["command"],
        message: "stdio transport requires a command",
      });
    }
    if ((server.transport === "http" || server.transport === "sse") && !server.url) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: `${server.transport} transport requires a url`,
      });
    }
    for (const [key, value] of Object.entries(server.env ?? {})) {
      if (looksLikeSecret(value)) {
        ctx.addIssue({
          code: "custom",
          path: ["env", key],
          message: `env value for "${key}" looks like a literal secret — use an env-var reference (\${VAR})`,
        });
      }
    }
  });

export const mcpServersFileSchema = z.array(mcpServerDefSchema);

// ---------------------------------------------------------------------------
// §4b Declared plugin dependencies (spec 010 US8, decision S12)
// ---------------------------------------------------------------------------

/**
 * One third-party plugin this repository's own skills route to.
 *
 * The record answers "what does this repository depend on?" and deliberately NOT "what is
 * installed on this machine?" — the second has no source CI can read, and asserting it is
 * prohibited by FR-025. `/plugin` answers that at runtime, where it is answerable.
 *
 * Every field is required and non-empty by design. An entry that cannot state its role or its
 * tie-break against the repository-owned equivalent is the finding, not the record; and
 * `routedFrom` is the evidence the plugin is a dependency at all, which is what turns findings
 * E3/E4/E5 from a judgement call into a decidable one.
 */
export const declaredPluginSchema = z.strictObject({
  /** Plugin identifier as installed. */
  name: z.string().min(1),
  /** What this repository uses it for. */
  role: z.string().min(1, "role must state what this repository uses the plugin for"),
  /** Why it is preferred over, or how it defers to, the repository-owned equivalent. */
  tieBreak: z.string().min(1, "tieBreak must state how this plugin relates to what OE owns"),
  /**
   * Repo-relative paths of the skills or instruction blocks that route to it. Existence is
   * checked by `declared-plugins.test.ts`, not here: a schema that stats the filesystem cannot
   * validate a fixture, and every caller of this schema runs inside the repository anyway.
   */
  routedFrom: z.array(z.string().min(1)).min(1, "a plugin nothing routes to is not a dependency"),
});

export const declaredPluginsFileSchema = z.array(declaredPluginSchema);

export type DeclaredPlugin = z.infer<typeof declaredPluginSchema>;

// ---------------------------------------------------------------------------
// §5 GeneratedManifest
// ---------------------------------------------------------------------------

/** Emitted-file attribution: a target id, or "shared" for the common AGENTS.md core. */
export const manifestTargetSchema = z.union([agentTargetIdSchema, z.literal("shared")]);

/** An emitter family, or "fidelity" for the generate-owned fidelity outputs. */
export const manifestFamilySchema = z.union([emitterFamilySchema, z.literal("fidelity")]);

export const manifestFileSchema = z.strictObject({
  path: z.string().min(1),
  sha256: z.string().min(1),
  target: manifestTargetSchema,
  source: z.string(),
  family: manifestFamilySchema,
});

export const manifestSourceSchema = z.strictObject({
  path: z.string().min(1),
  sha256: z.string().min(1),
});

/**
 * The manifest is committed AND regenerated on every run, so it must be
 * byte-stable across runs with unchanged inputs (idempotence, V2/SC-003). It
 * therefore carries NO wall-clock timestamp — only the stable toolkit version
 * plus content hashes. `check` re-derives and byte-compares it wholesale.
 */
export const generatedManifestSchema = z.strictObject({
  toolkitVersion: z.string().min(1),
  files: z.array(manifestFileSchema),
  sources: z.array(manifestSourceSchema),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BlockScope = z.infer<typeof blockScopeSchema>;
export type InstructionBlockFrontmatter = z.infer<typeof instructionBlockFrontmatterSchema>;
export type SkillArgs = z.infer<typeof skillArgsSchema>;
export type NeutralSkillFrontmatter = z.infer<typeof neutralSkillFrontmatterSchema>;
export type NeutralSkill = z.infer<typeof neutralSkillSchema>;
export type McpTransport = z.infer<typeof mcpTransportSchema>;
export type McpServerDef = z.infer<typeof mcpServerDefSchema>;
export type ManifestTarget = z.infer<typeof manifestTargetSchema>;
export type ManifestFile = z.infer<typeof manifestFileSchema>;
export type ManifestSource = z.infer<typeof manifestSourceSchema>;
export type GeneratedManifest = z.infer<typeof generatedManifestSchema>;

// ---------------------------------------------------------------------------
// §6 FidelityReport
// ---------------------------------------------------------------------------

export const fidelityTierSchema = z.enum([
  "clean",
  "target-native",
  "degraded",
  "skipped",
  "claude-scoped",
  "integration-owned",
  "unplaceable",
]);

export const fidelityRowSchema = z.strictObject({
  item: z.string().min(1),
  tier: fidelityTierSchema,
  reason: z.string(),
});

export const fidelityReportSchema = z.strictObject({
  perTarget: z.record(z.string(), z.array(fidelityRowSchema)),
});

export type FidelityTier = z.infer<typeof fidelityTierSchema>;
export type FidelityRow = z.infer<typeof fidelityRowSchema>;
export type FidelityReport = z.infer<typeof fidelityReportSchema>;
