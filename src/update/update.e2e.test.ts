/**
 * End-to-end smoke test that hits the live npm registry. Gated by
 * `NPM_REGISTRY_E2E=1` so the normal `bun test` run stays offline.
 *
 * Run with:
 *   NPM_REGISTRY_E2E=1 bun test packages/toolkit/src/update/update.e2e.test.ts
 *
 * Verifies that `outputease update` works against the published
 * @outputease/toolkit tarball end-to-end:
 *   - Two-step fetch (metadata → tarball) succeeds
 *   - extract + diff + commit produce a non-empty action set
 *   - Wall-clock under 60s (SC-001 / T075)
 */
import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { updateAction } from "../cli/update";
import { buildFixture } from "./__fixtures__/build-fixture";

const ENABLED = process.env.NPM_REGISTRY_E2E === "1";
const TIMEOUT_MS = 90_000;

describe.skipIf(!ENABLED)("updateAction e2e (npm registry)", () => {
  test(
    "fetches latest tarball, classifies actions, completes under 60s",
    async () => {
      const project = await buildFixture({
        files: [{ path: ".claude/agents/dependency-auditor.md", content: "local edit\n" }],
      });
      try {
        const startMs = Date.now();
        const result = await updateAction(project.root, {
          yes: true,
          dryRun: true,
          verbose: false,
        });
        const elapsedMs = Date.now() - startMs;

        // Persist a small artifact for the release engineer to eyeball
        writeFileSync(
          join(project.root, "_e2e-summary.json"),
          JSON.stringify(
            {
              exitCode: result.exitCode,
              elapsedMs,
              upstreamSha: result.summary?.upstreamSha,
              actionCount: result.summary?.actions.length ?? 0,
            },
            null,
            2,
          ),
        );

        expect(result.exitCode).toBe(0);
        expect(result.summary?.actions.length).toBeGreaterThan(0);
        expect(result.summary?.upstreamSha).toMatch(/^[0-9a-f]{7}$/);
        expect(elapsedMs).toBeLessThan(60_000);
      } finally {
        await project.cleanup();
      }
    },
    TIMEOUT_MS,
  );
});
