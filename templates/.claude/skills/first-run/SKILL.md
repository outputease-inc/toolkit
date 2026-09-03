---
name: first-run
description: One-time guided first-run setup for a freshly scaffolded project. Walks the user through the parts an install command cannot: which environment variables to fill and where to get each value (the user writes them into .env.local), MCP server auth and trust, and verifying the app boots, then hands off to /quickstart. Use on the first run of a new scaffold, or when the user asks to set up, get the project running, configure env or MCP, or reports the app will not start. The agent guides and verifies; the user writes secret values and runs external commands. Self-retiring via a .outputease-first-run marker.
allowed-tools: Read Glob Grep Bash Write Edit AskUserQuestion TodoWrite
disable-model-invocation: true
---

## Goal

Get a freshly scaffolded project actually running. This covers the error-prone,
interactive steps a README and the post-scaffold summary cannot: filling env
vars, authenticating/trusting MCP servers, and confirming the app boots. Runs
once, then hands off to your agent's session-start routine (in Claude Code,
`/quickstart`) and retires itself.

## When to Use

- The first run of a project just created with `outputease init`.
- The user asks to set up, get the project running, configure env or MCP, or
  reports the app will not start, and `.outputease-first-run` is absent.

## Safety rules (read first, apply in every phase)

1. **Never write `.env.local`.** Show the exact `KEY=value` line and have the
   USER paste it. (On Claude Code a hook blocks the agent from touching
   `.env.local` regardless.)
2. **Never write a real value into `.env.example`.** It is a committed
   placeholder catalog; read it, do not edit it.
3. **Never echo, quote, confirm-back, or summarize a secret value.** Refer to a
   variable only by name ("noted `DATABASE_URL`"). Never run `printenv`, `env`,
   or `cat` on env files. Treat any inline token in an MCP config as a secret.
4. **External or irreversible commands: print, do not run.** For starting a
   database, linking a host, `gh auth`, or minting a token/secret, print the
   exact command and let the USER run it and paste back the result.
5. **Git: never `git add -A` / `git add .` / `git add -f`; never add a remote or
   push.** Stage an explicit path list only.

## Tiers (what "guided" means on each agent)

- **Claude Code:** `/first-run` slash command; the host prompts before shell
  commands. Env is guide-user-writes (hook-enforced).
- **Codex / Gemini / OpenCode:** capable terminal agents; no slash command (read
  this skill in place). Confirmations are not host-enforced, so follow the
  print-for-human rules strictly.
- **Cursor / Copilot / Windsurf:** shell execution is not guaranteed. Degrade
  every step to "here is the exact command / value to set by hand" so a human
  can follow it.

## Per-target MCP config location

Read THIS agent's own MCP config (do not assume `.mcp.json`):

| Agent | MCP config file |
|-------|-----------------|
| Claude Code | `.mcp.json` |
| Codex | `.codex/config.toml` (repo must be trusted) |
| Gemini | `.gemini/settings.json` |
| OpenCode | `opencode.json` |
| Cursor | `.cursor/mcp.json` |
| Copilot | `.vscode/mcp.json` |
| Windsurf | `.devin/config.json` |

## Procedure

### 0. Gate and detect

- If `.outputease-first-run` exists, tell the user the project is already set up
  and stop unless they explicitly want to re-run.
- Otherwise detect state from NON-secret files: `.env.example` (the required-var
  catalog), `package.json` + the lockfile (are deps installed?), and this
  agent's MCP config. Do not read `.env.local` on Claude Code (blocked); on other
  agents you may read it to see which vars are already set.

### 1. Install dependencies (safe, local, automatic)

If dependencies are not installed, run the project's install command
(e.g. `bun install` / `npm install` / `pnpm install`). This is safe to run for
the user. Judge whether it succeeded by the exit code and whether dependencies
actually installed, not by stderr text — some `prepare`/`postinstall` scripts
print warnings (even lines like `fatal:`) while still exiting 0.

If install fails, surface the exact error verbatim — it names the cause and is
what the user needs. If it looks like a postinstall script erroring, retry once
with the manager's `--ignore-scripts` flag (a common, recoverable case). Other
failures — an unresolvable dependency version, a registry or network error — are
not fixed by any install flag, so do not present one as the remedy. Either way,
if dependencies still are not installed, treat setup as blocked: you may continue
guiding env and MCP (steps 2-3, which do not need dependencies), but skip the
verify step (step 4) and end at the "when blocked" path in step 5 — do not retire
first-run on a project that is not set up.

### 2. Environment variables (guide; the user writes `.env.local`)

For each var in `.env.example` (and any the installed stack needs), tell the user
what it is and where to get the value, then show the exact line to paste into
`.env.local`. The user edits `.env.local`. Confirm completion by asking, or by the
boot check in step 4, never by reading the values back.

If `.env.example` is a generic stub — every var commented out, no concrete required
vars (the common case today) — say so plainly instead of walking placeholder lines:
tell the user the env vars their actual stack needs come from that stack's own docs
(and `SETUP.md`), and that they add them to `.env.local` as they wire each service.

### 3. MCP servers (guide; print external commands)

For each server in this agent's MCP config: explain what it does and print the
auth/trust step. For token-bearing servers, tell the user to obtain the token and
set it as an env-var reference (never inline a token into committed config). Note
Codex requires trusting the repo before its MCP servers load. Some servers need
more than a token — a CLI-backed server may require that CLI to be installed and
authenticated first (an external command — print it, do not run it). `SETUP.md` is
the per-server reference for the exact auth/trust steps; point the user there.

### 4. Verify

- **Static verify:** if dependencies installed successfully, run typecheck (safe
  and local). If install was blocked (step 1), skip it — typecheck cannot run
  without dependencies.
- **Runtime boot (conditional):** run `dev`/`build` ONLY if the external services
  it needs were provisioned. If the user deferred an external service (e.g. a
  database), a boot failure is expected, not a bug: record "boot deferred: start
  <service>, then re-run" and move on. Do not chase an unfixable failure or run a
  gated external command to force it.

### 5. Hand off and retire

Retire first-run only when setup actually completed: install succeeded and static
verify (typecheck) passed. A deferred external service (the step-4 boot deferral)
still counts as complete; a failed install or a failed typecheck does not.

**When complete:**

- Tell the user: one-time setup is done; from now on start each session with
  your agent's session-start / quickstart routine (in Claude Code, run
  `/quickstart`) to load context, not this setup; re-run first-run only after a
  re-clone or environment reset.
- Write the marker `.outputease-first-run` at the project root (a small JSON
  stamp is fine, e.g. `{ "completedAt": "<ISO date>" }`) so this stops offering.

**When blocked** (install or typecheck failed, or a required step could not be
completed):

- Do NOT write the marker — its absence keeps first-run available for a retry.
- Summarize the blocking step and what the user must resolve — the exact command
  if there is one, otherwise the specific thing to fix (quote the error) — then
  tell the user to re-run first-run once it is resolved.

## Notes

- If the user set the project up by hand and just wants the offer to stop, write
  the `.outputease-first-run` marker and exit.
- This skill is one-time; your agent's session-start routine (in Claude Code,
  `/quickstart`) is the recurring per-session ritual.
