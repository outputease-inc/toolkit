import * as fs from "node:fs";
import * as path from "node:path";
import * as clack from "@clack/prompts";
import { Command } from "@commander-js/extra-typings";
import pc from "picocolors";
import { apply } from "../../../agents/apply";
import { type CheckResult, check, formatDrift } from "../../../agents/check";
import { generate, readManifestTargets } from "../../../agents/generate";
import { defaultClassify, executeMigration, splitInstructions } from "../../../agents/migrate";
import type { AgentTargetId } from "../../../schema/agent-targets";

/**
 * `outputease agents` command group (spec 008, contracts/cli-agents.md).
 * Subcommands: generate (T019). check/apply/migrate are added in their phases.
 * All subcommands are non-interactive-safe unless noted; exit codes per contract.
 */

export function renderCheckResult(result: CheckResult): { stdout: string[]; stderr: string[] } {
  if (result.exitCode === 0) {
    return {
      stdout: [pc.green("✓ no drift — generated tree matches the neutral source")],
      stderr: [],
    };
  }
  if (result.exitCode === 2 || result.errors.length > 0) {
    return {
      stdout: [],
      stderr: result.errors.map((err) => pc.red(err)),
    };
  }
  return {
    stdout: [],
    stderr: [
      pc.red(`✗ drift detected (${result.drift.length}):`),
      ...result.drift.map((line) => `  ${formatDrift(line)}`),
      pc.dim("  fix the neutral source and run: bun run agents:generate"),
    ],
  };
}

export function makeAgentsCommand(): Command {
  const agents = new Command("agents").description(
    "Generate, check, apply, and migrate agent configuration from the neutral source",
  );

  agents
    .command("generate")
    .description("Regenerate every managed artifact from the neutral source × mapping table")
    .option(
      "--targets <ids...>",
      "Only generate for these target ids (default: the project's own scaffolded set)",
    )
    .option("--dry-run", "Print the would-write list; write nothing", false)
    .option("--verbose", "List every emitted file", false)
    .action((opts) => {
      const repoRoot = process.cwd();
      const agentsDir = path.join(repoRoot, ".agents");
      // Default to this project's own set (manifest targets) so a subset-scaffolded
      // project regenerates exactly what it has; fall back to the phase default only
      // on a first generate (no manifest yet).
      const targets =
        (opts.targets as AgentTargetId[] | undefined) ??
        readManifestTargets(agentsDir) ??
        undefined;
      const result = generate({
        agentsDir,
        repoRoot,
        targets,
        dryRun: opts.dryRun ?? false,
      });

      if (result.exitCode === 0) {
        const verb = opts.dryRun ? "would generate" : "generated";
        console.log(pc.green(`✓ ${verb} ${result.emitted.length} file(s)`));
        if (opts.verbose || opts.dryRun) {
          for (const file of result.emitted) console.log(`  ${file.path}`);
        }
      } else {
        for (const err of result.errors) console.error(pc.red(err));
      }
      process.exit(result.exitCode);
    });

  agents
    .command("check")
    .description("Drift tripwire: regenerate in memory and byte-compare against the working tree")
    .action(() => {
      const repoRoot = process.cwd();
      const result = check({ repoRoot, agentsDir: path.join(repoRoot, ".agents") });
      const output = renderCheckResult(result);
      for (const line of output.stdout) console.log(line);
      for (const line of output.stderr) console.error(line);
      process.exit(result.exitCode);
    });

  agents
    .command("apply")
    .description(
      "Merge user-global MCP config (Windsurf Cascade, Codex user scope) — owns only managed servers",
    )
    .option("--targets <ids...>", "Target ids to apply (e.g. windsurf, codex)")
    .option("--dry-run", "Print planned changes; write nothing", false)
    .action((opts) => {
      const repoRoot = process.cwd();
      const result = apply({
        agentsDir: path.join(repoRoot, ".agents"),
        targets: (opts.targets ?? []) as AgentTargetId[],
        dryRun: opts.dryRun ?? false,
      });
      for (const change of result.changes) {
        const color =
          change.status === "error" ? pc.red : change.status === "unchanged" ? pc.dim : pc.green;
        const detail = change.detail ? ` (${change.detail})` : "";
        console.log(color(`  ${change.status.padEnd(9)} ${change.target} ${change.path}${detail}`));
      }
      process.exit(result.exitCode);
    });

  agents
    .command("migrate")
    .description("One-time: move CLAUDE.md + .claude/ + .mcp.json into the neutral .agents/ source")
    .option("--yes", "Non-interactive: accept the default section classification", false)
    .action(async (opts) => {
      const repoRoot = process.cwd();
      if (fs.existsSync(path.join(repoRoot, ".agents"))) {
        console.error(pc.red(".agents/ already exists — migration has already run."));
        process.exit(3);
      }

      // Confirm the core-vs-claude section split unless --yes.
      if (!opts.yes) {
        if (!process.stdin.isTTY) {
          console.error(pc.red("Non-interactive shell: re-run with --yes to accept defaults."));
          process.exit(1);
        }
        const claudeMd = fs.readFileSync(path.join(repoRoot, "CLAUDE.md"), "utf-8");
        const sections = splitInstructions(claudeMd, defaultClassify)
          .filter((b) => b.title !== null)
          .map(
            (b) => `${b.scope === "claude" ? pc.yellow("claude") : pc.dim("core ")}  ${b.title}`,
          );
        clack.intro("Migrate to neutral .agents/ source");
        clack.note(sections.join("\n"), "Section classification (claude sections are Claude-only)");
        const ok = await clack.confirm({ message: "Proceed with this classification?" });
        if (clack.isCancel(ok) || !ok) {
          clack.cancel("Migration aborted.");
          process.exit(3);
        }
      }

      const result = executeMigration({ repoRoot });
      if (result.exitCode === 0) {
        console.log(
          pc.green("✓ migrated to .agents/ — byte-identity gate passed (zero unexplained diffs)"),
        );
        console.log(pc.dim("  see specs/008-agent-agnostic-toolkit/migration-record.md"));
      } else {
        for (const err of result.errors) console.error(pc.red(err));
        if (result.unexplained.length > 0) {
          console.error(pc.red(`Unexplained diffs:\n  ${result.unexplained.join("\n  ")}`));
        }
      }
      process.exit(result.exitCode);
    });

  return agents;
}
