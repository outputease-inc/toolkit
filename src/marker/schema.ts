import { z } from "zod";

export const MARKER_FILENAME = ".outputease";

export const ProjectTypeSchema = z.enum([
  "web-app",
  "content-site",
  "mobile-app",
  "desktop-app",
  "cli",
  "library",
]);

export type ProjectType = z.infer<typeof ProjectTypeSchema>;

const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SCAFFOLD_SEED_RE = /^[0-9a-f]{12}$/;

/**
 * Advisory record of the spec-kit state a scaffold/refresh left behind. ADVISORY ONLY —
 * `existsSync(join(cwd, ".specify"))` stays the primary sniff, because `MarkerSchema` is
 * `.strict()`: a marker written by a NEW toolkit fails to parse under an OLDER installed
 * `outputease update`. Bounded and rare, but it is why nothing branches on this field.
 */
export const MarkerSpecKitSchema = z.object({
  /** spec-kit `--integration` value used for the last init/refresh. */
  integration: z.string(),
  /** The pinned github/spec-kit ref installed (`SPECKIT_REF`). */
  upstreamRef: z.string(),
  /** Bumped whenever the overlay rule set changes shape. */
  overlayVersion: z.number().int(),
  appliedAt: z.string(),
});

export type MarkerSpecKit = z.infer<typeof MarkerSpecKitSchema>;

export const MarkerSchema = z
  .object({
    toolkitVersion: z.string().regex(SEMVER_RE, "toolkitVersion must be semver (e.g. 0.2.0)"),
    scaffoldedAt: z
      .string()
      .regex(ISO_UTC_RE, "scaffoldedAt must be ISO 8601 UTC (YYYY-MM-DDTHH:mm:ss.sssZ)"),
    projectType: ProjectTypeSchema,
    scaffoldSeed: z.string().regex(SCAFFOLD_SEED_RE, "scaffoldSeed must be 12 lowercase hex chars"),
    specKit: MarkerSpecKitSchema.optional(),
  })
  .strict();

export type Marker = z.infer<typeof MarkerSchema>;
