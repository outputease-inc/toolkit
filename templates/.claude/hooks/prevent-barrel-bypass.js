#!/usr/bin/env node
/**
 * PreToolUse hook: Detect imports that bypass barrel exports in monorepo packages.
 * Catches deep imports into package internals (e.g., @scope/ui/src/components/Button)
 * and relative path traversals into packages/ directories.
 *
 * The workspace scope is derived from the nearest package.json `name` (so it works in
 * any scoped monorepo, not just @outputease); an unscoped project skips the deep-import
 * check and keeps the scope-independent relative-traversal check.
 *
 * Exit codes:
 *   0 = allow (no violations or not applicable)
 *
 * Returns additionalContext with violations for Claude to self-correct.
 * Does NOT block — just warns, since the import may be intentional in rare cases.
 */

const fs = require("node:fs");
const path = require("node:path");

const MAX_INPUT = 10 * 1024; // 10 KB

// Relative traversal into a packages/ dir bypasses the scope import regardless of
// the workspace scope, so this pattern is scope-independent.
const RELATIVE_PACKAGES_RE = /(?:\.\.\/)+packages\//;

// Only check source files that can contain imports
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

/**
 * Derive the workspace package scope (e.g. "@outputease") by walking up from the
 * edited file to the nearest scoped package.json `name`. Returns null for an
 * unscoped project — the deep-import check is then skipped. Built-ins only; never throws.
 */
function deriveScope(filePath) {
  try {
    let dir = path.dirname(filePath);
    for (let i = 0; i < 25; i++) {
      const pkgPath = path.join(dir, "package.json");
      if (fs.existsSync(pkgPath)) {
        const name = JSON.parse(fs.readFileSync(pkgPath, "utf8")).name;
        if (typeof name === "string" && name.startsWith("@") && name.includes("/")) {
          return name.slice(0, name.indexOf("/")); // "@scope"
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // ignore — fall through to null (deep-import check skipped)
  }
  return null;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

    // Derive the workspace scope from the edited file's nearest package.json.
    // Null (unscoped project) disables the deep-import check; the relative check stays.
    const scope = deriveScope(filePath);
    const deepImportRe = scope ? new RegExp(`${escapeRegExp(scope)}/([^/]+)/src/`) : null;

    const violations = [];

    // Check each line for barrel-bypassing imports
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Only check import/require lines
      if (!line.startsWith("import ") && !line.startsWith("from ") && !line.includes("require(")) {
        continue;
      }

      if (deepImportRe) {
        const match = line.match(deepImportRe);
        if (match) {
          const pkg = match[1];
          violations.push(
            `Line ${i + 1}: Deep import into ${scope}/${pkg} internals. ` +
              `Use the barrel export from "${scope}/${pkg}" instead.`,
          );
        }
      }

      if (RELATIVE_PACKAGES_RE.test(line)) {
        violations.push(
          `Line ${i + 1}: Relative path traversal into packages/ directory. ` +
            `Use the ${scope ? `${scope}/*` : "package"} scope import instead.`,
        );
      }
    }

    if (violations.length > 0) {
      // Warn-only: surface the violation to the model via the supported
      // PreToolUse delivery path (hookSpecificOutput.additionalContext), matching
      // the Stop hooks. The deprecated top-level `decision: "approve"` form did NOT
      // deliver additionalContext and also force-approved the edit; this neither
      // blocks nor auto-approves, it just hands the model the warning.
      const result = {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          additionalContext:
            "WARNING: Barrel export bypass detected in the code being written:\n" +
            violations.join("\n") +
            "\n\nThis monorepo uses strict barrel exports. Import from the package scope " +
            (scope ? `(e.g., "${scope}/ui") ` : "") +
            "or declared sub-path exports (e.g., a package's exported `/client` entry), " +
            "never from internal src/ paths. Please fix these imports.",
        },
      };
      process.stdout.write(JSON.stringify(result));
    }
  } catch {
    // Non-blocking: if parsing fails, allow the operation
  }
  process.exit(0);
});
