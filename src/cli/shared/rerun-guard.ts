import { readMarker } from "../../marker/read";
import { cleanupScratch } from "../../scaffold/cleanup";

/**
 * Inspect the target directory state. Drives the FR-012 rerun guard.
 *  - "already-scaffolded": a valid `.outputease` marker exists. Refuse.
 *  - "dirty": no marker but `.tmp-*` / scratch dirs present. Clean and proceed.
 *  - "clean": empty or unrelated content. Proceed.
 */
export async function rerunGuard(
  targetDir: string,
): Promise<{ kind: "already-scaffolded" | "dirty" | "clean"; removed: string[] }> {
  const marker = await readMarker(targetDir);
  if (marker.ok) {
    return { kind: "already-scaffolded", removed: [] };
  }
  const report = await cleanupScratch(targetDir);
  if (report.removed.length > 0) {
    return { kind: "dirty", removed: report.removed };
  }
  return { kind: "clean", removed: [] };
}
