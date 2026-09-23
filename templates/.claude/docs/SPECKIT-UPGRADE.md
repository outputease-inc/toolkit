# Upgrading spec-kit, and recovering when it goes wrong

Companion to the Spec-Driven Development section of the auto-loaded instructions. That
section states the happy path in two commands; this file carries the failure modes, which
used to be reachable only by reading `packages/toolkit/src/speckit/codex-bridge.ts`'s
header comment (finding C7).

## What an upgrade actually touches

`outputease speckit refresh` runs five steps, in this order, and the order is load-bearing:

| # | Step | Writes |
|---|---|---|
| 1 | `specify init` at the pinned ref | `.specify/**`, `.claude/skills/speckit-*` (vanilla) |
| 2 | `applyOverlayToDir` | re-applies every OE customization in `OVERLAY_RULES` |
| 3 | `writeBackSpecKitSkills` | `.agents/targets/claude/skills/speckit-*` |
| 4 | `bridgeSpecKitSkillsToCodex` | `.agents/targets/codex/skills/speckit-*` |
| 5 | `maybeRegenerate` | every generated agent surface |

Two of these are not optional conveniences:

- **Step 3 must follow step 2.** Step 1 installs a *vanilla* `/speckit-specify`; step 2
  restores its step-3 prose patch. Run the write-back without the overlay and the patch is
  copied away into the neutral source in its unpatched form, and step 5 then propagates the
  loss everywhere. The seam is guarded by `install.test.ts` → "overlay + write-back seam".
- **Step 3 must precede step 5.** Regeneration re-emits `.claude/` *from* the neutral
  source. Without the write-back the upgrade is silently reverted, and `agents:check` still
  reports "no drift" — output matches source because both went stale together. That is
  exactly how this bug survived unnoticed.

## The reconciliation, and why it is now small

An upgrade used to require reconciling both mirrored skill trees by hand: the claude
sources and their codex twins, roughly thirty files, with `.agents/targets/codex/skills/`
a frozen hand-committed copy that nothing advanced. Steps 3 and 4 make both trees derived,
so the hand-maintained remainder is exactly one file:

- `.agents/targets/codex/skills/speckit-archive/SKILL.md` — OutputEase authored
  `/speckit-archive`, so its codex copy is a source, not output. It is pinned against its
  claude twin (modulo the adapter line and ASCII transliteration) by
  `codex-bridge.test.ts`, so it fails CI rather than drifting.

Ownership is derived from location, never from a name list:

- `.agents/skills/<name>/` → OutputEase authored it. Never written back, never bridged over.
- `.agents/targets/claude/skills/<name>/` → upstream owns it. Advanced by every refresh.

## Recovery recipes

### The codex mirror is stale or was deleted

Re-run `outputease speckit refresh`. The bridge rewrites any upstream-owned destination
whose bridged body differs, so a stale or missing mirror is repaired in place. It does not
touch `speckit-archive`. If only the mirror is wrong and you do not want to re-install
spec-kit, the bridge is also what `refresh` calls — there is no separate command, and that
is deliberate: one path, always the same path.

### `speckit-archive`'s codex copy fails its pin

Its claude twin was edited and the codex copy was not. Regenerate it: take
`.claude/skills/speckit-archive/SKILL.md`, transliterate em-dash → `-` and `→` → `->`,
insert the codex adapter line immediately after the frontmatter closing fence, and write
the result to `.agents/targets/codex/skills/speckit-archive/SKILL.md`. The test states the
exact transformation and fails with a diff when it does not hold.

### An overlay rule reports `anchorMissing`

Upstream reflowed the file the rule targets. This is the expected, designed failure — the
anchors face exactly the pinned ref. Do **not** loosen the anchor to make it pass. Read the
new upstream text, update the rule's anchor and payload, refresh the matching fixture under
`packages/toolkit/src/speckit/__fixtures__/<ref>/`, and re-run. The two-representation pin
in `overlay.test.ts` will confirm the rule still reproduces the live patched file.

### An overlay rule reports `verifyFailed`

The edits applied but the probe did not match afterwards — the rule's payload and its probe
have diverged. Fix them together; they describe the same text.

### A fixture needs regenerating

Fixture provenance is checkable, not assumed. `.specify/integrations/*.manifest.json`
records a sha256 per installed file at install time, so a reconstructed vanilla fixture can
be verified: revert only the OE customization from the live file, hash it, and compare with
the manifest entry for that path. A match proves the fixture is byte-exactly what
`specify init` wrote — including spec-kit's own placeholder substitutions, which are
upstream install steps and not OE customizations.

## Bumping the pin

`SPECKIT_REF` in `packages/toolkit/src/speckit/pin.ts` is the single source of truth.
Bumping it is deliberate: the `__fixtures__/<ref>/` corpus and every anchor in `overlay.ts`
must be regenerated and re-verified against the new ref **in the same commit**.
`overlay.test.ts` fails loudly if they are not.

## Requirements

`speckit-numbering.test.ts` requires **PowerShell 6+** and fails rather than skipping
without it. The PowerShell halves of the numbering patch are as clobberable as the bash
halves, and a guard that reports success on the machine where upgrades are run protects
nothing. A user-local install is sufficient — no root, no apt.
