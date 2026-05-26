import { describe, expect, it } from "bun:test";
import { collectStaticFiles, deduplicateFiles, type RenderedFile } from "./renderer";

describe("collectStaticFiles", () => {
  it("reads files from the root template directory", () => {
    const files = collectStaticFiles([{ sourceDir: "root", outputPrefix: "" }]);

    expect(files.length).toBeGreaterThan(0);
    const paths = files.map((f) => f.relativePath);
    // Files that remain truly static (no CLI-resolvable placeholders).
    // README.md / CHANGELOG.md / CONTRIBUTING.md / SECURITY.md / INDEX.md / CLAUDE.md
    // are now scaffolded via .eta templates in templates/scaffolding/root/.
    expect(paths).toContain("TODO.md");
    expect(paths).toContain("HANDOFF.md");
    expect(paths).toContain("SETUP.md");
    expect(paths).toContain("LICENSE");
  });

  it("reads files from the docs template directory with prefix", () => {
    const files = collectStaticFiles([{ sourceDir: "docs", outputPrefix: "docs/" }]);

    expect(files.length).toBeGreaterThan(0);
    const paths = files.map((f) => f.relativePath);
    expect(paths).toContain("docs/architecture.md");
    expect(paths).toContain("docs/testing.md");
    expect(paths).toContain("docs/workflow.md");
    expect(paths).toContain("docs/api.md");
  });

  it("reads files from the claude template directory with .claude/ prefix", () => {
    const files = collectStaticFiles([{ sourceDir: ".claude", outputPrefix: ".claude/" }]);

    expect(files.length).toBeGreaterThan(0);
    const paths = files.map((f) => f.relativePath);
    expect(paths).toContain(".claude/commands/quickstart.md");
    expect(paths).toContain(".claude/agents/test-writer.md");
    expect(paths).toContain(".claude/skills/INDEX.md");
    expect(paths).toContain(".claude/docs/AGENTS-INDEX.md");
  });

  it("reads from multiple groups in one call", () => {
    const files = collectStaticFiles([
      { sourceDir: "root", outputPrefix: "" },
      { sourceDir: "docs", outputPrefix: "docs/" },
    ]);

    const paths = files.map((f) => f.relativePath);
    expect(paths).toContain("TODO.md");
    expect(paths).toContain("docs/architecture.md");
  });

  it("skips non-existent directories gracefully", () => {
    const files = collectStaticFiles([{ sourceDir: "nonexistent-dir", outputPrefix: "" }]);
    expect(files).toEqual([]);
  });

  it("respects the exclude option", () => {
    const files = collectStaticFiles([
      { sourceDir: "root", outputPrefix: "", exclude: new Set(["LICENSE"]) },
    ]);

    const paths = files.map((f) => f.relativePath);
    expect(paths).not.toContain("LICENSE");
    expect(paths).toContain("TODO.md");
  });

  it("recursively walks nested directories", () => {
    const files = collectStaticFiles([{ sourceDir: ".claude", outputPrefix: ".claude/" }]);

    const paths = files.map((f) => f.relativePath);
    // Verify files from nested subdirectories
    const commandFiles = paths.filter((p) => p.startsWith(".claude/commands/"));
    const agentFiles = paths.filter((p) => p.startsWith(".claude/agents/"));
    expect(commandFiles.length).toBeGreaterThan(0);
    expect(agentFiles.length).toBeGreaterThan(0);
  });
});

describe("deduplicateFiles", () => {
  it("returns all files when no overlap", () => {
    const rendered: RenderedFile[] = [{ relativePath: "a.md", content: "rendered" }];
    const staticFiles: RenderedFile[] = [{ relativePath: "b.md", content: "static" }];

    const result = deduplicateFiles(rendered, staticFiles);
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.relativePath)).toEqual(["a.md", "b.md"]);
  });

  it("drops static files when rendered file has the same path", () => {
    const rendered: RenderedFile[] = [{ relativePath: "README.md", content: "dynamic" }];
    const staticFiles: RenderedFile[] = [{ relativePath: "README.md", content: "static" }];

    const result = deduplicateFiles(rendered, staticFiles);
    expect(result).toHaveLength(1);
    expect(result[0]?.content).toBe("dynamic");
  });

  it("preserves order: rendered first, then unique static", () => {
    const rendered: RenderedFile[] = [
      { relativePath: "a.md", content: "ra" },
      { relativePath: "b.md", content: "rb" },
    ];
    const staticFiles: RenderedFile[] = [
      { relativePath: "b.md", content: "sb" },
      { relativePath: "c.md", content: "sc" },
    ];

    const result = deduplicateFiles(rendered, staticFiles);
    expect(result.map((f) => f.relativePath)).toEqual(["a.md", "b.md", "c.md"]);
    expect(result[1]?.content).toBe("rb"); // rendered wins
  });

  it("handles empty rendered array", () => {
    const staticFiles: RenderedFile[] = [{ relativePath: "a.md", content: "static" }];
    const result = deduplicateFiles([], staticFiles);
    expect(result).toEqual(staticFiles);
  });

  it("handles empty static array", () => {
    const rendered: RenderedFile[] = [{ relativePath: "a.md", content: "rendered" }];
    const result = deduplicateFiles(rendered, []);
    expect(result).toEqual(rendered);
  });
});
