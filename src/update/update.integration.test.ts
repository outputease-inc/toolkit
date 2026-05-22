import { describe, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { updateAction } from "../cli/update";
import { buildFixture } from "./__fixtures__/build-fixture";
import type { ExtractOptions } from "./extract";
import type { FetchResult } from "./fetch";

function fakeFetch(): () => Promise<FetchResult> {
  return async () => ({
    body: Readable.from([Buffer.from("ignored")]),
    sha: "a".repeat(40),
    shortSha: "aaaaaaa",
    version: "0.2.0",
  });
}

function fakeExtract(
  files: { path: string; content: string }[],
): (opts: ExtractOptions) => Promise<void> {
  return async (opts) => {
    for (const f of files) {
      const abs = join(opts.destDir, f.path);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, f.content);
    }
  };
}

describe("updateAction integration (full pipeline, mocked source)", () => {
  test("classifies add, update, unchanged across .claude tree", async () => {
    const project = await buildFixture({
      files: [
        { path: ".claude/agents/dependency-auditor.md", content: "stale local edit\n" },
        { path: ".claude/agents/test-writer.md", content: "same as upstream\n" },
      ],
    });
    try {
      const result = await updateAction(
        project.root,
        { yes: true, dryRun: false, verbose: false },
        {
          fetchTarball: fakeFetch(),
          extractTarball: fakeExtract([
            {
              path: "templates/.claude/agents/dependency-auditor.md",
              content: "upstream content\n",
            },
            { path: "templates/.claude/agents/test-writer.md", content: "same as upstream\n" },
            { path: "templates/.claude/agents/new-agent.md", content: "brand new\n" },
            {
              path: "templates/.specify/memory/constitution.md",
              content: "upstream constitution\n",
            },
          ]),
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.summary?.upstreamSha).toBe("aaaaaaa");
      expect(result.summary?.actions).toHaveLength(4);

      const newFile = await readFile(join(project.root, ".claude/agents/new-agent.md"), "utf8");
      expect(newFile).toBe("brand new\n");

      const localEdit = await readFile(
        join(project.root, ".claude/agents/dependency-auditor.md"),
        "utf8",
      );
      expect(localEdit).toBe("stale local edit\n");

      const constitution = await readFile(
        join(project.root, ".specify/memory/constitution.md"),
        "utf8",
      );
      expect(constitution).toBe("upstream constitution\n");
    } finally {
      await project.cleanup();
    }
  });

  test("idempotent re-run produces zero writes (all paths classify unchanged or skip)", async () => {
    const project = await buildFixture({
      files: [{ path: ".claude/agents/foo.md", content: "matches upstream\n" }],
    });
    try {
      const stagedFiles = [
        { path: "templates/.claude/agents/foo.md", content: "matches upstream\n" },
        { path: "templates/.claude/agents/bar.md", content: "new in upstream\n" },
      ];

      const r1 = await updateAction(
        project.root,
        { yes: true, dryRun: false, verbose: false },
        { fetchTarball: fakeFetch(), extractTarball: fakeExtract(stagedFiles) },
      );
      expect(r1.exitCode).toBe(0);

      const r2 = await updateAction(
        project.root,
        { yes: true, dryRun: false, verbose: false },
        { fetchTarball: fakeFetch(), extractTarball: fakeExtract(stagedFiles) },
      );
      expect(r2.exitCode).toBe(0);
      const addsOnRun2 = r2.summary?.actions.filter((a) => a.kind === "add") ?? [];
      expect(addsOnRun2).toHaveLength(0);
    } finally {
      await project.cleanup();
    }
  });
});
