import {
  collectStaticFiles,
  deduplicateFiles,
  type RenderedFile,
  renderTemplates,
  type StaticTemplateGroup,
  type TemplateData,
} from "../../../scaffold/renderer";
import type { ScaffoldScope } from "../../../schema/scaffold";

/**
 * Static template groups for root-level docs (standalone/monorepo only).
 * README.md, CHANGELOG.md, CONTRIBUTING.md, SECURITY.md, INDEX.md, and CLAUDE.md
 * are scaffolded via .eta templates instead (see `getTemplateDirs` / `renderMonorepoTemplates`).
 * Only files without CLI-resolvable placeholders remain here: HANDOFF.md, LICENSE,
 * SETUP.md, TODO.md, plus legacy pipeline assets (toolkit.config.json, setup-placeholders.js,
 * verify-setup.js) that ship for users who run the deprecated `pipeline/run.ts` against
 * a scaffolded project.
 */
const ROOT_STATIC_GROUPS: StaticTemplateGroup[] = [
  { sourceDir: "root", outputPrefix: "" },
  { sourceDir: "docs", outputPrefix: "docs/" },
];

/** Static template group for Claude Code infrastructure. */
const CLAUDE_STATIC_GROUP: StaticTemplateGroup = {
  sourceDir: ".claude",
  outputPrefix: ".claude/",
};

/**
 * Get scope-appropriate static template groups.
 * Root + docs are only included for standalone/monorepo scopes.
 * Claude static files are included for all scopes when opted in.
 */
export function getStaticTemplateGroups(
  scope: ScaffoldScope,
  claude: boolean,
): StaticTemplateGroup[] {
  const groups: StaticTemplateGroup[] = [];

  if (scope === "standalone" || scope === "monorepo") {
    groups.push(...ROOT_STATIC_GROUPS);
  }

  if (claude) {
    groups.push(CLAUDE_STATIC_GROUP);
  }

  return groups;
}

export function getTemplateDirs(framework: string, claude: boolean): string[] {
  const dirs = ["base", "automation"];

  switch (framework) {
    case "next.js":
      dirs.push("web-app/next");
      break;
    case "astro":
      dirs.push("content-site/astro");
      break;
    case "capacitor":
      dirs.push("mobile-app/capacitor");
      break;
    case "tauri":
      dirs.push("desktop-app/tauri");
      break;
    case "bun-cli":
      dirs.push("cli-tool");
      break;
    case "library":
      dirs.push("library");
      break;
  }

  if (claude) {
    dirs.push("claude");
  }

  // `root` comes last so its comprehensive README.md / CHANGELOG.md / etc. overwrite
  // the minimal stubs in `base/` and `automation/`. Workspace scopes never include
  // `root`, so their sub-package READMEs come from `base/`.
  dirs.push("root");

  return dirs;
}

/**
 * Render templates for a full monorepo layout:
 * - Monorepo root templates (turbo.json, root package.json, etc.)
 * - App templates prefixed under apps/web/
 * - Claude templates at root (if opted in)
 */
export function renderMonorepoTemplates(
  framework: string,
  claude: boolean,
  data: TemplateData,
): RenderedFile[] {
  const files: RenderedFile[] = [];

  // 1. Monorepo root templates + automation, then `root` last so its comprehensive
  //    docs (README, CHANGELOG, etc.) overwrite minimal stubs in monorepo/automation.
  const monoFiles = renderTemplates(["monorepo", "automation", "root"], data);
  files.push(...monoFiles);

  // 2. App templates (base + framework) prefixed under apps/web/
  const appDirs = getAppTemplateDirs(framework);
  const appData: TemplateData = {
    ...data,
    appName: `@${data.projectName}/web`,
    workspaceDeps: {
      [`@${data.projectName}/config-typescript`]: "workspace:*",
    },
  };
  const appFiles = renderTemplates(appDirs, appData);
  for (const file of appFiles) {
    files.push({ relativePath: `apps/web/${file.relativePath}`, content: file.content });
  }

  // 3. Claude .eta templates at root (if opted in)
  if (claude) {
    const claudeFiles = renderTemplates(["claude"], data);
    files.push(...claudeFiles);
  }

  // 4. Static template files (root + docs at monorepo root, claude if opted in)
  const staticGroups = getStaticTemplateGroups("monorepo", claude);
  const staticFiles = collectStaticFiles(staticGroups);

  return deduplicateFiles(files, staticFiles);
}

/**
 * Get template directories for app-only templates (no monorepo root, no claude).
 */
export function getAppTemplateDirs(framework: string): string[] {
  const dirs = ["base"];
  switch (framework) {
    case "next.js":
      dirs.push("web-app/next");
      break;
    case "astro":
      dirs.push("content-site/astro");
      break;
    case "capacitor":
      dirs.push("mobile-app/capacitor");
      break;
    case "tauri":
      dirs.push("desktop-app/tauri");
      break;
    case "bun-cli":
      dirs.push("cli-tool");
      break;
    case "library":
      dirs.push("library");
      break;
  }
  return dirs;
}

/**
 * Render templates for a workspace app (no root configs like biome.json/.gitignore).
 */
export function renderWorkspaceAppTemplates(
  framework: string,
  claude: boolean,
  data: TemplateData,
): RenderedFile[] {
  const templateDirs = getAppTemplateDirs(framework);
  if (claude) templateDirs.push("claude");
  const etaFiles = renderTemplates(templateDirs, data);
  const excludeInWorkspace = new Set(["biome.json", ".gitignore"]);
  const filteredEtaFiles = etaFiles.filter((f) => !excludeInWorkspace.has(f.relativePath));

  // Workspace scopes only get Claude static files (root/docs belong at workspace root)
  if (claude) {
    const staticFiles = collectStaticFiles([CLAUDE_STATIC_GROUP]);
    return deduplicateFiles(filteredEtaFiles, staticFiles);
  }

  return filteredEtaFiles;
}

/**
 * Render templates for a workspace package (no root configs like biome.json/.gitignore).
 */
export function renderWorkspacePackageTemplates(
  framework: string,
  claude: boolean,
  data: TemplateData,
): RenderedFile[] {
  const templateDirs = getAppTemplateDirs(framework);
  if (claude) templateDirs.push("claude");
  const etaFiles = renderTemplates(templateDirs, data);
  const excludeInWorkspace = new Set(["biome.json", ".gitignore"]);
  const filteredEtaFiles = etaFiles.filter((f) => !excludeInWorkspace.has(f.relativePath));

  // Workspace scopes only get Claude static files (root/docs belong at workspace root)
  if (claude) {
    const staticFiles = collectStaticFiles([CLAUDE_STATIC_GROUP]);
    return deduplicateFiles(filteredEtaFiles, staticFiles);
  }

  return filteredEtaFiles;
}
