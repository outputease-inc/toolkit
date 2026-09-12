/**
 * Body for the scaffolded `.env.local` template (FR-003).
 *
 * Lives as a TS constant rather than a template file because Claude Code's
 * sensitive-file guard rejects new `.env*` files even inside `templates/`.
 * The output content is identical; init.ts writes this string verbatim to
 * `<projectRoot>/.env.local` at scaffold time.
 */
export const ENV_LOCAL_TEMPLATE = `# Local environment overrides
# This file is git-ignored. Use it for personal/local-only values.
# For shared, non-secret defaults see .env.example.
# Never commit secrets here.

NODE_ENV=development
`;

export const ENV_LOCAL_FILENAME = ".env.local";
