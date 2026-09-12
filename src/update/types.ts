import { z } from "zod";

export const PlannedActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("add"),
    targetPath: z.string(),
    sourcePath: z.string(),
  }),
  z.object({
    kind: z.literal("update"),
    targetPath: z.string(),
    sourcePath: z.string(),
    hadLocalEdits: z.boolean(),
    resolution: z.enum(["overwrite", "skip"]),
  }),
  z.object({
    kind: z.literal("skip"),
    targetPath: z.string(),
    reason: z.enum(["unchanged", "user-skipped", "out-of-scope"]),
  }),
]);

export type PlannedAction = z.infer<typeof PlannedActionSchema>;

export const UpdateRunSummarySchema = z.object({
  installedToolkitVersion: z.string(),
  upstreamSha: z.string(),
  markerVersion: z.string(),
  versionDiverged: z.boolean(),
  fetchedVersion: z.string().optional(),
  actions: z.array(PlannedActionSchema),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  result: z.enum(["success", "aborted", "error"]),
});

export type UpdateRunSummary = z.infer<typeof UpdateRunSummarySchema>;

export type UpdateExitCode = 0 | 1 | 2 | 3 | 4 | 5;

export type UpdateCliOptions = {
  yes: boolean;
  dryRun: boolean;
  verbose: boolean;
};
