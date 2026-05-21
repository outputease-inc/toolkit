import { describe, expect, test } from "bun:test";
import { updateAction } from "../cli/update";
import { buildFixture } from "./__fixtures__/build-fixture";

describe("updateAction preconditions", () => {
  test("exits with code 2 when marker is absent", async () => {
    const project = await buildFixture({ marker: null });
    try {
      const result = await updateAction(project.root, {
        yes: true,
        dryRun: true,
        verbose: false,
      });
      expect(result.exitCode).toBe(2);
    } finally {
      await project.cleanup();
    }
  });

  test("exits with code 2 when marker JSON is malformed", async () => {
    const project = await buildFixture({ markerRaw: "{not json" });
    try {
      const result = await updateAction(project.root, {
        yes: true,
        dryRun: true,
        verbose: false,
      });
      expect(result.exitCode).toBe(2);
    } finally {
      await project.cleanup();
    }
  });

  test("exits with code 2 when marker schema validation fails", async () => {
    const project = await buildFixture({
      markerRaw: JSON.stringify({
        toolkitVersion: "0.0.3",
        scaffoldedAt: "2026-05-15T14:23:11.482Z",
        projectType: "saas",
        scaffoldSeed: "ab12cd34ef56",
      }),
    });
    try {
      const result = await updateAction(project.root, {
        yes: true,
        dryRun: true,
        verbose: false,
      });
      expect(result.exitCode).toBe(2);
    } finally {
      await project.cleanup();
    }
  });
});
