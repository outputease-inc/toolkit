import { Command } from "@commander-js/extra-typings";
import pkg from "../../package.json" with { type: "json" };
import { upgradeAction } from "../upgrade/action";
import { makeAgentsCommand } from "./commands/agents";
import { CLI_COMMANDS } from "./commands/registry";
import { initAction } from "./init";
import { speckitAction } from "./speckit";
import { updateAction } from "./update";

/** Summary for `name`, or throw — a missing row is a registry bug, not a default. */
function summaryOf(name: string): string {
  const row = CLI_COMMANDS.find((c) => c.name === name);
  if (!row) throw new Error(`CLI_COMMANDS has no row for "${name}"`);
  return row.summary;
}

export function buildProgram(): Command {
  const program = new Command()
    .name("outputease")
    .description("OutputEase CLI toolkit for scaffolding development projects")
    .version(pkg.version);

  program
    .command("update")
    .description(summaryOf("update"))
    .option("--yes", "Non-interactive: skip every locally-modified file by default", false)
    .option("--dry-run", "Print planned actions without writing to the project", false)
    .option("--verbose", "Emit per-file diffs and timing info", false)
    .action(async (opts) => {
      const result = await updateAction(process.cwd(), {
        yes: opts.yes ?? false,
        dryRun: opts.dryRun ?? false,
        verbose: opts.verbose ?? false,
      });
      process.exit(result.exitCode);
    });

  program
    .command("upgrade")
    .description(summaryOf("upgrade"))
    .option("--yes", "Non-interactive: run the upgrade without confirming", false)
    .option("--dry-run", "Print the detected upgrade command without running it", false)
    .action(async (opts) => {
      const result = await upgradeAction({
        yes: opts.yes ?? false,
        dryRun: opts.dryRun ?? false,
      });
      process.exit(result.exitCode);
    });

  program
    .command("speckit")
    .description(summaryOf("speckit"))
    .argument("<mode>", "init | refresh | verify")
    .option("--yes", "Non-interactive: accept defaults without prompting", false)
    .option("--dry-run", "Print the planned spec-kit actions without running them", false)
    .option("--integration <id>", "spec-kit --integration target (default: derived from .agents/)")
    .action(async (mode, opts) => {
      const result = await speckitAction(mode, process.cwd(), {
        yes: opts.yes ?? false,
        dryRun: opts.dryRun ?? false,
        integration: opts.integration,
      });
      process.exit(result.exitCode);
    });

  program
    .command("init")
    .description(summaryOf("init"))
    .argument("[name]", "Project name")
    .option("--preset <name>", "Use a predefined stack preset")
    .option("-n, --name <name>", "Project name (alternative to argument)")
    .option("--pm <manager>", "Package manager: bun, npm, yarn, pnpm", "bun")
    .option("--dry-run", "Preview file tree without writing to disk", false)
    .option(
      "--agents <ids...>",
      "Agent targets to scaffold, e.g. claude,codex,opencode (supersedes --claude)",
    )
    .option("--claude", "Alias for --agents claude (deprecated; adds claude to the set)")
    .option("--no-claude", "Remove claude from the agent set")
    .option("--uv", "Install uv (Python package manager) without prompting")
    .option("--no-uv", "Skip uv installation (also skips spec-kit)")
    .option("--speckit", "Include spec-kit without prompting")
    .option("--no-speckit", "Skip spec-kit installation")
    .option("--runtime <runtime>", "Runtime: bun, node")
    .option("--backend <backend>", "Backend: none, supabase, standalone")
    .option(
      "--scope <scope>",
      "Project scope: standalone, workspace-app, workspace-package, monorepo",
    )
    .option("--force", "Overwrite existing files in a non-empty target directory")
    .option("--no-banner", "Skip the startup banner")
    .action(initAction);

  program.addCommand(makeAgentsCommand());
  return program;
}
