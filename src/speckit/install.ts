import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir, platform, tmpdir } from "node:os";
import { join } from "node:path";
import { maybeRegenerate } from "../agents/regenerate";
import { clonedEnvSinglePath, programFilesDirs, systemTarBin } from "../platform";
import type { SpecKitResult } from "../schema/scaffold";
import { bridgeSpecKitSkillsToCodex } from "./codex-bridge";
import { applyOverlayToDir, verifyOverlay } from "./overlay";
import { SPECKIT_REF, specKitInstallArgs, specKitInstallSpec } from "./pin";

const PORTABLE_GIT_DIRNAME = ".outputease-portable-git";

/**
 * Env for spawning the `powershell` binary (Windows PowerShell 5.1).
 *
 * A PowerShell 7 parent — GitHub Actions `pwsh` steps, modern terminals —
 * exports a PSModulePath pointing at PS7 module directories. A spawned 5.1
 * inherits it and can no longer autoload its own core modules: the uv
 * installer's `Get-ExecutionPolicy` call dies with "the module could not be
 * loaded" (Microsoft.PowerShell.Security resolves to the PS7 copy first).
 * Strip the variable so 5.1 rebuilds its default module path. PYTHONUTF8
 * keeps any Python/rich output in the installer from crashing on cp1252.
 */
export function windowsPowerShellEnv(): NodeJS.ProcessEnv {
  const env = clonedEnvSinglePath();
  env.PYTHONUTF8 = "1";
  for (const key of Object.keys(env)) {
    if (key.toUpperCase() === "PSMODULEPATH") {
      delete env[key];
    }
  }
  return env;
}
/**
 * Detect the shell script type for `specify init --script`.
 * Windows → "ps" (PowerShell), Unix → "sh"
 */
export function detectScriptType(): "sh" | "ps" {
  return platform() === "win32" ? "ps" : "sh";
}

/**
 * Check if uv is available — searches PATH plus the known install dirs
 * (`~/.local/bin`, `~/.cargo/bin`) so detection works in the same Node
 * process that just ran `installUv()`, before any new shell has picked
 * up the persistent PATH update.
 */
export function isUvAvailable(): boolean {
  try {
    const result = spawnSync("uv", ["--version"], {
      stdio: "pipe",
      timeout: 10_000,
      env: envWithKnownUvDirs(),
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Check if the specify CLI is available on PATH.
 */
export function isSpecifyAvailable(): boolean {
  try {
    const result = spawnSync("specify", ["--help"], {
      stdio: "pipe",
      timeout: 10_000,
      env: envWithUvBin(),
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Known directories where the official uv installer places uv.exe / uv.
 * Used as fallbacks when uv isn't on PATH yet (i.e., right after install
 * before any new shell has picked up the persistent PATH update).
 */
function knownUvInstallDirs(): string[] {
  const home = homedir();
  return [join(home, ".local", "bin"), join(home, ".cargo", "bin")];
}

/**
 * Known directories where Git for Windows places git.exe.
 * spec-kit install pulls from `git+https://...` which requires a git binary;
 * fresh Windows machines have none, so the toolkit may auto-install Git via
 * winget and then needs git.exe on PATH in the current process.
 */
function knownGitInstallDirs(): string[] {
  if (platform() !== "win32") return [];
  const home = homedir();
  return [
    ...programFilesDirs().map((dir) => join(dir, "Git", "cmd")),
    join(home, "AppData", "Local", "Programs", "Git", "cmd"),
    // PortableGit fallback dropped by installPortableGitOnWindows()
    join(home, PORTABLE_GIT_DIRNAME, "cmd"),
  ];
}

/**
 * Check whether winget itself is available. Windows Sandbox and some minimal
 * Windows images ship without it.
 */
function isWingetAvailable(): boolean {
  if (platform() !== "win32") return false;
  try {
    const r = spawnSync("winget", ["--version"], { stdio: "pipe", timeout: 10_000 });
    return r.status === 0;
  } catch {
    return false;
  }
}

/**
 * Check whether a git executable is available on PATH.
 */
export function isGitAvailable(): boolean {
  try {
    const result = spawnSync("git", ["--version"], {
      stdio: "pipe",
      timeout: 10_000,
      env: envWithKnownGitDirs(),
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Build a PATH-augmented env containing known Git install dirs.
 * Used to detect Git after a fresh winget install (the user-PATH update
 * the installer makes only takes effect in new shells).
 */
function envWithKnownGitDirs(): NodeJS.ProcessEnv {
  const env = clonedEnvSinglePath();
  const dirs = knownGitInstallDirs();
  if (dirs.length === 0) return env;
  const sep = platform() === "win32" ? ";" : ":";
  env.PATH = `${dirs.join(sep)}${sep}${env.PATH ?? ""}`;
  return env;
}

/**
 * Install Git for Windows via winget. No-op on non-Windows platforms.
 * Returns true if git is available after the attempt.
 */
export function installGitViaWinget(): boolean {
  if (platform() !== "win32") return false;
  if (!isWingetAvailable()) return false;
  spawnSync(
    "winget",
    [
      "install",
      "--id",
      "Git.Git",
      "--silent",
      "--accept-source-agreements",
      "--accept-package-agreements",
      "--source",
      "winget",
    ],
    { stdio: "pipe", timeout: 300_000 },
  );
  // winget exits non-zero on "already installed" too — re-detect rather than trust exit code.
  return isGitAvailable();
}

/**
 * Fallback Git installer for environments without winget (e.g. Windows Sandbox).
 * Downloads MinGit (PortableGit, lighter than full Git for Windows) from the
 * official git-for-windows GitHub release and extracts it via the OS-shipped
 * tar.exe (bsdtar handles .zip on Win10+).
 *
 * Layout of MinGit zip:
 *   <root>/cmd/git.exe       <- needs to be on PATH
 *   <root>/mingw64/...
 *
 * Persisted at `%USERPROFILE%\.outputease-portable-git\` so subsequent runs of
 * the toolkit detect it via `knownGitInstallDirs()` without re-downloading.
 */
export async function installPortableGitOnWindows(): Promise<boolean> {
  if (platform() !== "win32") return false;

  try {
    // 1. Resolve the latest MinGit-*-64-bit.zip asset from GitHub releases.
    const releaseRes = await fetch(
      "https://api.github.com/repos/git-for-windows/git/releases/latest",
      { headers: { "User-Agent": "outputease-toolkit", Accept: "application/vnd.github+json" } },
    );
    if (!releaseRes.ok) return false;
    const release = (await releaseRes.json()) as {
      assets: Array<{ name: string; browser_download_url: string }>;
    };
    const asset = release.assets.find(
      (a) => /^MinGit-.*-64-bit\.zip$/i.test(a.name) && !a.name.toLowerCase().includes("busybox"),
    );
    if (!asset) return false;

    // 2. Download zip to a temp file.
    const zipRes = await fetch(asset.browser_download_url);
    if (!zipRes.ok) return false;
    const buf = Buffer.from(await zipRes.arrayBuffer());
    const tmpZip = join(tmpdir(), `oe-mingit-${Date.now()}.zip`);
    await writeFile(tmpZip, buf);

    // 3. Extract via bsdtar (Windows 10/11 ships tar.exe at System32).
    const dest = join(homedir(), PORTABLE_GIT_DIRNAME);
    await mkdir(dest, { recursive: true });
    const extract = spawnSync(systemTarBin(), ["-xf", tmpZip, "-C", dest], {
      stdio: "pipe",
      timeout: 180_000,
    });
    await rm(tmpZip, { force: true });
    if (extract.status !== 0) return false;

    // 4. Verify git.exe is reachable via the augmented PATH.
    return isGitAvailable();
  } catch {
    return false;
  }
}

/**
 * Build a PATH-augmented env containing known uv install dirs but WITHOUT
 * invoking uv (avoids recursion with envWithUvBin / getUvToolBinDir).
 */
function envWithKnownUvDirs(): NodeJS.ProcessEnv {
  const env = clonedEnvSinglePath();
  if (platform() === "win32") env.PYTHONUTF8 = "1";
  const sep = platform() === "win32" ? ";" : ":";
  const dirs = knownUvInstallDirs();
  env.PATH = `${dirs.join(sep)}${sep}${env.PATH ?? ""}`;
  return env;
}

/**
 * Get the directory where uv installs tool binaries.
 * Returns null if uv is not available or the command fails.
 */
function getUvToolBinDir(): string | null {
  try {
    const result = spawnSync("uv", ["tool", "dir", "--bin"], {
      stdio: "pipe",
      timeout: 10_000,
      // PATH may not include uv yet (fresh install, current shell stale).
      env: envWithKnownUvDirs(),
    });
    if (result.status === 0) {
      return result.stdout.toString().trim();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Build a copy of process.env with uv's tool bin dir prepended to PATH.
 * After `uv tool install`, binaries live in uv's tool bin dir which may not
 * be on the current process's PATH (shell profile changes only take effect
 * in new sessions).
 */
function envWithUvBin(): NodeJS.ProcessEnv {
  const env = clonedEnvSinglePath();

  // Force UTF-8 on Windows so Python's `rich` library doesn't crash
  // trying to encode Unicode banner characters through cp1252.
  if (platform() === "win32") {
    env.PYTHONUTF8 = "1";
  }

  const sep = platform() === "win32" ? ";" : ":";

  // Prepend uv's well-known install dirs AND Git's well-known install dirs.
  // Required after a fresh `installUv()` / `installGitViaWinget()` in the
  // same process: installers modify persistent user PATH but the current
  // Node process has a stale env.PATH.
  // spec-kit is installed via `uv tool install --from git+...` so git.exe
  // must be discoverable too.
  const knownDirs = [...knownUvInstallDirs(), ...knownGitInstallDirs()];
  env.PATH = `${knownDirs.join(sep)}${sep}${env.PATH ?? ""}`;

  // Then prepend uv's tool bin dir (where `uv tool install` places shims).
  const uvBinDir = getUvToolBinDir();
  if (uvBinDir) {
    env.PATH = `${uvBinDir}${sep}${env.PATH}`;
  }

  return env;
}

/**
 * Install uv using the official installer.
 * Windows: PowerShell `irm https://astral.sh/uv/install.ps1 | iex`
 * Unix: `curl -LsSf https://astral.sh/uv/install.sh | sh`
 *
 * Returns the full subprocess diagnostic (exit code, stdout, stderr) so the
 * caller can surface actionable detail when the install fails. Exit 0 alone
 * is not treated as success — the installer can claim success while leaving
 * uv unreachable from the current process; we verify via `isUvAvailable()`
 * (which augments PATH with the known install dirs).
 */
export function installUv(): { ok: boolean; stderr: string } {
  const isWin = platform() === "win32";

  const result = isWin
    ? spawnSync(
        "powershell",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          "irm https://astral.sh/uv/install.ps1 | iex",
        ],
        { stdio: "pipe", timeout: 60_000, env: windowsPowerShellEnv() },
      )
    : spawnSync("sh", ["-c", "curl -LsSf https://astral.sh/uv/install.sh | sh"], {
        stdio: "pipe",
        timeout: 60_000,
        env: clonedEnvSinglePath(),
      });

  const stdout = result.stdout?.toString() ?? "";
  const stderr = result.stderr?.toString() ?? "";
  const combined = [
    `exit=${result.status} signal=${result.signal ?? "null"}`,
    stdout && `stdout:\n${stdout}`,
    stderr && `stderr:\n${stderr}`,
  ]
    .filter(Boolean)
    .join("\n");

  if (result.status !== 0) return { ok: false, stderr: combined };

  if (!isUvAvailable()) {
    return {
      ok: false,
      stderr: `${combined}\n\nInstaller exited 0 but \`uv --version\` is not callable from known dirs (~/.local/bin, ~/.cargo/bin). The persistent PATH update typically only takes effect in a new shell.`,
    };
  }

  return { ok: true, stderr: combined };
}

/**
 * Install spec-kit via uv tool install.
 */
export function installSpecKit(): { ok: boolean; stderr: string } {
  const result = spawnSync("uv", specKitInstallArgs(), {
    stdio: "pipe",
    timeout: 120_000,
    env: envWithUvBin(),
  });

  const stdout = result.stdout?.toString() ?? "";
  const stderr = result.stderr?.toString() ?? "";
  const combined = [
    `exit=${result.status} signal=${result.signal ?? "null"}`,
    stdout && `stdout:\n${stdout}`,
    stderr && `stderr:\n${stderr}`,
  ]
    .filter(Boolean)
    .join("\n");
  if (result.status === 0) return { ok: true, stderr: combined };

  // No "already installed" swallow: `--force` means an existing tool is a reinstall,
  // not a conflict, so a non-zero exit here is a real failure. Swallowing it was what
  // let a developer's pre-existing unpinned specify-cli survive and leave the overlay
  // anchors facing an unknown upstream (spec 2026-07-24 5.4).

  return { ok: false, stderr: combined };
}

/**
 * Run `specify init` in the project directory.
 * Uses `--here` to init in `targetDir` (the already-scaffolded project).
 * Project name and `--here` are mutually exclusive in spec-kit CLI,
 * so we omit the name — spec-kit infers it from the directory name.
 *
 * `--integration claude` is the current spec-kit flag (replaced `--ai claude`
 * as of v0.7.1). Installs commands as skills under `.claude/skills/speckit-*`
 * by default.
 */
export function runSpecifyInit(
  targetDir: string,
  integration: string,
): { ok: boolean; stderr: string } {
  const scriptType = detectScriptType();
  // `--ignore-agent-tools` skips spec-kit's preflight check for the agent
  // binary on PATH. The toolkit already scaffolds each selected agent's surface
  // — spec-kit only needs to write its templates and memory. Whether the user
  // has the agent installed locally is orthogonal to whether spec-kit can run.
  const result = spawnSync(
    "specify",
    [
      "init",
      "--integration",
      integration,
      "--script",
      scriptType,
      "--here",
      "--force",
      "--ignore-agent-tools",
    ],
    { cwd: targetDir, stdio: "pipe", timeout: 60_000, env: envWithUvBin() },
  );
  // specify-cli (Python/typer) often prints diagnostics to stdout, not stderr —
  // capture both so failures are actionable.
  const stdout = result.stdout?.toString() ?? "";
  const stderr = result.stderr?.toString() ?? "";
  const combined = [
    `exit=${result.status} signal=${result.signal ?? "null"}`,
    stdout && `stdout:\n${stdout}`,
    stderr && `stderr:\n${stderr}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { ok: result.status === 0, stderr: combined };
}

export interface EnsureSpecKitOptions {
  /** Project root — where `.specify/`, `.claude/`, `.agents/` live. */
  targetDir: string;
  /** spec-kit `--integration` value. Plain string, NOT AgentTargetId (deviation from spec
   *  §5.7, flagged at the top of this group): `PostInstallOptions.specKitIntegration` and
   *  `resolveSpecKitIntegration` both produce strings, and spec-kit owns the vocabulary. */
  integration: string;
  mode: "init" | "refresh" | "verify";
  dryRun?: boolean;
}

/**
 * The single spec-kit lifecycle entry point: ensure uv -> ensure git -> install
 * specify-cli at SPECKIT_REF -> `specify init --force` -> apply the archive-aware
 * numbering overlay -> re-bridge codex -> regenerate agent configs.
 *
 * Self-contained on purpose. `outputease speckit init` can be the FIRST toolkit command
 * a machine ever runs, so the bootstrap cannot be assumed to have happened in
 * `runPostInstall`. NOTE this self-bootstrap is what makes the STANDALONE CLI path work;
 * it is NOT a reason to relax `runPostInstall`'s own `options.uv` gate — see Task 13.
 *
 * `verify` probes and writes nothing. Degrade-don't-abort throughout: failures land on
 * `errors` for `renderSummary` / the CLI to print, matching the existing post-install
 * posture — `init` still succeeds and still writes the marker.
 */
export async function ensureSpecKit(opts: EnsureSpecKitOptions): Promise<SpecKitResult> {
  const result: SpecKitResult = {
    mode: opts.mode,
    upstreamRef: SPECKIT_REF,
    uvReady: false,
    installed: false,
    initialized: false,
    overlay: [],
    bridgedSkills: [],
    regenerated: null,
    errors: [],
  };

  if (opts.dryRun) return result;

  if (opts.mode === "verify") {
    result.uvReady = isUvAvailable();
    result.installed = isSpecifyAvailable();
    result.initialized = existsSync(join(opts.targetDir, ".specify"));
    result.overlay = result.initialized
      ? verifyOverlay(opts.targetDir).results.map((r) => ({ file: r.file, outcome: r.status }))
      : [];
    collectOverlayErrors(result);
    return result;
  }

  if (!isUvAvailable()) {
    const uv = installUv();
    if (!uv.ok) {
      result.errors.push(`uv install failed: ${uv.stderr}`);
      return result;
    }
  }
  result.uvReady = true;

  // spec-kit ships from a git+ URL; uv needs a git binary to clone it.
  if (!isGitAvailable()) {
    let gitOk = installGitViaWinget();
    if (!gitOk) gitOk = await installPortableGitOnWindows();
    if (!gitOk) {
      result.errors.push(
        "Git is required to install spec-kit. Install Git manually " +
          "(https://git-scm.com/download/win or `winget install Git.Git`), " +
          "then re-run `outputease speckit init` to finish spec-kit setup.",
      );
      return result;
    }
  }

  const install = installSpecKit();
  if (!install.ok) {
    result.errors.push(`spec-kit install failed (${specKitInstallSpec()}): ${install.stderr}`);
    return result;
  }
  result.installed = true;

  const init = runSpecifyInit(opts.targetDir, opts.integration);
  if (!init.ok) {
    result.errors.push(`specify init failed: ${init.stderr}`);
    return result;
  }
  result.initialized = true;

  result.overlay = applyOverlayToDir(opts.targetDir).results.map((r) => ({
    file: r.file,
    outcome: r.status,
  }));
  collectOverlayErrors(result);

  // Codex re-bridge. Gated on claude being the primary integration: when codex IS the
  // primary, upstream's own `--integration codex` output is authoritative. A claude-only
  // scaffold has no `.agents/targets/codex`, so this no-ops.
  const codexSource = join(opts.targetDir, ".agents", "targets", "codex");
  if (opts.integration === "claude" && existsSync(codexSource)) {
    const bridge = bridgeSpecKitSkillsToCodex(opts.targetDir);
    result.bridgedSkills = bridge.bridged;
    result.errors.push(...bridge.errors);
    const regen = maybeRegenerate(opts.targetDir, { multiAgent: true, dryRun: false });
    if (regen.reason && regen.reason !== "no-manifest") {
      result.errors.push(`Agent config regeneration failed: ${regen.reason}`);
    }
    result.regenerated = regen.regenerated;
  }

  return result;
}

/**
 * Turn the two fail-loud overlay outcomes into operator-readable errors. `skipped`
 * (required:false + file absent) is informational and stays silent.
 */
function collectOverlayErrors(result: SpecKitResult): void {
  for (const report of result.overlay) {
    if (report.outcome === "anchorMissing") {
      result.errors.push(
        `archive-aware numbering NOT applied: anchor not found in ${report.file} ` +
          `(expected spec-kit ${SPECKIT_REF}). Feature numbering will reuse archived ` +
          "numbers once archive/specs/ exists. Re-run: outputease speckit verify",
      );
    } else if (report.outcome === "verifyFailed") {
      result.errors.push(
        `archive-aware numbering applied but did not verify in ${report.file} ` +
          `(expected spec-kit ${SPECKIT_REF}). Re-run: outputease speckit verify`,
      );
    }
  }
}
