import * as fs from "node:fs";
import * as path from "node:path";
import { generate, readManifestTargets } from "./generate";

/**
 * Drift check (spec 008, contracts/cli-agents.md). Regenerates in memory
 * (dry-run) and byte-compares against the working tree for every managed path,
 * plus detects unmanaged committed files in generated-only directories. No
 * writes, offline. This is the deep tripwire (CI); the pre-commit hook runs a
 * separate fast manifest hash check.
 */

export interface DriftLine {
  kind: "missing" | "extra" | "content";
  path: string;
  source?: string;
}

export interface CheckResult {
  exitCode: 0 | 1 | 2;
  drift: DriftLine[];
  errors: string[];
}

/** Local, ephemeral, or vendored files that are legitimately unmanaged. */
const EPHEMERAL = /(\.local\.|\.last-edits\.json|scheduled_tasks\.lock|node_modules|\/worktrees\/)/;

function walkPosix(root: string, rel: string): string[] {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const childRel = `${rel}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walkPosix(root, childRel));
    else out.push(childRel);
  }
  return out;
}

export function check(opts: { agentsDir: string; repoRoot: string }): CheckResult {
  const { agentsDir, repoRoot } = opts;

  if (!fs.existsSync(path.join(agentsDir, "generated.manifest.json"))) {
    return {
      exitCode: 2,
      drift: [],
      errors: [
        `no manifest at ${agentsDir} — run "outputease agents migrate" / "agents generate" first`,
      ],
    };
  }

  // Regenerate exactly the set this project produced (manifest targets), not the
  // phase default — a subset-scaffolded project must not report drift for targets
  // it never selected.
  const targets = readManifestTargets(agentsDir) ?? undefined;
  const gen = generate({ agentsDir, repoRoot, targets, dryRun: true });
  if (gen.exitCode === 2) return { exitCode: 2, drift: [], errors: gen.errors };
  if (gen.exitCode !== 0) return { exitCode: 1, drift: [], errors: gen.errors };

  const managed = new Map<string, string>();
  const all = [
    ...gen.emitted.map((f) => ({ path: f.path, content: f.content, source: f.source })),
    ...gen.meta.map((m) => ({ path: m.path, content: m.content, source: "<generated>" })),
  ];

  const drift: DriftLine[] = [];
  for (const file of all) {
    managed.set(file.path, file.source);
    const abs = path.join(repoRoot, ...file.path.split("/"));
    if (!fs.existsSync(abs)) {
      drift.push({ kind: "missing", path: file.path, source: file.source });
    } else if (fs.readFileSync(abs, "utf-8") !== file.content) {
      drift.push({ kind: "content", path: file.path, source: file.source });
    }
  }

  // Unmanaged files committed into generated-only directories (e.g. .gemini, .codex, .claude).
  const generatedDirs = new Set<string>();
  for (const managedPath of managed.keys()) {
    const seg = managedPath.split("/")[0];
    if (seg && seg.startsWith(".") && seg !== ".agents" && seg.includes("/") === false) {
      if (managedPath.includes("/")) generatedDirs.add(seg);
    }
  }
  for (const dir of generatedDirs) {
    for (const rel of walkPosix(repoRoot, dir)) {
      if (!managed.has(rel) && !EPHEMERAL.test(`/${rel}`)) {
        drift.push({ kind: "extra", path: rel });
      }
    }
  }

  drift.sort((a, b) => a.path.localeCompare(b.path));
  return { exitCode: drift.length > 0 ? 1 : 0, drift, errors: [] };
}

/** Render a drift line: `! content <path> ← <source>`. */
export function formatDrift(line: DriftLine): string {
  const symbol = line.kind === "missing" ? "+" : line.kind === "extra" ? "-" : "!";
  const label = line.kind.padEnd(7);
  const pointer = line.source ? ` ← ${line.source}` : "";
  return `${symbol} ${label} ${line.path}${pointer}`;
}
