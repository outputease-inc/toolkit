#!/usr/bin/env node
/**
 * PreToolUse hook: Block Bash commands that access sensitive files.
 * Companion to protect-sensitive.js (which guards Edit/Write/Read).
 *
 * This is defense-in-depth — regex-based command parsing cannot catch all
 * obfuscation (e.g., eval, variable expansion, subshells). It blocks the
 * most common patterns.
 *
 * Exit codes:
 *   0 = allow the operation
 *   2 = block the operation (security violation, timeout, or unexpected error)
 */

const MAX_INPUT = 10 * 1024; // 10 KB

let data = '';
const STDIN_TIMEOUT = setTimeout(() => {
  process.stderr.write('protect-sensitive-bash: timed out reading input, blocking for safety\n');
  process.exit(2);
}, 4000);

process.stdin.on('data', (chunk) => {
  data += chunk;
  if (data.length > MAX_INPUT) {
    process.stderr.write('protect-sensitive-bash: input too large, blocking for safety\n');
    clearTimeout(STDIN_TIMEOUT);
    process.exit(2);
  }
});

process.stdin.on('end', () => {
  clearTimeout(STDIN_TIMEOUT);
  try {
    const input = JSON.parse(data);
    const command = input.tool_input?.command;
    if (!command || typeof command !== 'string') process.exit(0);

    // Commands that read, copy, or output file contents. The POSIX dot-source
    // form (`. file`) needs a start/space boundary, not \b — a bare `.` is not a
    // word char, so `\b\.` never matched `. .env` even though longhand `source`
    // did. Split into a word-command branch and a dot-source branch.
    const FILE_ACCESS = /\b(cat|less|more|head|tail|cp|mv|scp|rsync|base64|xxd|hexdump|source)\s|(^|\s)\.\s/;
    if (!FILE_ACCESS.test(command)) process.exit(0);

    const normalized = command.replace(/\\/g, '/');

    // Sensitive file patterns
    const SENSITIVE_FILES = [
      /\.env(?:[._-]|$|["'\s])/,
      /\.(pem|key|pfx|p12|secret|token)\b/,
      /\.(keystore|jks|gpg|asc)\b/,
      /\.(tfstate|tfstate\.backup)\b/,
      /\.(crt|cer)\b/,
      /\bid_rsa\b/, /\bid_ed25519\b/, /\bid_dsa\b/, /\bid_ecdsa\b/,
      /\bcredentials\.json\b/,
      /\.(npmrc|pypirc)\b/,
      /\.htpasswd\b/, /\.netrc\b/,
      /\bsecrets\.(yaml|yml|json)\b/,
      /\bvault\.(json|yaml|yml)\b/,
      /\bauthorized_keys\b/, /\bknown_hosts\b/,
    ];

    // Sensitive directory patterns
    const SENSITIVE_DIRS = [
      /\/\.(ssh|credentials)\//,
      /\/secrets\//,
      /\/\.(aws|gcp|azure|docker|kube)\//,
    ];

    for (const pattern of SENSITIVE_FILES) {
      if (pattern.test(normalized)) {
        process.stderr.write(
          'BLOCKED: Bash command references a sensitive file pattern. ' +
            'Access sensitive files manually outside Claude Code.\n'
        );
        process.exit(2);
      }
    }

    for (const pattern of SENSITIVE_DIRS) {
      if (pattern.test(normalized)) {
        process.stderr.write(
          'BLOCKED: Bash command accesses a sensitive directory. ' +
            'Access sensitive directories manually outside Claude Code.\n'
        );
        process.exit(2);
      }
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      process.stderr.write('protect-sensitive-bash: failed to parse input, blocking for safety\n');
      process.exit(2);
    } else {
      process.stderr.write(`protect-sensitive-bash: unexpected error (${err.message}), blocking for safety\n`);
      process.exit(2);
    }
  }
  process.exit(0);
});
