import { chmod, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MARKER_FILENAME, type Marker, MarkerSchema } from "./schema";

export async function writeMarker(projectRoot: string, marker: Marker): Promise<string> {
  const validated = MarkerSchema.parse(marker);
  const target = join(projectRoot, MARKER_FILENAME);
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  const body = `${JSON.stringify(validated, null, 2)}\n`;
  await writeFile(tmp, body, { encoding: "utf8", mode: 0o644 });
  await rename(tmp, target);
  await chmod(target, 0o644).catch(() => {
    // chmod may be a no-op on some Windows filesystems; ignore.
  });
  return target;
}

export function buildMarker(input: {
  toolkitVersion: string;
  projectType: Marker["projectType"];
  scaffoldSeed: string;
  scaffoldedAt?: string;
}): Marker {
  return MarkerSchema.parse({
    toolkitVersion: input.toolkitVersion,
    scaffoldedAt: input.scaffoldedAt ?? new Date().toISOString(),
    projectType: input.projectType,
    scaffoldSeed: input.scaffoldSeed,
  });
}
