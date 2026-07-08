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

export const instructionBlockFrontmatterSchema = z.strictObject({
  scope: blockScopeSchema,
  title: z.string().min(1),
  // Distinguished SPECKIT block: opaque passthrough spec-kit keeps rewriting.
  speckit: z.boolean().optional(),
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
