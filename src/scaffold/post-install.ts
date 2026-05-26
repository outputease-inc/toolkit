import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir, platform, tmpdir } from "node:os";
import { join } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { PostInstallResult } from "../schema/scaffold";

const PORTABLE_GIT_DIRNAME = ".outputease-portable-git";

/**
 * Build an env object with the current PATH, normalized to a single `PATH` key.
 *
 * Windows env vars are case-insensitive at the OS level, but Node exposes
 * `process.env` with whatever case Windows happened to use (`Path` is the
 * canonical Windows form). If we shallow-clone process.env and then set
 * `env.PATH = ...`, we end up with BOTH `Path` (old value) and `PATH` (new
 * value) on the cloned object. When `child_process` passes that env to the
 * subprocess, the OS-original `Path` wins on Windows — so the prepended
 * directories are silently ignored.
 *
 * Strip all case variants of PATH from the clone before any caller assigns
 * a new PATH value.
 */
function cloneEnvWithoutPath(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  const existingPath = process.env.PATH ?? process.env.Path ?? process.env.path ?? "";
  for (const key of Object.keys(env)) {
    if (key.toUpperCase() === "PATH") {
      delete env[key];
    }
  }
  env.PATH = existingPath;
  return env;
}

export interface PostInstallOptions {
  targetDir: string;
  projectName: string;
  uv: boolean;
  specKit: boolean;
  dryRun: boolean;
}

/**
 * Detect the shell script type for `specify init --script`.
 * Windows → "ps" (PowerShell), Unix → "sh"
 */
export function detectScriptType(): "sh" | "ps" {
  return platform() === "win32" ? "ps" : "sh";
}

/**
 * Check if uv is available on PATH.
 */
export function isUvAvailable(): boolean {
  try {
    const result = spawnSync("uv", ["--version"], {
      stdio: "pipe",
      timeout: 10_000,
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
    "C:\\Program Files\\Git\\cmd",
    "C:\\Program Files (x86)\\Git\\cmd",
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
function isGitAvailable(): boolean {
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
  const env = cloneEnvWithoutPath();
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
function installGitViaWinget(): boolean {
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
async function installPortableGitOnWindows(): Promise<boolean> {
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
    const extract = spawnSync("C:\\Windows\\System32\\tar.exe", ["-xf", tmpZip, "-C", dest], {
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
  const env = cloneEnvWithoutPath();
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
  const env = cloneEnvWithoutPath();

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
 * Pinned uv release. The astral.sh installer script itself is fetched live
 * (trust boundary: astral-sh CDN), but the binary it installs is pinned to
 * this version via the UV_INSTALL_VERSION env var. Bump this string when a
 * new uv release is vetted; do not let installs float.
 */
const PINNED_UV_VERSION = "0.5.30";

/**
 * Install uv using the official installer with a pinned version.
 * Windows: PowerShell irm https://astral.sh/uv/install.ps1 | iex
 * Unix: curl -LsSf https://astral.sh/uv/install.sh | sh
 */
function installUv(): boolean {
  const isWin = platform() === "win32";
  const env = { ...process.env, UV_INSTALL_VERSION: PINNED_UV_VERSION };

  if (isWin) {
    const result = spawnSync(
      "powershell",
      ["-NoProfile", "-Command", "irm https://astral.sh/uv/install.ps1 | iex"],
      { stdio: "pipe", timeout: 60_000, env },
    );
    return result.status === 0;
  }

  const result = spawnSync("sh", ["-c", "curl -LsSf https://astral.sh/uv/install.sh | sh"], {
    stdio: "pipe",
    timeout: 60_000,
    env,
  });
  return result.status === 0;
}

/**
 * Install spec-kit via uv tool install.
 */
function installSpecKit(): { ok: boolean; stderr: string } {
  const result = spawnSync(
    "uv",
    ["tool", "install", "specify-cli", "--from", "git+https://github.com/github/spec-kit.git"],
    { stdio: "pipe", timeout: 120_000, env: envWithUvBin() },
  );

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

  // uv returns non-zero if already installed
  if (stderr.includes("already installed")) return { ok: true, stderr: combined };

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
function runSpecifyInit(targetDir: string): { ok: boolean; stderr: string } {
  const scriptType = detectScriptType();
  // `--ignore-agent-tools` skips spec-kit's preflight check for the `claude`
  // binary on PATH. The toolkit already scaffolds the Claude Code surface
  // (.claude/skills, .claude/commands, etc.) — spec-kit only needs to write
  // its templates and memory. Whether the user has Claude Code installed
  // locally is orthogonal to whether spec-kit can run.
  const result = spawnSync(
    "specify",
    [
      "init",
      "--integration",
      "claude",
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

/**
 * Run post-scaffold installation steps:
 * 1. Check/install uv
 * 2. Install spec-kit via uv
 * 3. Run specify init
 */
export async function runPostInstall(options: PostInstallOptions): Promise<PostInstallResult> {
  const result: PostInstallResult = {
    uvInstalled: false,
    specKitInstalled: false,
    specifyInitRan: false,
    errors: [],
  };

  if (options.dryRun) {
    p.log.info(pc.dim("  Would install uv + spec-kit and run specify init"));
    return result;
  }

  if (!options.uv && !options.specKit) return result;

  // Step 1: Ensure uv is available
  if (options.uv) {
    const spinner = p.spinner();
    spinner.start("Checking for uv...");

    if (isUvAvailable()) {
      spinner.stop("uv found");
      result.uvInstalled = true;
    } else {
      spinner.message("Installing uv...");
      try {
        if (installUv()) {
          spinner.stop("uv installed");
          result.uvInstalled = true;
        } else {
          spinner.stop(pc.yellow("uv installation failed — skipping spec-kit"));
          result.errors.push("uv installation failed");
          return result;
        }
      } catch (err) {
        spinner.stop(pc.yellow("uv installation failed — skipping spec-kit"));
        result.errors.push(`uv install error: ${err instanceof Error ? err.message : String(err)}`);
        return result;
      }
    }
  }

  // Step 2: Install spec-kit via uv tool install
  if (options.specKit && result.uvInstalled) {
    // spec-kit ships from a git+ URL; uv requires git on PATH to clone it.
    // Fresh Windows has no git — attempt winget-based install and surface a
    // clear remediation message if it fails.
    if (!isGitAvailable()) {
      const gitSpinner = p.spinner();
      gitSpinner.start("Installing Git (required for spec-kit)...");
      try {
        // Strategy: try winget first (handles dev machines), fall back to
        // PortableGit download (handles Windows Sandbox and minimal images).
        let gitOk = installGitViaWinget();
        if (!gitOk) {
          gitSpinner.message("winget unavailable — downloading PortableGit...");
          gitOk = await installPortableGitOnWindows();
        }
        if (gitOk) {
          gitSpinner.stop("Git installed");
        } else {
          gitSpinner.stop(pc.yellow("Git installation failed — skipping spec-kit"));
          result.errors.push(
            "Git is required to install spec-kit. Install Git manually " +
              "(https://git-scm.com/download/win or `winget install Git.Git`), " +
              "then re-run `outputease update` to finish spec-kit setup.",
          );
          return result;
        }
      } catch (err) {
        gitSpinner.stop(pc.yellow("Git installation failed — skipping spec-kit"));
        result.errors.push(
          `Git install error: ${err instanceof Error ? err.message : String(err)}`,
        );
        return result;
      }
    }

    const spinner = p.spinner();
    spinner.start("Installing spec-kit...");

    try {
      const installResult = installSpecKit();
      if (installResult.ok) {
        spinner.stop("spec-kit installed");
        result.specKitInstalled = true;
      } else {
        spinner.stop(pc.yellow("spec-kit installation failed"));
        result.errors.push(`spec-kit install failed: ${installResult.stderr}`);
      }
    } catch (err) {
      spinner.stop(pc.yellow("spec-kit installation failed"));
      result.errors.push(
        `spec-kit install error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Step 3: Run specify init in the project directory
  if (options.specKit && result.specKitInstalled) {
    const spinner = p.spinner();
    spinner.start("Initializing spec-kit...");

    try {
      const initResult = runSpecifyInit(options.targetDir);
      if (initResult.ok) {
        spinner.stop("spec-kit initialized");
        result.specifyInitRan = true;
      } else {
        spinner.stop(pc.yellow("spec-kit init failed — .specify/ may need manual setup"));
        result.errors.push(`specify init failed: ${initResult.stderr}`);
      }
    } catch (err) {
      spinner.stop(pc.yellow("spec-kit init failed"));
      result.errors.push(`specify init error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
