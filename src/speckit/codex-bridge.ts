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
 * file. Pre-existing destinations are skipped, which preserves OE's own
 * `speckit-archive`.
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
  /** Skill names written to `.agents/targets/codex/skills/`. */
  bridged: string[];
  /** Skill names left alone because a destination already existed (e.g. speckit-archive). */
  skipped: string[];
  /** Per-skill failures. Never thrown — the caller degrades, it does not abort. */
  errors: string[];
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
    if (fs.existsSync(dest)) {
      result.skipped.push(name);
      continue;
    }
    try {
      const bridged = insertCodexAdapter(fs.readFileSync(src, "utf-8"));
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
