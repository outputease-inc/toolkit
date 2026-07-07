import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Scans toolkit template files for references to commands and skills that don't
 * exist in the templates. Identifies "phantom references" that would cause failures.
 */

/** Known external references expected to not exist in the kit */
const KNOWN_EXTERNALS = new Set([
  // Spec-Kit skills (external dependency, installed by `specify init --integration claude`)
  "/speckit-constitution",
  "/speckit-specify",
  "/speckit-clarify",
  "/speckit-plan",
  "/speckit-tasks",
  "/speckit-analyze",
  "/speckit-checklist",
  "/speckit-implement",
  "/speckit-taskstoissues",
  "/speckit-converge",
  // Claude Code skills-mode invocation prefix. Spec-Kit v0.12.3 skill bodies cite
  // `/skill:speckit-...` as the skills-mode way to run a hook; the `:` terminates
  // the token so the scanner sees a bare `/skill`. Host-provided, never a kit command.
  "/skill",
  // Plugin-provided skills and commands (user-scoped plugins)
  "/frontend-design",
  "/hookify",
  "/brainstorm",
  "/write-plan",
  "/execute-plan",
  "/commit-commands",
  "/commit",
  "/commit-push-pr",
  "/claude-md-management",
  "/code-review",
  "/pr-review-toolkit",
  "/plugin",
  "/plugin-dev",
  // Claude Code built-in commands (provided by the host CLI, not the kit)
  "/doctor",
  "/simplify",
]);

/** File extension pattern for scannable files */
const SCANNABLE_EXT = /\.(md|js)$/;

/** Directories to skip (third-party / VCS, not template files) */
const SKIP_DIRS = new Set(["node_modules", ".git", "lib"]);

interface FileInfo {
  relative: string;
  absolute: string;
}

interface PhantomLocation {
  file: string;
  line: number;
  text: string;
}

export interface PhantomResult {
  commands: Set<string>;
  skills: Set<string>;
  phantoms: Record<string, PhantomLocation[]>;
  externalRefs: Record<string, Set<string>>;
  hasPhantoms: boolean;
}

function getFiles(dir: string, prefix = ""): FileInfo[] {
  const files: FileInfo[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...getFiles(path.join(dir, entry.name), relativePath));
    } else if (SCANNABLE_EXT.test(entry.name)) {
      files.push({
        relative: relativePath,
        absolute: path.join(dir, entry.name),
      });
    }
  }
  return files;
}

function getKitCommands(kitPath: string): Set<string> {
  const commandsDir = path.join(kitPath, ".claude", "commands");
  const commands = new Set<string>();
  if (fs.existsSync(commandsDir)) {
    for (const file of fs.readdirSync(commandsDir)) {
      if (file.endsWith(".md") && file !== "README.md") {
        commands.add(`/${file.replace(".md", "")}`);
      }
    }
  }
  return commands;
}

function getKitSkills(kitPath: string): Set<string> {
  const skillsDir = path.join(kitPath, ".claude", "skills");
  const skills = new Set<string>();
  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir, {
      withFileTypes: true,
    })) {
      if (entry.isDirectory()) {
        const skillFile = path.join(skillsDir, entry.name, "SKILL.md");
        if (fs.existsSync(skillFile)) {
          skills.add(`/${entry.name}`);
        }
      }
    }
  }
  return skills;
}

/** Scan a line for /command-name patterns */
function findRefs(line: string): string[] {
  const results: string[] = [];
  let searchFrom = 0;
  while (searchFrom < line.length) {
    const remaining = line.slice(searchFrom);
    const m = remaining.match(/(?:^|[\s`"'(])(\/[\w][\w.-]*)/);
    if (!m || !m[1]) break;
    const refEnd = (m.index ?? 0) + m[0].length;
    // The char immediately after the captured ref disambiguates it from a
    // command invocation: `/` means it's a path segment (`/specs/...`,
    // `/contracts/*`) and `*` means it's a glob stem (`/speckit-*`). Neither is
    // a slash command, so don't record it as a reference.
    const nextChar = remaining[refEnd];
    if (nextChar !== "/" && nextChar !== "*") {
      results.push(m[1]);
    }
    searchFrom += refEnd;
  }
  return results;
}

/** Check if a ref should be skipped (common non-command patterns) */
function shouldSkipRef(ref: string): boolean {
  if (ref.indexOf("//") === 0) return true;
  if (/^\/\d/.test(ref)) return true;
  if (/^\/[a-z]+\.[a-z]+\//.test(ref)) return true;
  if (ref === "/") return true;
  if (/^\/(ts|tsx|js|jsx|py|rs|go|rb|md|json|yaml|yml|css|html)$/.test(ref)) {
    return true;
  }
  // Single-letter refs (regex flags like /g, /i, /m)
  if (/^\/[a-z]$/.test(ref)) return true;
  // URL paths. Anchored to the path SEGMENT so a multi-word command that merely
  // shares a prefix (e.g. /api-helper, /dbreset, /dependencies-check) is still
  // scanned as a potential phantom instead of being silently excused.
  if (/^\/(api|health|db|dependencies)(\/|$)/.test(ref)) return true;
  // Short generic words likely URL paths or code examples. `/client` is a
  // package sub-path export token (the barrel-bypass hook prose cites "a
  // package's exported `/client` entry"), not a command.
  if (
    /^\/(route|path|endpoint|url|page|home|login|signup|auth|callback|redirect|client)$/.test(ref)
  ) {
    return true;
  }
  // Inline code examples and placeholder patterns. `/slash` is the INDEX.md
  // legend's notation token for "a command", not a real command name.
  if (/^\/command-name$/.test(ref)) return true;
  if (/^\/untyped$/.test(ref)) return true;
  if (/^\/(your-command|deploy-staging|enabled|slash)$/.test(ref)) {
    return true;
  }
  // Agent invocations (tool calls, not commands)
  if (/^\/agent$/.test(ref)) return true;
  // Wildcard and truncated patterns
  if (/\.\*/.test(ref)) return true;
  if (/\.$/.test(ref)) return true;

  return false;
}

/**
 * Detect phantom references in the toolkit templates directory.
 *
 * @param kitPath - Absolute path to the toolkit templates directory
 * @returns PhantomResult with phantom refs and external refs
 */
export function detectPhantoms(kitPath: string): PhantomResult {
  const files = getFiles(kitPath);
  const commands = getKitCommands(kitPath);
  const skills = getKitSkills(kitPath);
  const allValid = new Set([...commands, ...skills, ...KNOWN_EXTERNALS]);

  const phantoms: Record<string, PhantomLocation[]> = {};
  const externalRefs: Record<string, Set<string>> = {};

  for (const fileInfo of files) {
    const content = fs.readFileSync(fileInfo.absolute, "utf-8");
    const lines = content.split("\n");

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (!line) continue;

      for (const ref of findRefs(line)) {
        if (shouldSkipRef(ref)) continue;

        if (KNOWN_EXTERNALS.has(ref)) {
          if (!externalRefs[ref]) {
            externalRefs[ref] = new Set<string>();
          }
          externalRefs[ref].add(fileInfo.relative);
        } else if (!allValid.has(ref)) {
          if (!phantoms[ref]) phantoms[ref] = [];
          phantoms[ref].push({
            file: fileInfo.relative,
            line: li + 1,
            text: line.trim().substring(0, 80),
          });
        }
      }
    }
  }

  const hasPhantoms = Object.keys(phantoms).length > 0;

  return { commands, skills, phantoms, externalRefs, hasPhantoms };
}

/** Print a human-readable report to stdout. */
function printReport(result: PhantomResult): void {
  console.log("=== Phantom Reference Detection ===\n");
  console.log(`Kit commands: ${[...result.commands].sort().join(", ")}`);
  console.log(`Kit skills:   ${[...result.skills].sort().join(", ")}`);
  console.log();

  const phantomKeys = Object.keys(result.phantoms).sort();

  if (phantomKeys.length > 0) {
    console.log(`PHANTOM REFERENCES (${phantomKeys.length} unknown commands/skills):`);
    for (const pRef of phantomKeys) {
      const locations = result.phantoms[pRef];
      if (!locations) continue;
      console.log(`\n  ${pRef} (${locations.length} references):`);
      for (let pl = 0; pl < Math.min(locations.length, 5); pl++) {
        const loc = locations[pl];
        if (!loc) continue;
        console.log(`    ${loc.file}:${loc.line} | ${loc.text}`);
      }
      if (locations.length > 5) {
        console.log(`    (+${locations.length - 5} more)`);
      }
    }
    console.log();
  }

  const extKeys = Object.keys(result.externalRefs).sort();
  if (extKeys.length > 0) {
    console.log("EXTERNAL REFERENCES (known, expected):");
    for (const eRef of extKeys) {
      const refs = result.externalRefs[eRef];
      if (!refs) continue;
      console.log(`  ${eRef} -> ${[...refs].join(", ")}`);
    }
    console.log();
  }

  if (!result.hasPhantoms) {
    console.log("OK: No phantom references detected.");
  } else {
    console.log(
      "ACTION NEEDED: Create the missing commands/skills, " +
        "add them to KNOWN_EXTERNALS, or remove the references.",
    );
  }
}

// CLI mode
if (import.meta.main) {
  const kitPath = process.argv[2] ?? path.resolve(process.cwd(), "..", "toolkit");

  const result = detectPhantoms(kitPath);
  printReport(result);
  process.exit(result.hasPhantoms ? 1 : 0);
}
