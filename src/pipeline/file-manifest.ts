/**
 * Feature-flag-to-file manifest: the files associated with each optional
 * feature flag. Consumed by the shipped verify-setup.js (via `validate`) to
 * check that an enabled feature's required files are present.
 *
 * (The legacy prune phase that also used this to DELETE disabled-feature files
 * was removed in 0.2.0; the Eta scaffolder now ships docs/ wholesale.)
 */
export const FILE_MANIFEST: Record<string, string[]> = {
  has_frontend: [
    "docs/design.md",
    "docs/performance.md",
    "docs/infrastructure.md",
    ".claude/skills/a11y-review/SKILL.md",
    ".claude/skills/new-component/SKILL.md",
    ".claude/agents/accessibility-reviewer.md",
    ".claude/agents/i18n-reviewer.md",
  ],
  has_auth: ["docs/auth.md"],
  has_database: ["docs/database.md"],
  has_ci: ["docs/cicd.md"],
};
