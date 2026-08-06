import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Validates that the SOP Appendix A inventory matches the actual
 * toolkit template files. Reports files in the templates but not in the SOP,
 * and files in the SOP but not in the templates.
 */

/** OS-generated artifacts to ignore */
const OS_ARTIFACTS = new Set([".DS_Store", "Thumbs.db", "desktop.ini", "ehthumbs.db"]);

export interface InventoryResult {
  sopPaths: string[];
  kitFiles: string[];
  inKitNotSop: string[];
  inSopNotKit: string[];
  hasErrors: boolean;
}

/**
 * Parse the SOP Appendix A inventory table to extract file paths.
 *
 * Looks for a section titled "## Appendix A: Toolkit File Inventory"
 * and extracts paths from table rows matching `| N | \`path/to/file\` |`.
 */
function parseSopInventory(sopPath: string): string[] {
  const content = fs.readFileSync(sopPath, "utf-8");

  const tableStart = content.indexOf("## Appendix A: Toolkit File Inventory");
  if (tableStart === -1) {
    throw new Error("Could not find Appendix A in SOP document");
  }

  const nextSection = content.indexOf("\n## ", tableStart + 10);
  const section = content.slice(tableStart, nextSection === -1 ? undefined : nextSection);
  const pathRegex = /\|\s*\d+\s*\|\s*`([^`]+)`\s*\|/g;
  const paths: string[] = [];
  for (const m of section.matchAll(pathRegex)) {
    if (m[1]) paths.push(m[1]);
  }
  return paths;
}

/**
 * Recursively collect all files in the toolkit templates directory.
 * Skips OS artifacts and Apple double files.
 */
function getKitFiles(dir: string, prefix = ""): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      files.push(...getKitFiles(path.join(dir, entry.name), relativePath));
    } else {
      if (!OS_ARTIFACTS.has(entry.name) && !entry.name.startsWith("._")) {
        files.push(relativePath);
      }
    }
  }
  return files;
}

/**
 * Validate the SOP inventory against the actual kit contents.
 *
 * @param sopPath - Absolute path to the SOP markdown document
 * @param kitPath - Absolute path to the toolkit templates directory
 * @returns InventoryResult with mismatches
 */
export function validateInventory(sopPath: string, kitPath: string): InventoryResult {
  const sopPaths = parseSopInventory(sopPath);
  const kitFiles = getKitFiles(kitPath);

  const sopSet = new Set(sopPaths);
  const kitSet = new Set(kitFiles);

  const inKitNotSop = kitFiles.filter((f) => !sopSet.has(f));
  const inSopNotKit = sopPaths.filter((p) => !kitSet.has(p));

  const hasErrors = inKitNotSop.length > 0 || inSopNotKit.length > 0;

  return {
    sopPaths,
    kitFiles,
    inKitNotSop,
    inSopNotKit,
    hasErrors,
  };
}

/** Print a human-readable report to stdout. */
function printReport(result: InventoryResult): void {
  console.log("=== Toolkit Inventory Validation ===\n");
  console.log(`SOP Appendix A: ${result.sopPaths.length} files`);
  console.log(`Actual kit:     ${result.kitFiles.length} files\n`);

  if (result.inKitNotSop.length > 0) {
    console.log("FILES IN KIT BUT NOT IN SOP:");
    for (const f of result.inKitNotSop) {
      console.log(`  + ${f}`);
    }
    console.log();
  }

  if (result.inSopNotKit.length > 0) {
    console.log("FILES IN SOP BUT NOT IN KIT:");
    for (const p of result.inSopNotKit) {
      console.log(`  - ${p}`);
    }
    console.log();
  }

  if (!result.hasErrors) {
    console.log("OK: SOP inventory matches kit contents.");
  } else {
    console.log("MISMATCH: Update SOP Appendix A or add/remove kit files.");
  }
}

// CLI mode
if (import.meta.main) {
  const sopPath =
    process.argv[2] ?? path.resolve(process.cwd(), "..", "STANDARD-OPERATING-PROCEDURES.md");
  const kitPath = process.argv[3] ?? path.resolve(process.cwd(), "..", "toolkit");

  try {
    const result = validateInventory(sopPath, kitPath);
    printReport(result);
    process.exit(result.hasErrors ? 1 : 0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }
}
