import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { Readable } from "node:stream";
import { updateAction } from "../cli/update";
import { buildFixture, type FixtureFile } from "./__fixtures__/build-fixture";
import type { ExtractOptions } from "./extract";
import { FetchError, type FetchResult } from "./fetch";

async function hashTree(root: string): Promise<string> {
  const entries: { path: string; content: Buffer }[] = [];
  await walk(root, root, entries);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  const hash = createHash("sha256");
  for (const e of entries) {
    hash.update(e.path);
    hash.update("\0");
    hash.update(e.content);
    hash.update("\n");
  }
  return hash.digest("hex");
}

async function walk(
  root: string,
  dir: string,
  out: { path: string; content: Buffer }[],
): Promise<void> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return;
  }
  for (const name of names) {
    const abs = join(dir, name);
    const info = await stat(abs);
    if (info.isDirectory()) {
      await walk(root, abs, out);
    } else if (info.isFile()) {
      const rel = relative(root, abs).split(sep).join("/");
      const content = await readFile(abs);
      out.push({ path: rel, content });
    }
  }
}

function fakeFetch(): () => Promise<FetchResult> {
  return async () => ({
    body: Readable.from([Buffer.from("ignored")]),
    sha: "0".repeat(40),
    shortSha: "0000000",
    version: "0.0.0-test",
  });
}

function fakeExtract(files: FixtureFile[]): (opts: ExtractOptions) => Promise<void> {
  return async (opts) => {
    for (const f of files) {
      const abs = join(opts.destDir, f.path);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, f.content);
    }
  };
}

describe("updateAction atomicity (SC-009)", () => {
  test("marker-absent abort leaves tree untouched", async () => {
    const project = await buildFixture({
      marker: null,
      files: [{ path: ".claude/agents/foo.md", content: "local agent content\n" }],
    });
    try {
      const before = await hashTree(project.root);
      const result = await updateAction(project.root, {
        yes: true,
        dryRun: false,
        verbose: false,
      });
      const after = await hashTree(project.root);
      expect(result.exitCode).toBe(2);
      expect(after).toBe(before);
    } finally {
      await project.cleanup();
    }
  });

  test("marker-malformed abort leaves tree untouched", async () => {
    const project = await buildFixture({
      markerRaw: "{not json",
      files: [{ path: ".claude/agents/foo.md", content: "local\n" }],
    });
    try {
      const before = await hashTree(project.root);
      const result = await updateAction(project.root, {
        yes: true,
        dryRun: false,
        verbose: false,
      });
      const after = await hashTree(project.root);
      expect(result.exitCode).toBe(2);
      expect(after).toBe(before);
    } finally {
      await project.cleanup();
    }
  });

  test("fetch-error abort leaves tree untouched", async () => {
    const project = await buildFixture({
      files: [{ path: ".claude/agents/foo.md", content: "local\n" }],
    });
    try {
      const before = await hashTree(project.root);
      const result = await updateAction(
        project.root,
        { yes: true, dryRun: false, verbose: false },
        {
          fetchTarball: async () => {
            throw new FetchError("simulated network drop", "network");
          },
        },
      );
      const after = await hashTree(project.root);
      expect(result.exitCode).toBe(3);
      expect(after).toBe(before);
    } finally {
      await project.cleanup();
    }
  });

  test("dry-run with pending actions leaves tree untouched", async () => {
    const project = await buildFixture({
      files: [{ path: ".claude/agents/foo.md", content: "local edit\n" }],
    });
    try {
      const before = await hashTree(project.root);
      const result = await updateAction(
        project.root,
        { yes: true, dryRun: true, verbose: false },
        {
          fetchTarball: fakeFetch(),
          extractTarball: fakeExtract([
            { path: "templates/.claude/agents/foo.md", content: "upstream version\n" },
            { path: "templates/.claude/agents/bar.md", content: "brand new\n" },
          ]),
        },
      );
      const after = await hashTree(project.root);
      expect(result.exitCode).toBe(0);
      expect(after).toBe(before);
      expect(result.summary?.actions.length).toBeGreaterThan(0);
    } finally {
      await project.cleanup();
    }
  });

  test("sanity: non-dry-run with adds DOES write (hashes differ)", async () => {
    const project = await buildFixture({
      files: [{ path: ".claude/agents/foo.md", content: "local edit\n" }],
    });
    try {
      const before = await hashTree(project.root);
      const result = await updateAction(
        project.root,
        { yes: true, dryRun: false, verbose: false },
        {
          fetchTarball: fakeFetch(),
          extractTarball: fakeExtract([
            { path: "templates/.claude/agents/bar.md", content: "brand new\n" },
          ]),
        },
      );
      const after = await hashTree(project.root);
      expect(result.exitCode).toBe(0);
      expect(after).not.toBe(before);
    } finally {
      await project.cleanup();
    }
  });
});
