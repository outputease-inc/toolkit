# Codex Workflow Guide

Codex is a supported primary agent for OutputEase toolkit projects. Use the same neutral source of truth as other agents: `AGENTS.md`, `.agents/`, `.specify/`, and emitted MCP config.

## Capability resolution

Before declaring a skill, plugin, connector, or tool unavailable, check the exact user-provided path, active tools and `tool_search` where applicable, repo-local `.agents` / `.codex` / `.specify` sources, and any plugin cache path referenced by `AGENTS.md` or the user. Repo-local search alone is not authoritative for installed plugin skills.

If a `SKILL.md` is readable but no Codex `Skill` tool is exposed, use the degraded path: read the file and apply it directly. Distinguish "not directly callable" from "unavailable."

## Superpowers process skills

The superpowers plugin is optional (`claude plugin install superpowers@claude-plugins-official`).
When it is installed, follow `superpowers:brainstorming`, `superpowers:systematic-debugging`, and
the rest of the Process Skill Routing table even when Codex does not surface those skills as
directly callable.

In that degraded path, read `using-superpowers/SKILL.md` from the installed plugin cache first,
then read the specific process `SKILL.md` and follow it manually. Do not call a readable
superpowers skill unavailable just because it is missing from the active skill registry.

When the plugin is not installed, that is not a blocker: follow the same discipline manually —
design before building, plan before executing, root-cause before fixing, evidence before "done".

## Session lifecycle

- Quickstart: read `.agents/skills/quickstart/SKILL.md`, then treat trailing text as the skill arguments.
- Checkpoint: read `.agents/skills/checkpoint/SKILL.md`, then treat trailing text as the checkpoint note.
- Continue: read `.agents/skills/continue/SKILL.md`, then continue from the latest saved context.
- Dev check: read `.agents/skills/dev-check/SKILL.md`, then run the project validation it specifies.
- Session end: read `.agents/skills/session-end/SKILL.md`, then perform the closeout steps that are available in Codex. State any Claude-only action that cannot run.

## Idea, context, review, and recovery

- Capture: read `.agents/skills/capture/SKILL.md`, then treat trailing text as the idea or note to capture.
- Develop idea: read `.agents/skills/develop-idea/SKILL.md`, then treat trailing text as the idea context.
- Load context: read `.agents/skills/load-context/SKILL.md`, then treat trailing text as the topic or workstream to load.
- Security review: read `.agents/skills/security-review/SKILL.md`, then treat trailing text as the scope.
- Release recover: read `.agents/skills/release-recover/SKILL.md`, then treat trailing text as the failed release, tag, or recovery context.

## Spec-kit

Spec-kit workflow files are emitted under `.codex/skills/speckit-*` when a project enables spec-kit. Read the relevant `SKILL.md`, use trailing text as `$ARGUMENTS`, and follow `.specify/` as the source of truth for specs, plans, tasks, and archives.

Required Codex spec-kit workflows:

- `speckit-specify`
- `speckit-clarify`
- `speckit-plan`
- `speckit-tasks`
- `speckit-implement`
- `speckit-analyze`
- `speckit-checklist`
- `speckit-constitution`
- `speckit-archive`
- `speckit-git-feature`
- `speckit-git-commit`
- `speckit-git-remote`
- `speckit-git-validate`
- `speckit-git-initialize`

## Update and upgrade

- `outputease update` refreshes scaffolded project agent assets from the latest toolkit template source.
- After editing `.agents/**`, regenerate emitted outputs from the neutral source of truth and do not hand-edit `.codex`, `.claude`, `.gemini`, `.opencode`, or `AGENTS.md` outputs.
- `outputease upgrade` updates the globally installed toolkit binary. It is separate from `outputease update`.
- The refreshed assets include `.agents`, emitted MCP config, and scaffolded docs where applicable. Spec-kit (`.specify`) refreshes separately with `outputease speckit refresh`.

## Argument handling

Claude command wrappers substitute `$ARGUMENTS`. In Codex, pass the same value as trailing text after the skill name or request. Treat that trailing text as `$ARGUMENTS`.

## Claude-only enhancements

Hookify nudges, Claude plugin installs, `.claude/settings.json`, and Claude subagent orchestration remain Claude-owned enhancements. Do not silently skip those steps; state the unavailable Claude-only action and use the Codex-native fallback in the skill.
