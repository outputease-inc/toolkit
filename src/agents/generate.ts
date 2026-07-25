import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import pkg from "../../package.json" with { type: "json" };
import { validateCrossField } from "../audit/validate-agent-targets";
import { loadAgentTargets } from "../data/agent-targets-loader";
import type {
  AgentPhase,
  AgentTarget,
  AgentTargetId,
  EmitterFamily,
} from "../schema/agent-targets";
import { getEmitter } from "./emitters";
import { classifyFidelity, renderFidelityMd } from "./fidelity";
import { loadSource, type SourceModel } from "./source";
import type { GeneratedManifest, ManifestFile } from "./source-schemas";
import { type EmittedFile, type EmitterContext, EmitterNotImplementedError } from "./types";

/**
 * Generate orchestrator (spec 008, contracts/cli-agents.md).
 *
 * Offline, deterministic, idempotent: same inputs -> byte-identical outputs
 * (POSIX paths, LF endings). Validates the mapping table (schema + cross-field)
 * and the neutral source BEFORE writing anything — invalid input writes zero
 * files. Emissions are collected fully in memory then written, so a validation
 * or unimplemented-family error leaves the tree untouched.
 */

export type GenerateExitCode = 0 | 1 | 2 | 4;

export interface GenerateOptions {
  /** Path to the `.agents/` neutral source root. */
  agentsDir: string;
  /** Repo root where generated artifacts are written. */
  repoRoot: string;
  /** Explicit target ids (honored exactly, overriding the phase filter). */
  targets?: AgentTargetId[];
  /** Which delivery phases are enabled when `targets` is unset (default: dogfood). */
  phases?: AgentPhase[];
  /** Print the would-write list, write nothing. */
  dryRun?: boolean;
  /** Injectable mapping table (default: bundled dataset via loader). */
  targetsData?: AgentTarget[];
}

/** Generate-owned meta output (fidelity report + human-readable summary). */
export interface MetaFile {
  path: string;
  content: string;
}

export interface GenerateResult {
  exitCode: GenerateExitCode;
  emitted: EmittedFile[];
  /** Generate-owned meta files (fidelity report + FIDELITY.md). */
  meta: MetaFile[];
  manifest: GeneratedManifest | null;
  errors: string[];
}

const OUTPUT_FILES = new Set(["generated.manifest.json", "fidelity-report.json", "FIDELITY.md"]);

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf-8").digest("hex");
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/**
 * Every family an enabled target references, plus the implicit copy/passthrough
 * triggers. The copy/passthrough emitters are only invoked when they have
 * something to emit (skills present / passthrough tree non-empty), so a target
 * that consumes them contributes nothing when the source is empty.
 */
function familiesFor(target: AgentTarget, source: SourceModel): Set<EmitterFamily> {
  const families = new Set<EmitterFamily>();
  if (target.instructions.addendum) families.add(target.instructions.addendum.emitter);
  if (target.instructions.bridge) families.add(target.instructions.bridge.emitter);
  if (target.mcp.emit) families.add(target.mcp.emit.family);
  if (target.skills.wrapper && source.skills.length > 0) families.add(target.skills.wrapper.family);
  if (target.skills.copyPath !== null && source.skills.length > 0) families.add("skills-copy");
  if (target.id === "claude" && source.claudePassthrough.length > 0)
    families.add("claude-passthrough");
  if (target.id === "codex" && source.codexPassthrough.length > 0)
    families.add("codex-passthrough");
  return families;
}

/** Run every applicable emitter; collect their files. May throw EmitterNotImplementedError. */
function dispatch(
  enabled: AgentTarget[],
  allTargets: AgentTarget[],
  source: SourceModel,
): EmittedFile[] {
  const out: EmittedFile[] = [];
  const baseCtx = { allTargets, enabledTargets: enabled, source };

  // Global AGENTS.md — emitted once if any enabled target reads it (native/bridge).
  const agentsMdReader = enabled.find(
    (t) =>
      t.instructions.agentsMdSupport === "native" || t.instructions.agentsMdSupport === "bridge",
  );
  if (agentsMdReader) {
    const ctx: EmitterContext = { ...baseCtx, target: agentsMdReader };
    out.push(...getEmitter("instructions-agentsmd")(ctx));
  }

  for (const target of enabled) {
    const ctx: EmitterContext = { ...baseCtx, target };
    for (const family of familiesFor(target, source)) {
      out.push(...getEmitter(family)(ctx));
    }
  }
  return out;
}

/** Dedupe identical same-path outputs (gemini/opencode double-family). Conflicting content throws. */
function dedupeByPath(files: EmittedFile[]): EmittedFile[] {
  const byPath = new Map<string, EmittedFile>();
  for (const file of files) {
    const existing = byPath.get(file.path);
    if (existing === undefined) {
      byPath.set(file.path, file);
    } else if (existing.content !== file.content) {
      throw new Error(
        `emit conflict: "${file.path}" produced with differing content by ${existing.family} and ${file.family}`,
      );
    }
  }
  return [...byPath.values()];
}

/** Hash every neutral-source file (all `.agents/**` except the 3 generate-owned outputs). */
function computeSourceHashes(
  agentsDir: string,
  repoRoot: string,
): { path: string; sha256: string }[] {
  const results: { path: string; sha256: string }[] = [];
  const walk = (abs: string): void => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const childAbs = path.join(abs, entry.name);
      if (entry.isDirectory()) {
        walk(childAbs);
      } else {
        const isTopLevelOutput =
          path.dirname(childAbs) === agentsDir && OUTPUT_FILES.has(entry.name);
        if (isTopLevelOutput) continue;
        results.push({
          path: toPosix(path.relative(repoRoot, childAbs)),
          sha256: sha256(fs.readFileSync(childAbs, "utf-8")),
        });
      }
    }
  };
  walk(agentsDir);
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

function buildManifest(
  emitted: EmittedFile[],
  meta: MetaFile[],
  sources: { path: string; sha256: string }[],
): GeneratedManifest {
  const emitterFiles: ManifestFile[] = emitted.map((f) => ({
    path: f.path,
    sha256: sha256(f.content),
    target: f.target,
    source: f.source,
    family: f.family,
  }));
  const metaFiles: ManifestFile[] = meta.map((m) => ({
    path: m.path,
    sha256: sha256(m.content),
    target: "shared" as const,
    source: "<generated>",
    family: "fidelity" as const,
  }));
  const files = [...emitterFiles, ...metaFiles].sort((a, b) => a.path.localeCompare(b.path));
  return { toolkitVersion: pkg.version, files, sources };
}

function writeArtifacts(
  emitted: EmittedFile[],
  meta: MetaFile[],
  manifest: GeneratedManifest,
  repoRoot: string,
  agentsDir: string,
): void {
  for (const file of [...emitted, ...meta]) {
    const abs = path.join(repoRoot, ...file.path.split("/"));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, file.content);
  }
  fs.writeFileSync(
    path.join(agentsDir, "generated.manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

export function generate(opts: GenerateOptions): GenerateResult {
  const { agentsDir, repoRoot } = opts;

  if (!fs.existsSync(agentsDir)) {
    return {
      exitCode: 2,
      emitted: [],
      meta: [],
      manifest: null,
      errors: [`neutral source not found at ${agentsDir} — run "outputease agents migrate" first`],
    };
  }

  // Mapping table: schema (loader throws) + cross-field.
  let targetsData: AgentTarget[];
  try {
    targetsData = opts.targetsData ?? loadAgentTargets();
  } catch (err) {
    return {
      exitCode: 1,
      emitted: [],
      meta: [],
      manifest: null,
      errors: [`mapping table invalid: ${msg(err)}`],
    };
  }
  const crossFieldErrors = validateCrossField(targetsData).filter((i) => i.severity === "error");
  if (crossFieldErrors.length > 0) {
    return {
      exitCode: 1,
      emitted: [],
      meta: [],
      manifest: null,
      errors: crossFieldErrors.map((i) => `[${i.rule}] ${i.tool}: ${i.details}`),
    };
  }

  // Neutral source.
  let source: SourceModel;
  try {
    source = loadSource(agentsDir);
  } catch (err) {
    return {
      exitCode: 1,
      emitted: [],
      meta: [],
      manifest: null,
      errors: [`neutral source invalid: ${msg(err)}`],
    };
  }

  const enabledPhases = opts.phases ?? ["dogfood"];
  const enabled = opts.targets
    ? targetsData.filter((t) => opts.targets?.includes(t.id))
    : targetsData.filter((t) => enabledPhases.includes(t.phase));

  // Emit (may hit an unimplemented family or a real conflict → exit 4, nothing written).
  let deduped: EmittedFile[];
  try {
    deduped = dedupeByPath(dispatch(enabled, targetsData, source));
  } catch (err) {
    const hint =
      err instanceof EmitterNotImplementedError
        ? ` (re-run generate once implemented; idempotent so safe)`
        : "";
    return {
      exitCode: 4,
      emitted: [],
      meta: [],
      manifest: null,
      errors: [`emit error: ${msg(err)}${hint}`],
    };
  }

  // Fidelity report (generate-owned meta, written into .agents/ + listed in the manifest).
  const fidelity = classifyFidelity(source, enabled);
  const meta: MetaFile[] = [
    { path: ".agents/fidelity-report.json", content: `${JSON.stringify(fidelity, null, 2)}\n` },
    { path: ".agents/FIDELITY.md", content: renderFidelityMd(fidelity, enabled) },
  ];

  const manifest = buildManifest(deduped, meta, computeSourceHashes(agentsDir, repoRoot));

  if (!opts.dryRun) {
    try {
      writeArtifacts(deduped, meta, manifest, repoRoot, agentsDir);
    } catch (err) {
      return {
        exitCode: 4,
        emitted: deduped,
        meta,
        manifest,
        errors: [`write error: ${msg(err)}`],
      };
    }
  }

  return { exitCode: 0, emitted: deduped, meta, manifest, errors: [] };
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * The target set a prior generate produced, read from the manifest (distinct
 * non-`shared` targets). Lets `agents generate`/`check` default to *this project's*
 * scaffolded set rather than the phase default — a subset-scaffolded consumer
 * project (e.g. claude+codex+opencode, no gemini) must not regenerate/expect the
 * un-selected targets. Returns null when no manifest exists (first generate /
 * migrate), so the caller falls back to the phase default.
 */
export function readManifestTargets(agentsDir: string): AgentTargetId[] | null {
  const manifestPath = path.join(agentsDir, "generated.manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
      files?: { target?: string }[];
    };
    const set = new Set<string>();
    for (const file of parsed.files ?? []) {
      if (file.target && file.target !== "shared") set.add(file.target);
    }
    return set.size > 0 ? ([...set] as AgentTargetId[]) : null;
  } catch {
    return null;
  }
}
