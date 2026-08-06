#!/usr/bin/env node
/**
 * PreToolUse hook: Block edits to sensitive and generated files.
 * Prevents accidental modification of .env files and lock files.
 *
 * Exit codes:
 *   0 = allow the operation
 *   2 = block the operation (security violation, timeout, or unexpected error)
 */

const MAX_INPUT = 1 * 1024 * 1024; // 1 MB

let data = "";
const STDIN_TIMEOUT = setTimeout(() => {
  process.stderr.write("protect-sensitive: timed out reading input, blocking for safety\n");
  process.exit(2);
}, 4000);
process.stdin.on("data", (chunk) => {
  data += chunk;
  if (data.length > MAX_INPUT) {
    process.stderr.write("protect-sensitive: input too large, blocking for safety\n");
    clearTimeout(STDIN_TIMEOUT);
    process.exit(2);
  }
});
process.stdin.on("end", () => {
  clearTimeout(STDIN_TIMEOUT);
  try {
    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path;
    if (!filePath || typeof filePath !== "string") process.exit(0);

    const normalized = filePath.replace(/\\/g, "/");
    const fileName = normalized.split("/").pop();

    // Block .env files (except .env.example which is a safe template)
    if (/^\.env([._-]|$)/.test(fileName) && !/\.(example|sample|template)$/.test(fileName)) {
      process.stderr.write(
        `BLOCKED: Cannot edit ${fileName} - environment files contain secrets. ` +
          `Edit .env files manually outside Claude Code.`,
      );
      process.exit(2);
    }

    // Block lock files (generated, should not be manually edited)
    if (
      /^(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lock|bun\.lockb|Pipfile\.lock|poetry\.lock|uv\.lock|Cargo\.lock|go\.sum|Gemfile\.lock|composer\.lock)$/.test(
        fileName,
      )
    ) {
      process.stderr.write(
        `BLOCKED: Cannot edit ${fileName} - this is a generated lock file. ` +
          `Run package manager commands instead.`,
      );
      process.exit(2);
    }

    // Block cloud/infra credential and state files
    if (
      /\.(tfstate|tfstate\.backup|crt|cer)$/.test(fileName) ||
      /\/\.(aws|gcp|azure|docker|kube)\//.test(normalized)
    ) {
      process.stderr.write(
        `BLOCKED: Cannot edit ${fileName} - this file may contain cloud credentials or infrastructure state. ` +
          `Edit these files manually outside Claude Code.`,
      );
      process.exit(2);
    }

    // Block sensitive key/credential files
    if (
      /\.(pem|key|pfx|p12|secret|token|keystore|jks|gpg|asc)$/.test(fileName) ||
      /^(credentials\.json|\.npmrc|\.pypirc|\.htpasswd|\.netrc|id_rsa|id_ed25519|id_dsa|id_ecdsa|authorized_keys|known_hosts)$/.test(
        fileName,
      )
    ) {
      process.stderr.write(
        `BLOCKED: Cannot edit ${fileName} - this file may contain secrets or credentials. ` +
          `Edit sensitive files manually outside Claude Code.`,
      );
      process.exit(2);
    }

    // Block secrets/vault configuration files
    if (/^secrets\.(yaml|yml|json)$/.test(fileName) || /^vault\.(json|yaml|yml)$/.test(fileName)) {
      process.stderr.write(
        `BLOCKED: Cannot access ${fileName} - this file may contain secrets. ` +
          `Edit sensitive files manually outside Claude Code.`,
      );
      process.exit(2);
    }

    // Block access to sensitive directories
    if (/\/\.(ssh|credentials)\//.test(normalized) || /\/secrets\//.test(normalized)) {
      process.stderr.write(
        `BLOCKED: Cannot access files in sensitive directory. ` +
          `Edit files in sensitive directories manually outside Claude Code.`,
      );
      process.exit(2);
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      process.stderr.write("protect-sensitive: failed to parse input, blocking for safety\n");
      process.exit(2);
    } else {
      process.stderr.write(
        `protect-sensitive: unexpected error (${err.message}), blocking for safety\n`,
      );
      process.exit(2);
    }
  }
  process.exit(0);
});
