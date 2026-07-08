#!/usr/bin/env bun
import { Command } from "@commander-js/extra-typings";
import pkg from "../../package.json" with { type: "json" };
import { upgradeAction } from "../upgrade/action";
import { makeAgentsCommand } from "./commands/agents";
import { initAction } from "./init";
import { updateAction } from "./update";

const program = new Command()
  .name("outputease")
  .description("OutputEase CLI toolkit for scaffolding development projects")
  .version(pkg.version);

program
  .command("update")
  .description("Refresh Claude Code + spec-kit tooling in an existing scaffolded project")
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
  .description("Update the globally-installed outputease CLI to the latest published version")
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
  .command("init")
  .description("Scaffold a new project interactively or from a preset")
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

program.parse();
