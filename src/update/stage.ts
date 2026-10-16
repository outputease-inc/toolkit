import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type StagingDir = {
  path: string;
  cleanup: () => Promise<void>;
};

export async function createStagingDir(): Promise<StagingDir> {
  const suffix = randomBytes(4).toString("hex");
  const base = join(tmpdir(), `outputease-update-${suffix}-`);
  const path = await mkdtemp(base);
  let cleaned = false;
  return {
    path,
    cleanup: async () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      await rm(path, { recursive: true, force: true });
    },
  };
}
