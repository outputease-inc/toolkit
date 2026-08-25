---
name: speckit-archive
description: Archive a finished spec directory from specs/ to archive/specs/ with verification gates and reference-safe link rewriting. Invoke only when the user runs /speckit-archive explicitly or when /session-end's archival check hands off to it — never spontaneously.
allowed-tools: Read Glob Grep Edit Bash AskUserQuestion Skill
---

Archive a finished feature spec: `/speckit-archive <NNN | NNN-short-name> [--force]`

## Goal

Move a completed spec directory to `archive/specs/` as soon as the feature ships,
instead of letting it rot until a periodic documentation sweep notices. Numbering
stays safe regardless of timing — the spec-kit numbering scripts scan
`archive/specs/` too (see the LOCAL PATCH markers in `.specify/`) — so archival
is about keeping `specs/` scoped to active work.

A periodic documentation-health sweep remains the backstop for anything this
misses.

## Execution

### 1. Resolve the spec directory

Match the argument against `specs/NNN-*`:

- Bare number (`001`) → glob `specs/001-*`
- Full name (`001-user-auth`) → exact directory

Error out if no match or multiple matches. If `archive/specs/<same-dir>` already
exists, stop: name collision needs manual resolution (do NOT overwrite or merge).

### 2. Finished checks

**This is the authoritative gate.** Run all three; report each result. `--force` downgrades
failures to warnings but never skips the report. `/session-end` step 2.7 runs a looser screen
to decide whether to offer archival at all; it defers here and these checks re-run in full on
entry, however this skill was reached.

1. **Tasks complete** — `specs/<dir>/tasks.md` exists and contains zero unchecked
   boxes (`- [ ]`). A missing tasks.md counts as NOT finished (spec never reached
   implementation).
2. **Merged to main** — no unmerged feature branch remains
   (`git branch --no-merged main --list '<NNN>-*'` is empty, remote included via
   `git branch -r --no-merged main --list 'origin/<NNN>-*'`) AND
   `git status --short -- specs/<dir>` shows no uncommitted changes.
3. **Not frozen-cited** — Grep the auto-loaded core for the spec path. Read it in
   `.agents/instructions/blocks/21-speckit.md`, the block that generates it: if that
   block annotates the spec as `frozen`, `superseded`, `retired`, or cites it as
   inherited/current context, it is a live reference, not rot.

If check 3 fails, archiving demotes a cited live reference — require `--force`
AND say exactly that in the confirmation prompt.

### 3. Confirm

AskUserQuestion summarizing the three check results and the planned move. Abort
on anything other than an explicit yes.

### 4. Execute (reference-safe, one move)

1. ONE directory move — `git mv specs/<dir> archive/specs/<dir>` — so internal
   cross-links travel together and stay valid; only EXTERNAL inbound links need
   rewriting.
2. Re-scan inbound references: Grep tracked docs AND code for the OLD path
   (`specs/<dir>`) and the bare dir name.
3. Rewrite every external inbound link to `archive/specs/<dir>` in the same
   step. Root-relative links → direct replace; `../`-relative links → recompute
   against the linker's location (or convert to root-relative). Skip
   `CHANGELOG.md` history entries and git-log quotes — historical text, not live
   links. A generated linker is rewritten at its source: grep
   `.agents/instructions/blocks/` for the old path and edit the block, never the
   generated output.
4. **The auto-loaded core loses the pointer rather than keeping a rewritten one.**
   `.agents/instructions/blocks/21-speckit.md` names the spec that supplies the
   session's working context; an archived spec no longer does. Delete its
   sentence from that block — do not repoint it at `archive/specs/<dir>` — then
   `bun run agents:generate`. Rewriting instead of removing is why that pointer
   list has accumulated four superseded entries and never sheds one. Other
   linkers (docs, specs, reference material) are rewritten per step 3; only the
   auto-loaded core is pruned.
5. If `.specify/feature.json` points at the archived dir, clear or repoint it.

### 5. Verify and commit

1. Grep for the old path again — zero live references (historical text excluded).
   Run `bun run agents:generate` first if step 4 touched a block, so the generated
   surfaces are current before the grep judges them.
2. Commit the move plus every rewritten file with explicit paths, including the
   edited block AND the regenerated outputs:
   `chore(repo): archive spec <dir>`
3. Do NOT push — the session's normal push flow (`/session-end`) handles that.
   `/checkpoint` is not an option here: it commits and deliberately never pushes.

### 6. Report

```
ARCHIVED: specs/<dir> -> archive/specs/<dir>
Checks: tasks [pass|forced], merged [pass|forced], frozen-cited [clear|forced]
Links rewritten: N files ([list])
Pointer pruned from: .agents/instructions/blocks/21-speckit.md [yes|not cited]
Commit: <hash>
```

## If a write is blocked

`.claude/hooks/protect-generated.js` exits 2 on any edit to a generated file, and the
auto-loaded core is generated. Do not retry the edit and do not bypass the hook: look the
blocked path up in `.agents/generated.manifest.json` and edit the `source` it records —
for `CLAUDE.md` and `AGENTS.md` that is the owning block in
`.agents/instructions/blocks/`, identified by its unique `##` heading — then run
`bun run agents:generate` and re-check with `bun run agents:check`.
