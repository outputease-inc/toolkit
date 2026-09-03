import { spawnSync } from "node:child_process";
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
const EPHEMERAL =
  /(\.local\.|\.last-edits\.json|\.last-reads\.json|scheduled_tasks\.lock|node_modules|\/worktrees\/)/;

/**
 * Run git in `repoRoot` and split NUL-delimited stdout, or null if git can't
 * answer. Every call site passes `-z`: git C-quotes paths containing non-ASCII
 * or special bytes in its default line output, which would break the path
 * round-trip these comparisons depend on.
 */
function gitZ(repoRoot: string, args: string[], input?: string): string[] | null {
  try {
    const result = spawnSync("git", args, {
      cwd: repoRoot,
      input,
      encoding: "utf-8",
      timeout: 10_000,
    });
    // check-ignore exits 1 when nothing matched — a valid empty answer. Anything
    // else (128 = not a work tree, null + error = no git) means "can't tell".
    if (result.error || (result.status !== 0 && result.status !== 1)) return null;
    return (result.stdout ?? "").split("\0").filter(Boolean);
  } catch {
    return null;
  }
}

/** True when `repoRoot` is itself the root of a git work tree. */
function isOwnRepoRoot(repoRoot: string): boolean {
  try {
    const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: repoRoot,
      encoding: "utf-8",
      timeout: 10_000,
    });
    if (result.error || result.status !== 0) return false;
    return fs.realpathSync(result.stdout.trim()) === fs.realpathSync(repoRoot);
  } catch {
    return false;
  }
}

/**
 * Of `candidates`, the paths git ignores AND does not track.
 *
 * The extra-file tripwire exists to catch unmanaged files *committed* into a
 * generated directory. A git-ignored, untracked file can never be committed, so
 * it is out of scope by construction — this is what keeps CLI-agent runtime
 * state (opencode's `package.json`/`package-lock.json`, Claude Code's
 * `scheduled_tasks.lock`) from tripping CI without growing a hand-maintained
 * denylist for every new tool.
 *
 * Two guards keep the widening honest:
 * - Only this project's OWN repo is consulted. A scaffolded project sitting in
 *   an ignored subtree of an enclosing repo (`sandbox/`) would otherwise read as
 *   entirely ignored, silencing extra-detection wholesale.
 * - Tracked paths are never skipped. `git check-ignore` is already index-aware
 *   and won't report them, so `ls-files` is defense in depth for a `!` un-ignore
 *   whitelist or a `git add -f`.
 *
 * Returns an empty set whenever git cannot answer, so the EPHEMERAL fallback
 * still governs scaffolded projects with no git.
 */
function unCommittable(repoRoot: string, candidates: string[]): Set<string> {
  if (candidates.length === 0 || !isOwnRepoRoot(repoRoot)) return new Set();
  const ignored = gitZ(repoRoot, ["check-ignore", "-z", "--stdin"], `${candidates.join("\0")}\0`);
  if (ignored === null || ignored.length === 0) return new Set();
  const tracked = new Set(gitZ(repoRoot, ["ls-files", "-z", "--", ...ignored]) ?? []);
  return new Set(ignored.filter((rel) => !tracked.has(rel)));
}

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
  const candidates: string[] = [];
  for (const dir of generatedDirs) {
    for (const rel of walkPosix(repoRoot, dir)) {
      if (!managed.has(rel) && !EPHEMERAL.test(`/${rel}`)) candidates.push(rel);
    }
  }
  const skip = unCommittable(repoRoot, candidates);
  for (const rel of candidates) {
    if (!skip.has(rel)) drift.push({ kind: "extra", path: rel });
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
