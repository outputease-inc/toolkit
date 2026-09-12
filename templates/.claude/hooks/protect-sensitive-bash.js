#!/usr/bin/env node
/**
 * PreToolUse hook: block Bash commands that read, copy, or output sensitive
 * file contents. Companion to protect-sensitive.js (which guards Edit/Write/Read).
 *
 * Input handling:
 *   - Commands up to 1 MB are parsed and scanned. No real command approaches that
 *     size, so the cap no longer refuses long heredocs or generated scripts the
 *     way a 10 KB cap did.
 *   - Above 1 MB, on a stdin timeout, or when the payload does not parse, the hook
 *     BLOCKS: an unread or unparsed command cannot be scanned, and allowing would
 *     let a padded or truncated payload carry an unscanned read at its tail.
 *   - stdin is decoded as UTF-8 up front so a multi-byte character straddling a
 *     pipe chunk cannot decode to U+FFFD and defeat a pattern.
 *
 * Exit codes: 0 = allow, 2 = block.
 */

const MAX_INPUT = 1024 * 1024; // 1 MB of UTF-16 units, about 1 MB of ASCII

// Threat model, stated once: this guard is a tripwire for accidental and habitual reads of
// secret files by an agent that is following the rule. It is not hardened against deliberate
// evasion (`c\at`, encoded paths, tools it does not list); the rule itself is agent discipline
// and the Read/Edit/Write guard is the sibling control. Every widening here trades a false
// positive for a bypass, so the shape is deliberate and each edge below has a test.

// Read verbs, POSIX plus the PowerShell/cmd forms, matched only at COMMAND POSITION (start of
// the line, after `|`, `;`, `&`, `(`, `{`, a backtick or a newline, optionally behind sudo/time/
// nice/env) and only when followed by an argument or an input redirect. English words that
// happen to be verbs (`Move`, `Less`, `HEAD`) inside a commit message or a git revision are
// therefore not verbs, and a bare trailing pager (`ls x | head`) reads stdin, not a file.
// `xargs <verb>` is the one form where the verb legitimately ends the line.
const READ_VERBS =
  "cat|type|gc|get-content|less|more|head|tail|cp|copy|copy-item|mv|move|move-item|scp|rsync|base64|xxd|hexdump|source";
const FILE_ACCESS = new RegExp(
  `(?:^|[|;&({\`\\n]\\s*)(?:(?:sudo|time|nice|env|command)\\s+)?(?:${READ_VERBS})(?=\\s+\\S|<)` +
    `|(?:^|[|;&({\`\\n]\\s*)xargs\\s+(?:-\\S+\\s+)*(?:${READ_VERBS})\\b` +
    "|(?:^|\\s)\\.\\s",
  "i",
);

// Sensitive file patterns, all case-insensitive (`SERVER.PEM`, `ID_RSA`).
//
// The dotenv pattern is anchored on its LEFT edge (spec 010, finding H5): a dotenv
// file is preceded by nothing, a path separator, whitespace, a quote, `=`/`:`, or a
// shell metacharacter that starts a token (`<`, `(`, `{`, `,`, `|`, `;`, `&`, a backtick),
// never by a word character. `process.env` is, and so is every accessor of that
// shape (`import.meta.env`, `Bun.env`, `Deno.env`), so an unanchored pattern refused
// any pipeline that printed an environment variable and also touched a file.
// Its RIGHT edge accepts the metacharacters that end a token, including the glob and
// brace characters bash expands (`<dotenv>*`, `<dotenv>{,.local}`, `<dotenv>~`), so
// `cat <dotenv>|head` and `cat <dotenv>*` are reads, not escapes. `.example`, `.sample`
// and `.template` variants are documentation, not secrets; the carve-out spans name
// characters only, so a redirect target ending in `.template` is still a read.
const ENV_FILE =
  /(^|[/"'\s:=<({,|;&`])\.env(?!(?:[A-Za-z0-9._-]*)\.(?:example|sample|template)(?:$|["'\s|;&><),}{*?\[~`]))(?:[._-]|$|["'\s|;&><),}{*?\[~`])/i;

const SENSITIVE_FILES = [
  ENV_FILE,
  /\.(pem|key|pfx|p12|secret|token)\b/i,
  /\.(keystore|jks|gpg|asc)\b/i,
  /\.(tfstate|tfstate\.backup)\b/i,
  /\.(crt|cer)\b/i,
  /\bid_rsa\b/i,
  /\bid_ed25519\b/i,
  /\bid_dsa\b/i,
  /\bid_ecdsa\b/i,
  /\bcredentials\.json\b/i,
  /\.(npmrc|pypirc)\b/i,
  /\.htpasswd\b/i,
  /\.netrc\b/i,
  /\bsecrets\.(yaml|yml|json)\b/i,
  /\bvault\.(json|yaml|yml)\b/i,
  /\bauthorized_keys\b/i,
  /\bknown_hosts\b/i,
];

// Sensitive directory patterns. Same left edge as the dotenv pattern, so a RELATIVE path
// (`cat .ssh/config`, `tail secrets/prod.yaml`, `cd ~ && base64 .aws/credentials`) is
// caught, not only one that starts with `/` or `~/`.
const SENSITIVE_DIRS = [
  /(^|[/"'\s:=<({,|;&`])\.(ssh|credentials)\//i,
  /(^|[/"'\s:=<({,|;&`])secrets\//i,
  /(^|[/"'\s:=<({,|;&`])\.(aws|gcp|azure|docker|kube)\//i,
];

/**
 * One text for every pattern: shell line continuations joined (a read split across lines is
 * one read), a grep-style escaped dot after a word character restored (`process\\.env` is
 * the accessor, not a path), then Windows separators normalized to `/`.
 */
function normalizeCommand(command) {
  return command
    .replace(/\\\r?\n/g, " ")
    .replace(/(\w)\\\./g, "$1.")
    .replace(/\\/g, "/");
}

/** Returns a block reason when the command reads a sensitive file or directory, else null. */
function scan(command) {
  const normalized = normalizeCommand(command);
  if (!FILE_ACCESS.test(normalized)) return null;
  if (SENSITIVE_FILES.some((pattern) => pattern.test(normalized))) {
    return "BLOCKED: Bash command references a sensitive file pattern. Access sensitive files manually outside Claude Code.";
  }
  if (SENSITIVE_DIRS.some((pattern) => pattern.test(normalized))) {
    return "BLOCKED: Bash command accesses a sensitive directory. Access sensitive directories manually outside Claude Code.";
  }
  return null;
}

function block(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

let data = "";
const STDIN_TIMEOUT = setTimeout(() => {
  block("protect-sensitive-bash: timed out reading input, blocking (an unread command cannot be scanned)");
}, 4000);

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  data += chunk;
  if (data.length > MAX_INPUT) {
    clearTimeout(STDIN_TIMEOUT);
    block("protect-sensitive-bash: input too large, blocking (an oversized command cannot be scanned)");
  }
});

process.stdin.on("end", () => {
  clearTimeout(STDIN_TIMEOUT);
  let command;
  try {
    const input = JSON.parse(data);
    command = input.tool_input?.command;
  } catch (err) {
    block(
      `protect-sensitive-bash: failed to parse input (${err instanceof Error ? err.message : String(err)}), blocking (an unparsed command cannot be scanned)`,
    );
  }
  if (!command || typeof command !== "string") process.exit(0);
  const reason = scan(command);
  if (reason) block(reason);
  process.exit(0);
});
