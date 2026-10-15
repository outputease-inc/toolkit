import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Rebuild Codex's spec-kit skill surface from the freshly-installed upstream one.
 *
 * Before the payload-hygiene gate, Codex got spec-kit skills from a hand-committed
 * fork at `templates/.codex/skills/speckit-*`, backfilled by
 * `copySpecKitSkillsToCodexTarget` (`scaffold/agent-seed.ts:234-252`) reading
 * `templates/.claude/skills/speckit-*`. The gate deletes both trees, so both
 * sources vanish — and this bites even on a claude-primary scaffold, because
 * `primarySpecKitIntegration` (`agent-seed.ts:97-100`) returns "claude" whenever
 * claude is selected, so `specify init` only ever installs the claude surface.
 * Codex's copies were always an OE hand-bridge. Measured without it: 16 -> 1.
 *
 * The fork's ONLY divergence from its `.claude` twin is one injected line. Verified
 * 2026-07-24 by diffing every pair in `packages/toolkit/templates/` (16/16 identical):
 * each differs by exactly one added line, always at frontmatter-close + 1. Observed
 * diff offsets `11a12` (x9), `10a11` (x1), `8a9` (x5), `5a6` (x1) — in every case equal
 * to the closing fence's line number. No blank line is added; the original post-fence
 * blank stays. At the monorepo root the same holds for the 15 upstream skills;
 * `speckit-archive` is OE-authored, ASCII-transliterated for codex, and is exactly the
 * skill this function skips.
 *
 * Writes to `.agents/targets/codex/skills/` — the neutral SOURCE, not the generated
 * `.codex/` tree — so the caller's `generate()` run emits it like any other target
 * file.
 *
 * ## Why an existing destination is no longer skipped outright (finding C1)
 *
 * It used to be, and that froze the mirror. `outputease speckit refresh` runs
 * `runSpecifyInit` -> `applyOverlayToDir` -> `bridgeSpecKitSkillsToCodex` ->
 * `maybeRegenerate`. With every existing destination skipped, a refresh advanced the
 * upstream install but left `.agents/targets/codex/skills/` at whatever was committed,
 * and `agents:check` still passed because each generated output matched its stale
 * source. The upgrade reported success while reverting the mirror, invisibly.
 *
 * The fix is deliberately narrow — three arms, and only the middle one is new:
 *
 * | destination | upstream-owned | action |
 * |---|---|---|
 * | absent | either | write (unchanged — a fresh scaffold must still bridge) |
 * | exists | yes | rewrite when the bridged body differs, skip when it matches |
 * | exists | no | skip, always |
 *
 * **Ownership is derived, never a name list.** A skill is upstream-owned iff
 * `.agents/targets/claude/skills/<name>/` exists — precisely the tree `specify init`
 * populates. At the monorepo root that holds the 15 upstream speckit skills and NOT
 * `speckit-archive`, which is OE-authored, lives in `.agents/skills/`, and whose codex
 * copy is additionally ASCII-transliterated. Naming `speckit-archive` here would be the
 * hand-maintained roster Constitution VI forbids and would mis-classify the next
 * OE-authored `speckit-*` skill; deriving it means OE authorship is stated once, by
 * where the skill lives.
 */

/**
 * The one adapter line. ONE line, 187 chars — spec 2026-07-24 §5.6 renders it wrapped
 * inside a code fence, which is visual only. Do not reflow it: `insertCodexAdapter`'s
 * REPO_ROOT equivalence test compares byte-for-byte against the committed skills.
 */
export const CODEX_ADAPTER_LINE =
  "> Codex adapter: treat trailing text as `$ARGUMENTS`. If a step requires a Claude-only command wrapper, perform the same file and command steps directly and state the unavailable wrapper.";

/**
 * Character offset of the first byte AFTER the frontmatter's closing `---` line,
 * or null when the document has no YAML frontmatter. LF only: spec-kit writes its
 * skill bodies from a Linux-built zip, so CRLF never reaches us here.
 */
function frontmatterCloseIndex(source: string): number | null {
  if (!source.startsWith("---\n")) return null;
  const close = source.indexOf("\n---\n", 3);
  if (close === -1) return null;
  return close + "\n---\n".length;
}

/**
 * Insert `CODEX_ADAPTER_LINE` immediately after the frontmatter closing fence.
 * Not idempotent by design — `bridgeSpecKitSkillsToCodex` skips files that already
 * exist rather than re-reading and re-detecting.
 */
export function insertCodexAdapter(source: string): string {
  const bodyStart = frontmatterCloseIndex(source);
  if (bodyStart === null) {
    throw new Error("SKILL.md has no closing frontmatter fence");
  }
  return `${source.slice(0, bodyStart)}${CODEX_ADAPTER_LINE}\n${source.slice(bodyStart)}`;
}

export interface CodexBridgeResult {
  /** Skill names written to `.agents/targets/codex/skills/` — created or advanced. */
  bridged: string[];
  /**
   * Skill names left alone: either OE-authored (not upstream-owned, e.g. `speckit-archive`)
   * or already byte-identical to the bridged source. Both are no-ops, and neither is an
   * error — but only the second means "already current".
   */
  skipped: string[];
  /** Per-skill failures. Never thrown — the caller degrades, it does not abort. */
  errors: string[];
}

/**
 * Does upstream own this skill? True iff `specify init`'s claude target tree carries it.
 *
 * Existence is the whole signal — the body is never read, so this answers correctly even
 * when that body is stale, which is the state every refresh starts from. Returning false
 * is the conservative answer: it preserves an OE-authored destination untouched.
 */
function isUpstreamOwned(projectDir: string, name: string): boolean {
  return fs.existsSync(path.join(projectDir, ".agents", "targets", "claude", "skills", name));
}

export function bridgeSpecKitSkillsToCodex(projectDir: string): CodexBridgeResult {
  const result: CodexBridgeResult = { bridged: [], skipped: [], errors: [] };
  const claudeSkills = path.join(projectDir, ".claude", "skills");
  const codexSkills = path.join(projectDir, ".agents", "targets", "codex", "skills");
  if (!fs.existsSync(claudeSkills)) return result;

  for (const name of fs.readdirSync(claudeSkills).sort()) {
    if (!name.startsWith("speckit-")) continue;
    const src = path.join(claudeSkills, name, "SKILL.md");
    if (!fs.existsSync(src)) continue;
    const dest = path.join(codexSkills, name, "SKILL.md");
    const destExists = fs.existsSync(dest);
    // An OE-authored destination is never rewritten, however far it has diverged.
    if (destExists && !isUpstreamOwned(projectDir, name)) {
      result.skipped.push(name);
      continue;
    }
    try {
      const bridged = insertCodexAdapter(fs.readFileSync(src, "utf-8"));
      // Already current. Reported as skipped rather than bridged so a refresh
      // distinguishes a real advance from a no-op.
      if (destExists && fs.readFileSync(dest, "utf-8") === bridged) {
        result.skipped.push(name);
        continue;
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, bridged);
      result.bridged.push(name);
    } catch (err) {
      result.errors.push(
        `codex bridge: ${name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return result;
}
