import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type ExtractOptions = {
  body: NodeJS.ReadableStream;
  destDir: string;
  /**
   * Number of leading path components to strip from each archive entry.
   * npm tarballs ship as `package/...` (and codeload as `outputease-<sha>/...`),
   * so default is 1.
   */
  strip?: number;
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
  const { body, destDir, strip = 1 } = opts;
  await mkdir(destDir, { recursive: true });

  const scratch = await mkdtemp(join(tmpdir(), "oe-tar-"));
  const tgzPath = join(scratch, "archive.tgz");
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    await writeFile(tgzPath, Buffer.concat(chunks));

    const tarBin = process.platform === "win32" ? "C:\\Windows\\System32\\tar.exe" : "tar";
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
