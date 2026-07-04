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
