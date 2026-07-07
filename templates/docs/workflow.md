# Development Workflow

How this project's workflow assets are organized, how to run a session with different agents, and how to keep generated agent files in sync.

## Source Of Truth

This scaffold is agent-neutral at the source layer:

- `AGENTS.md` is the shared operator guide.
- `.agents/` contains the neutral instruction blocks, skills, MCP definitions, and target configuration inputs.
- `.agents/mcp/servers.json` is the neutral MCP source. Emitted MCP config files are emitted per agent target. Edit and regenerate from source, do not hand-edit emitted configs.
- `.specify/` contains the spec-kit workflow assets for multi-step feature work.
- Agent-specific folders such as `.claude/` or other emitted targets are generated outputs.

Edit the neutral source first. Regenerate emitted files after changes. Do not hand-edit generated agent surfaces unless the project explicitly documents a target-owned exception.

## Session Lifecycle

Most day-to-day work follows the same lifecycle regardless of agent:

1. Read `AGENTS.md` and any task-specific brief before making changes.
2. Start with the quickstart surface for your agent, when available.
3. Use checkpoint-style saves during longer sessions.
4. Resume from the project handoff and git state after interruptions.
5. Run the project's verification step before claiming completion.
6. End the session with a final handoff when you are done.

The common session concepts are:

- `quickstart`: load project context and validate the local setup.
- `checkpoint`: save progress during active work.
- `resume`: recover state after a pause or crash.
- `dev-check`: run the project's focused validation before handoff or commit.
- `session-end`: capture handoff notes and close the session cleanly.

The exact invocation depends on the agent surface you are using.

## Toolkit Commands

`outputease update` refreshes scaffolded project agent, spec, and docs assets from the toolkit templates.
`outputease upgrade` updates the globally installed toolkit binary.

`update` touches project files. `upgrade` touches the CLI.

## Claude Code Surface

Claude Code can expose many workflow actions as slash commands when this scaffold emits them into `.claude/`.

Typical Claude usage:

- Run slash commands such as `/quickstart`, `/checkpoint`, `/resume`, `/dev-check`, and `/session-end` when those commands are present.
- Use Claude-owned integrations such as Hookify orchestration, plugin install flows, `.claude/settings.json`, and Claude subagents when the project emits them.
- Treat Claude-specific helpers as convenience layers over the neutral workflow, not the source of truth.

If a command or helper exists only in `.claude/`, document it as a Claude enhancement rather than a project-wide requirement.

## Codex Surface

Codex uses the same project instructions, but its invocation model is different.

Typical Codex usage:

- Read the relevant skill file from `.agents/skills/` or the emitted Codex skill surface before acting.
- Pass any skill arguments as trailing text, matching the skill's documented interface.
- Follow `AGENTS.md`, the task brief, and the project test and verification commands directly from the workspace.

Do not assume Codex has slash commands. If the project emits a Codex-specific command wrapper later, document that wrapper explicitly instead of describing slash commands in general terms.

## Spec-Kit Workflow

Use `.specify/` for larger features, multi-session work, or tasks that need structured planning and tracking.

The usual spec-kit progression is:

1. `specify`: define the request, goals, and constraints.
2. `plan`: turn the request into an implementation plan.
3. `tasks`: break the plan into concrete execution units.
4. `implement`: execute the tasks with tests and verification.
5. `check`: review the result against the plan and acceptance criteria.
6. `archive`: retire completed specs and keep the record tidy.

Agent wrappers may expose these steps differently, but the lifecycle and source files live under `.specify/`.

## Regeneration Discipline

When workflow instructions, skills, or agent-specific outputs need to change:

1. Update `.agents/**` and any related shared docs such as `AGENTS.md`.
2. Regenerate the emitted agent files with the project's generator command.
3. Review the generated diff instead of patching emitted outputs by hand.
4. Re-run the relevant tests and checks.

Generated targets are derived artifacts. If a generated file conflicts with the source, the source wins. Do not hand-edit emitted outputs.

## Related Files

- [AGENTS.md](../AGENTS.md)
- [.agents/](../.agents/)
- [.specify/](../.specify/)
- [conventions.md](./conventions.md)
- [testing.md](./testing.md)
