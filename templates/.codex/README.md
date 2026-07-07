# Codex Workflow Guide

Codex is a supported primary agent for OutputEase toolkit projects. Use the same neutral source of truth as other agents: `AGENTS.md`, `.agents/`, `.specify/`, and emitted MCP config.

## Session lifecycle

- Quickstart: read `.agents/skills/quickstart/SKILL.md`, then treat trailing text as the skill arguments.
- Checkpoint: read `.agents/skills/checkpoint/SKILL.md`, then treat trailing text as the checkpoint note.
- Resume: read `.agents/skills/resume/SKILL.md`, then continue from the latest saved context.
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
- The refreshed assets include `.agents`, `.specify`, emitted MCP config, and scaffolded docs where applicable.

## Argument handling

Claude command wrappers substitute `$ARGUMENTS`. In Codex, pass the same value as trailing text after the skill name or request. Treat that trailing text as `$ARGUMENTS`.

## Claude-only enhancements

Hookify nudges, Claude plugin installs, `.claude/settings.json`, and Claude subagent orchestration remain Claude-owned enhancements. Do not silently skip those steps; state the unavailable Claude-only action and use the Codex-native fallback in the skill.
