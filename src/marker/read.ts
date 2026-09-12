import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MARKER_FILENAME, type Marker, MarkerSchema } from "./schema";

export type ReadMarkerResult =
  | { ok: true; marker: Marker; path: string }
  | { ok: false; reason: "absent"; path: string }
  | { ok: false; reason: "malformed-json"; path: string; error: string }
  | { ok: false; reason: "schema-invalid"; path: string; issues: string[] };

export async function readMarker(projectRoot: string): Promise<ReadMarkerResult> {
  const path = join(projectRoot, MARKER_FILENAME);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, reason: "absent", path };
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      reason: "malformed-json",
      path,
      error: (err as Error).message,
    };
  }

  const result = MarkerSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      reason: "schema-invalid",
      path,
      issues: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }

  return { ok: true, marker: result.data, path };
}
