import { join } from "node:path";

/**
 * Cross-platform system-path helpers. Windows installs are not guaranteed to
 * live on the C: drive (`%SystemRoot%` / `%ProgramFiles%` can point elsewhere on
 * enterprise/custom/cloud images), so these derive paths from the environment
 * with the conventional C: locations as a last-resort fallback.
 */

/** Absolute path to the OS-shipped tar binary (bsdtar on Win/macOS, GNU on Linux). */
export function systemTarBin(): string {
  if (process.platform === "win32") {
    return join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
  }
  return "tar";
}

/** Candidate "Program Files" roots on Windows, env-derived with C: fallbacks. */
export function programFilesDirs(): string[] {
  const dirs = [
    process.env.ProgramFiles ?? "C:\\Program Files",
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
  ];
  return [...new Set(dirs)];
}

/**
 * Clone an env object with the PATH variable normalized to a single `PATH`
 * key. Windows env vars are case-insensitive at the OS level, but Node exposes
 * `process.env` with whatever case Windows used (`Path` is the canonical
 * Windows form). Shallow-cloning then assigning `env.PATH` leaves BOTH `Path`
 * (old) and `PATH` (new) on the clone, and the OS-original `Path` wins in the
 * child — so prepended dirs are silently ignored. Strip all case variants,
 * then re-set a single `PATH`.
 */
export function clonedEnvSinglePath(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...source };
  const existingPath = source.PATH ?? source.Path ?? source.path ?? "";
  for (const key of Object.keys(env)) {
    if (key.toUpperCase() === "PATH") {
      delete env[key];
    }
  }
  env.PATH = existingPath;
  return env;
}
