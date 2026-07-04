import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { Eta } from "eta";
import type { PackageManagerConfig, ResolvedStack, ScaffoldScope } from "../schema/scaffold";

/**
 * Template data passed to every .eta template as `it`.
 *
 * The optional derived fields (`installCommand`, `devCommand`, etc.) are populated
 * by `deriveTemplateTokens()` and let templates substitute CLI-resolvable values
 * via `<%= it.installCommand %>` instead of relying on legacy `[TOKEN]` brackets.
 */
export interface TemplateData {
  projectName: string;
  pm: PackageManagerConfig;
  frameworkConfig: ResolvedStack["frameworkConfig"];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  stackSummary: string[];
  scope: ScaffoldScope;
  installCommand?: string;
  devCommand?: string;
  buildCommand?: string;
  testCommand?: string;
  lintCommand?: string;
  runtime?: string;
  language?: string;
  framework?: string;
  toolkitVersion?: string;
  date?: string;
  releaseDate?: string;
  defaultBranch?: string;
  licenseType?: string;
  [key: string]: unknown;
}

/**
 * Rendered file — a path relative to the project root and its content.
 */
export interface RenderedFile {
  relativePath: string;
  content: string;
}

/**
 * Configuration for a static (non-Eta) template directory.
 */
export interface StaticTemplateGroup {
  /** Directory name under templates/ (e.g., "root", "docs", "claude") */
  sourceDir: string;
  /** Prefix added to each file's output path (e.g., "", "docs/", ".claude/") */
  outputPrefix: string;
  /** File names to exclude from this group (matched against the relative path within sourceDir) */
  exclude?: Set<string>;
}

// Resolve the templates directory relative to this source file
const TEMPLATES_DIR = join(import.meta.dirname ?? ".", "..", "..", "templates", "scaffolding");
const STATIC_TEMPLATES_DIR = join(import.meta.dirname ?? ".", "..", "..", "templates");

const eta = new Eta({
  views: TEMPLATES_DIR,
  autoEscape: false,
  varName: "it",
  defaultExtension: ".eta",
});

/**
 * Render all templates for a given project type and return the rendered files.
 */
export function renderTemplates(templateDirs: string[], data: TemplateData): RenderedFile[] {
  const files: RenderedFile[] = [];

  for (const dir of templateDirs) {
    const fullDir = join(TEMPLATES_DIR, dir);
    if (!existsSync(fullDir)) continue;
    collectTemplates(fullDir, fullDir, data, files);
  }

  return files;
}

/**
 * Recursively find and render .eta templates in a directory.
 */
function collectTemplates(
  baseDir: string,
  currentDir: string,
  data: TemplateData,
  files: RenderedFile[],
): void {
  const entries = readdirSync(currentDir);

  for (const entry of entries) {
    const fullPath = join(currentDir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      collectTemplates(baseDir, fullPath, data, files);
    } else if (entry.endsWith(".eta")) {
      // Relative template path from TEMPLATES_DIR for eta.render
      const templatePath = relative(TEMPLATES_DIR, fullPath);
      // Output path strips .eta extension and is relative to baseDir
      const relFromBase = relative(baseDir, fullPath);
      const outputPath = relFromBase.replace(/\.eta$/, "").replace(/\\/g, "/");

      const content = eta.render(templatePath, data);
      files.push({ relativePath: outputPath, content });
    }
  }
}

/**
 * Collect static (non-Eta) template files and return them as RenderedFile[].
 * Reads files verbatim from the specified template directories.
 */
export function collectStaticFiles(groups: StaticTemplateGroup[]): RenderedFile[] {
  const files: RenderedFile[] = [];

  for (const group of groups) {
    const fullDir = join(STATIC_TEMPLATES_DIR, group.sourceDir);
    if (!existsSync(fullDir)) continue;
    walkStaticDir(fullDir, fullDir, group.outputPrefix, group.exclude, files);
  }

  return files;
}

/**
 * Merge static files into rendered files, with rendered (Eta) files taking precedence.
 * If a static file has the same relativePath as a rendered file, the rendered version wins.
 */
export function deduplicateFiles(
  renderedFiles: RenderedFile[],
  staticFiles: RenderedFile[],
): RenderedFile[] {
  const renderedPaths = new Set(renderedFiles.map((f) => f.relativePath));
  const uniqueStaticFiles = staticFiles.filter((f) => !renderedPaths.has(f.relativePath));
  return [...renderedFiles, ...uniqueStaticFiles];
}

/**
 * Recursively read all files from a directory and build RenderedFile entries.
 */
function walkStaticDir(
  baseDir: string,
  currentDir: string,
  outputPrefix: string,
  exclude: Set<string> | undefined,
  files: RenderedFile[],
): void {
  const entries = readdirSync(currentDir);

  for (const entry of entries) {
    const fullPath = join(currentDir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walkStaticDir(baseDir, fullPath, outputPrefix, exclude, files);
    } else {
      const relFromBase = relative(baseDir, fullPath).replace(/\\/g, "/");
      if (exclude?.has(relFromBase)) continue;
      const outputPath = outputPrefix ? `${outputPrefix}${relFromBase}` : relFromBase;
      const content = readFileSync(fullPath, "utf-8");
      files.push({ relativePath: outputPath, content });
    }
  }
}
