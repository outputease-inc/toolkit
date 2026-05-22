#!/usr/bin/env node
/**
 * PreToolUse hook: Detect imports that bypass barrel exports in monorepo packages.
 * Catches deep imports into package internals (e.g., @outputease/ui/src/components/Button)
 * and relative path traversals into packages/ directories.
 *
 * Exit codes:
 *   0 = allow (no violations or not applicable)
 *
 * Returns additionalContext with violations for Claude to self-correct.
 * Does NOT block — just warns, since the import may be intentional in rare cases.
 */

const MAX_INPUT = 10 * 1024; // 10 KB

// Patterns that indicate barrel bypass
const DEEP_IMPORT_RE = /@outputease\/[^/]+\/src\//;
const RELATIVE_PACKAGES_RE = /(?:\.\.\/)+packages\//;

// Only check source files that can contain imports
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

let data = "";
const STDIN_TIMEOUT = setTimeout(() => {
  process.exit(0);
}, 4000);

process.stdin.on("data", (chunk) => {
  data += chunk;
  if (data.length > MAX_INPUT) {
    clearTimeout(STDIN_TIMEOUT);
    process.exit(0);
  }
});

process.stdin.on("end", () => {
  clearTimeout(STDIN_TIMEOUT);
  try {
    const input = JSON.parse(data);

    // Get the file path being edited/written
    const filePath = input.tool_input?.file_path;
    if (!filePath || typeof filePath !== "string") process.exit(0);

    const normalized = filePath.replace(/\\/g, "/");

    // Only check source files
    const lastDot = normalized.lastIndexOf(".");
    if (lastDot === -1) process.exit(0);
    const ext = normalized.substring(lastDot).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(ext)) process.exit(0);

    // Get the content being written. For Edit, check new_string. For Write, check content.
    const content = input.tool_input?.content || input.tool_input?.new_string || "";
    if (!content || typeof content !== "string") process.exit(0);

    const violations = [];

    // Check each line for barrel-bypassing imports
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Only check import/require lines
      if (!line.startsWith("import ") && !line.startsWith("from ") && !line.includes("require(")) {
        continue;
      }

      if (DEEP_IMPORT_RE.test(line)) {
        // Extract the package name for a helpful message
        const match = line.match(/@outputease\/([^/]+)\/src\//);
        const pkg = match ? match[1] : "unknown";
        violations.push(
          `Line ${i + 1}: Deep import into @outputease/${pkg} internals. ` +
            `Use the barrel export from "@outputease/${pkg}" instead.`,
        );
      }

      if (RELATIVE_PACKAGES_RE.test(line)) {
        violations.push(
          `Line ${i + 1}: Relative path traversal into packages/ directory. ` +
            `Use the @outputease/* scope import instead.`,
        );
      }
    }

    if (violations.length > 0) {
      const result = {
        decision: "approve",
        additionalContext:
          "WARNING: Barrel export bypass detected in the code being written:\n" +
          violations.join("\n") +
          "\n\nThis monorepo uses strict barrel exports. Import from the package scope " +
          '(e.g., "@outputease/ui") or declared sub-path exports ' +
          '(e.g., "@outputease/db/client"), never from internal src/ paths. ' +
          "Please fix these imports.",
      };
      process.stdout.write(JSON.stringify(result));
    }
  } catch {
    // Non-blocking: if parsing fails, allow the operation
  }
  process.exit(0);
});
