import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Marker } from "../../marker/schema";
import { MARKER_FILENAME } from "../../marker/schema";
import { buildMarker } from "../../marker/write";

export type FixtureFile = {
  path: string;
  content: string;
};

export type FixtureProject = {
  root: string;
  marker: Marker | null;
  cleanup: () => Promise<void>;
};

export type BuildFixtureOptions = {
  files?: FixtureFile[];
  marker?: Marker | null;
  /**
   * Provide raw text for the marker file. Overrides `marker` when present;
   * lets tests write malformed JSON or schema-invalid bodies.
   */
  markerRaw?: string;
};

export async function buildFixture(opts: BuildFixtureOptions = {}): Promise<FixtureProject> {
  const root = await mkdtemp(join(tmpdir(), "oe-fixture-"));
  const cleanup = async () => {
    await rm(root, { recursive: true, force: true });
  };

  if (opts.markerRaw !== undefined) {
    await writeFile(join(root, MARKER_FILENAME), opts.markerRaw);
  } else if (opts.marker !== null) {
    const marker =
      opts.marker ??
      buildMarker({
        toolkitVersion: "0.0.3",
        projectType: "web-app",
        scaffoldSeed: "ab12cd34ef56",
        scaffoldedAt: "2026-05-15T14:23:11.482Z",
      });
    await writeFile(join(root, MARKER_FILENAME), `${JSON.stringify(marker, null, 2)}\n`);
  }

  for (const f of opts.files ?? []) {
    const abs = join(root, f.path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, f.content);
  }

  return {
    root,
    marker: opts.marker ?? null,
    cleanup,
  };
}

export async function buildStagedTree(
  files: FixtureFile[],
): Promise<{ stagedRoot: string; cleanup: () => Promise<void> }> {
  const stagedRoot = await mkdtemp(join(tmpdir(), "oe-staged-"));
  for (const f of files) {
    const abs = join(stagedRoot, f.path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, f.content);
  }
  return {
    stagedRoot,
    cleanup: async () => {
      await rm(stagedRoot, { recursive: true, force: true });
    },
  };
}
