import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { systemTarBin } from "../platform";

export type ExtractOptions = {
  body: NodeJS.ReadableStream;
  destDir: string;
  /**
   * Number of leading path components to strip from each archive entry.
   * npm tarballs ship as `package/...` (and codeload as `outputease-<sha>/...`),
   * so default is 1.
   */
  strip?: number;
  /**
   * Expected SHA-1 of the tarball bytes (npm registry `dist.shasum`). When
   * provided, the buffered download is hashed and compared before extraction;
   * a mismatch throws and nothing is written. Defends against a corrupted or
   * tampered tarball (poisoned CDN cache, malicious mirror) being unpacked into
   * the user's `.claude/` / `.specify/` tree.
   */
  expectedSha?: string;
};

/**
 * Extract a tarball stream into `destDir` via the system `tar` binary.
 *
 * The npm `tar` package's streaming and `sync: true` extractors both silently
 * drop file bodies under Bun on Windows (directories materialize but files
 * land empty). The OS-shipped tar handles this reliably:
 *   - Windows 10/11: `C:\Windows\System32\tar.exe` (libarchive / bsdtar)
 *   - macOS:          /usr/bin/tar (bsdtar)
 *   - Linux:          /usr/bin/tar (GNU tar)
 *
 * Buffer the stream to a tempfile first because every tar variant supports
 * `-xzf <file>` but not all support reading from stdin reliably across shells.
 */
export async function extractTarball(opts: ExtractOptions): Promise<void> {
  const { body, destDir, strip = 1, expectedSha } = opts;
  await mkdir(destDir, { recursive: true });

  const scratch = await mkdtemp(join(tmpdir(), "oe-tar-"));
  const tgzPath = join(scratch, "archive.tgz");
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    const buf = Buffer.concat(chunks);

    // Verify integrity BEFORE writing/extracting — fail closed on mismatch.
    if (expectedSha) {
      const actual = createHash("sha1").update(buf).digest("hex").toLowerCase();
      if (actual !== expectedSha.toLowerCase()) {
        throw new Error(
          `Tarball integrity check failed: expected sha1 ${expectedSha}, got ${actual}. ` +
            "Refusing to extract a tarball that does not match the registry shasum.",
        );
      }
    }

    await writeFile(tgzPath, buf);

    const tarBin = systemTarBin();
    const result = spawnSync(
      tarBin,
      ["-xzf", tgzPath, "-C", destDir, `--strip-components=${strip}`],
      { encoding: "utf8" },
    );
    if (result.error) {
      throw new Error(`Failed to spawn ${tarBin}: ${result.error.message}`);
    }
    if (result.status !== 0) {
      throw new Error(
        `tar extraction failed (exit ${result.status}): ${result.stderr?.trim() ?? "unknown error"}`,
      );
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
