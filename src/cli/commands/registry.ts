/**
 * The one list of top-level `outputease` commands. `program.ts` registers from
 * it and `@outputease/toolkit/facts` reports it, so the CLI and anything that
 * describes the CLI cannot drift apart. Data only: importing this module must
 * not pull in commander.
 */
export type CliCommandInfo = {
  /** Command name as typed: `outputease <name>`. */
  name: string;
  /** One-line description, verbatim as commander registers it. */
  summary: string;
};

export const CLI_COMMANDS: CliCommandInfo[] = [
  {
    name: "init",
    summary: "Scaffold a new project interactively or from a preset",
  },
  {
    name: "update",
    summary: "Refresh Claude Code + spec-kit tooling in an existing scaffolded project",
  },
  {
    name: "upgrade",
    summary: "Update the globally-installed outputease CLI to the latest published version",
  },
  {
    name: "speckit",
    summary: "Install, refresh, or verify spec-kit (github/spec-kit) in this project",
  },
  {
    name: "agents",
    summary: "Generate, check, apply, and migrate agent configuration from the neutral source",
  },
];
