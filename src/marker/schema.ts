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

export const MarkerSchema = z
  .object({
    toolkitVersion: z.string().regex(SEMVER_RE, "toolkitVersion must be semver (e.g. 0.2.0)"),
    scaffoldedAt: z
      .string()
      .regex(ISO_UTC_RE, "scaffoldedAt must be ISO 8601 UTC (YYYY-MM-DDTHH:mm:ss.sssZ)"),
    projectType: ProjectTypeSchema,
    scaffoldSeed: z.string().regex(SCAFFOLD_SEED_RE, "scaffoldSeed must be 12 lowercase hex chars"),
  })
  .strict();

export type Marker = z.infer<typeof MarkerSchema>;
