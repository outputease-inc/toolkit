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
// the line or after one of COMMAND_START, blanks allowed either way, optionally behind one of
// RUNNERS) and only when followed by an argument or an input redirect. English words that happen
// to be verbs (`Move`, `Less`, `HEAD`) inside a commit message or a git revision are therefore
// not verbs, and a bare trailing pager (`ls x | head`) reads stdin, not a file. `xargs <verb>` is
// the one form where the verb legitimately ends the line. These three definitions are the
// command-position grammar for both the FILE_ACCESS gate and the operand scan in pathReadings,
// so the two cannot drift.
const READ_VERBS =
  "cat|type|gc|get-content|less|more|head|tail|cp|copy|copy-item|mv|move|move-item|scp|rsync|base64|xxd|hexdump|source";
const RUNNERS = "sudo|time|nice|env|command";
const COMMAND_START = "|;&({`\n";
// Where a command starts: the start of the text, blanks and newlines allowed, or a COMMAND_START
// character and then blanks. A newline is a command start itself, so a run of blanks and newlines
// is entered at its last newline; blanks that could span newlines were rescanned from every
// newline in the run, which was quadratic.
const AT_COMMAND = `(?:^\\s*|[${COMMAND_START}][^\\S\\n]*)`;
// One of xargs' dash flags. It may hold a command-start character (`-I{}`), but it may not END in
// one followed by `xargs`: that flag swallowed the next xargs command, so every xargs start
// rescanned the rest of the line (quadratic, and under bun the regex engine gave up and reported
// no match). Nothing is lost, because the swallowed `;xargs` is a command start of its own.
const XARGS_FLAG = `-(?!\\S*[${COMMAND_START.replace("\n", "")}]xargs\\s)\\S+`;
const FILE_ACCESS = new RegExp(
  `${AT_COMMAND}(?:(?:${RUNNERS})\\s+)?(?:${READ_VERBS})(?=\\s+\\S|<)` +
    `|${AT_COMMAND}xargs\\s+(?:${XARGS_FLAG}\\s+)*(?:${READ_VERBS})\\b` +
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
 * The command as every pattern reads it: a grep-style escaped dot after a word character restored
 * (`process\\.env` is the accessor, not a path), then Windows separators normalized to `/`.
 *
 * `\\.` after a word character is genuinely ambiguous: in `process\\.env` the backslash escapes a
 * regex dot, in `apps\\web\\.env` it is a path separator before a dotfile, and the two are
 * lexically identical. This reading takes the escape, so on its own it turns `apps\\web\\.env`
 * into `apps/web.env`, the dotenv pattern's left edge refuses it, and a backslash-spelled read of
 * a dotfile goes through (`.env`, `.ssh/`, `.aws/` alike). Normalizing `\\` first is not the fix:
 * it turns the accessor into `process/.env` and brings back the false positive the left edge
 * exists to prevent. Neither is the token's shape: guessing pattern or path from a token's other
 * escapes read `\\|`, `\\W` and `\\"` as separators, and restored `.\\.env` to `..env`. What
 * decides it is where the word stands in the command, which pathReadings reads.
 */
function normalizeCommand(text) {
  return text.replace(/(\w)\\\./g, "$1.").replace(/\\/g, "/");
}

/**
 * A line continuation as the path reading takes it: a backslash ending a line after a blank or an
 * operator (`cat -n \\`, `a &&\\`). One straight after a word is a Windows directory's trailing
 * separator (`Move-Item a D:\\logs\\`), because PowerShell and cmd have no backslash continuation,
 * and bash would glue the next line onto that word, not onto the read verb's operands; joining it
 * made the next line's grep pattern an operand. The command reading joins every backslash-newline,
 * as bash and main do, so a read split after a word (`cat x/.env\\` + `| head`) is still caught.
 */
const PATH_CONTINUATION = /(?<=^|[\s|&;(){}<>])\\\r?\n/g;

const READ_VERB_SET = new Set(READ_VERBS.split("|"));
const RUNNER_SET = new Set(RUNNERS.split("|"));
// Commands that can run a heredoc as a script: fed one, directly or down a pipe from the heredoc's
// own pipeline, each runs it when it takes its script from stdin (readShellWord decides).
const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh", "fish", "pwsh", "powershell", "ssh"]);
// Options whose value is the next word when they end their cluster. Wrongly counting a letter here
// hides an operand, so the heredoc stays a script and the error fails closed; missing one fails
// open. ssh's list is its whole set; the POSIX shells take `-o`/`-O`, fish `-C -d -f -o -p` too.
const SSH_VALUE_FLAGS = "BbcDEeFIiJLlmOoPpQRSWw";
const SHELL_VALUE_FLAGS = "oO";
const FISH_VALUE_FLAGS = "Cdfop";
const SHELL_VALUE_OPTIONS = new Set([
  "--rcfile",
  "--init-file",
  "--init-command",
  "--debug",
  "--debug-output",
  "--features",
  "--profile",
  "--profile-startup",
]);
// pwsh parameters whose value is the script itself: a file, a command string, an encoded command.
const PWSH_SCRIPT_PARAMETERS = new Set([
  "c",
  "command",
  "cwa",
  "commandwithargs",
  "e",
  "ec",
  "encodedcommand",
  "f",
  "file",
]);

/** Whether a command string runs a shell of its own, which may read stdin as a script. */
function namesShell(text) {
  return text
    .toLowerCase()
    .split(/[\s;&|()`]+/)
    .some((word) => SHELLS.has(word.slice(word.lastIndexOf("/") + 1)));
}

function settle(shell, stdin) {
  shell.stdin = stdin;
  shell.settled = true;
}

/**
 * Reads one operand of a shell's command line into `shell`, which starts out taking its script from
 * stdin (so a heredoc it is given is a script) and settles when an operand names the script
 * instead: a script file, a `-c` or `-Command` string, or an ssh remote command, each of which
 * leaves the heredoc as data for that script. `-s`, `-`, `-Command -` keep stdin, and so does a
 * command string or remote command that runs a shell itself (`ssh host bash -s`). pwsh's parameter
 * table is too wide to tell a parameter's value from its positional script, so a bare pwsh word
 * settles nothing.
 */
function readShellWord(shell, raw) {
  if (shell.settled) return;
  if (shell.value) {
    shell.value = false;
    return;
  }
  const word = raw.replace(/['"]/g, "");
  if (shell.command) {
    settle(shell, word === "-" || namesShell(word));
  } else if (shell.name === "ssh") {
    if (shell.remote) {
      if (namesShell(word)) settle(shell, true);
    } else if (!shell.optionsEnded && word.length > 1 && word[0] === "-") {
      if (word === "--") shell.optionsEnded = true;
      else {
        for (let k = 1; k < word.length; k++) {
          if (SSH_VALUE_FLAGS.includes(word[k])) {
            shell.value = k === word.length - 1;
            break;
          }
        }
      }
    } else if (!shell.destination) {
      shell.destination = true;
    } else {
      shell.remote = true;
      shell.stdin = false;
      if (namesShell(word)) settle(shell, true);
    }
  } else if (shell.name === "pwsh" || shell.name === "powershell") {
    const parameter = /^--?([a-z]+)(?::(.*))?$/i.exec(word);
    if (parameter && PWSH_SCRIPT_PARAMETERS.has(parameter[1].toLowerCase())) {
      if (parameter[2] === undefined) shell.command = true;
      else settle(shell, parameter[2] === "-" || namesShell(parameter[2]));
    }
  } else if (shell.optionsEnded || word.length < 2 || (word[0] !== "-" && word[0] !== "+")) {
    // `sh -` ends the options and keeps stdin; any other operand is the script file.
    if (!shell.optionsEnded && word === "-") shell.optionsEnded = true;
    else settle(shell, false);
  } else if (word === "--") {
    shell.optionsEnded = true;
  } else if (word.startsWith("--")) {
    const equals = word.indexOf("=");
    const name = equals === -1 ? word : word.slice(0, equals);
    if (name === "--command") {
      if (equals === -1) shell.command = true;
      else settle(shell, namesShell(word.slice(equals + 1)));
    } else if (equals === -1 && SHELL_VALUE_OPTIONS.has(name)) {
      shell.value = true;
    }
  } else if (word[0] === "-" && word.includes("s")) {
    settle(shell, true);
  } else {
    if (word[0] === "-" && word.includes("c")) shell.command = true;
    const valueFlags = shell.name === "fish" ? FISH_VALUE_FLAGS : SHELL_VALUE_FLAGS;
    for (const flag of valueFlags) if (word.includes(flag)) shell.value = true;
  }
}

/**
 * Whether the quote at `quote` opens a PowerShell here-string: it follows `@` and ends its line,
 * blanks aside, since PowerShell rejects a header with anything after it, so the rule stays
 * PowerShell's. The here-string closes at a `'@` or `"@` that starts a line.
 */
function opensHereString(text, quote) {
  if (text[quote - 1] !== "@") return false;
  let i = quote + 1;
  while (i < text.length && isBlank(text[i])) i++;
  return i === text.length || text[i] === "\n";
}

// A word ends at a blank, a redirect, a closing parenthesis, or a COMMAND_START character other
// than `{`: a brace inside a word is brace expansion or `xargs -I{}`, not a group.
const WORD_END = `<>)${COMMAND_START.replace("{", "")}`;

// Outside quotes, a backslash is read as escaping the next character only when that character
// would otherwise open or close quoting or substitution. Any other backslash stays in the word as
// it is: bash would consume it, but PowerShell and cmd read it as a separator, so `C:\\repo\\;`
// still ends at the `;`.
const QUOTING = "'\"`$\\";

function isBlank(c) {
  if (c === " " || c === "\t" || c === "\r" || c === "\v" || c === "\f") return true;
  return c > "\x7f" && /\s/.test(c);
}

/**
 * Where scanning resumes after the bodies of the heredocs opened on the line that just ended:
 * each body runs up to a line that is exactly its delimiter (leading tabs stripped for `<<-`, a
 * trailing `\r` tolerated), in the order the heredocs were opened. A body with no such line runs
 * to the end of the text, as it does in bash. When one of them is a script (a shell reads it,
 * directly or down its pipeline), no body is skipped: they are all scanned as commands, which fails
 * closed.
 */
function afterHeredocBodies(text, start, heredocs, script) {
  if (script) return start;
  let i = start;
  for (const { delimiter, stripTabs } of heredocs) {
    while (i < text.length) {
      const newline = text.indexOf("\n", i);
      const end = newline === -1 ? text.length : newline;
      let line = text.slice(i, end);
      i = end + 1;
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (stripTabs) line = line.replace(/^\t+/, "");
      if (line === delimiter) break;
    }
  }
  return Math.min(i, text.length);
}

/**
 * The PATH READING of every word that stands where a path goes, when it differs from the command
 * reading above. A read verb's operands are paths, every one of them, and so is an input
 * redirect's operand: `cat a.txt web\\.env`, `head -n 5 web\\.env`, `Get-Content -Path web\\.env`,
 * `sort < web\\.env`. Such a word is read with every `\\` a separator, IN ADDITION to the command
 * reading, never instead of it: bash strips the backslash from an unquoted `credentials\\.json`
 * and reads `credentials.json`, so either reading can name the file being read. The guard blocks
 * if either is a secret, and everything the command reading blocks stays blocked by construction.
 * A word anywhere else (a grep pattern, an echo argument) has only the command reading.
 *
 * Command position is FILE_ACCESS's, from the same definitions: a verb in any case at the start
 * of a command, behind at most one runner, or after `xargs` and its dash flags, plus the POSIX
 * dot-source. Quotes group a word, and so do ANSI-C `$'...'` strings and a backslash before a
 * quote, backtick, `$` or backslash; `(`, `$(`, `<(` and backticks nest and restore the enclosing
 * command when they close (`cat $(ls) web\\.env`), and a `$(` nests inside double quotes too, where
 * its own quotes do not close the outer ones; there a backtick escapes the next character as a
 * backslash does, since PowerShell reads it so (`"the 5`" screen"`); `{` groups only at command
 * position. Text is not commands: a comment, a bash here-string, a PowerShell `<# ... #>` block
 * comment and `@'...'@` here-string, and a heredoc's delimiter and body (a commit message or a
 * file being written, whose lines may start with `More` or `Less`). A PowerShell `@"..."@`
 * here-string is double-quoted text whose bare `"` closes nothing, and its `$(...)` still nests,
 * because PowerShell evaluates it. A heredoc's body is a script only when a shell reads its
 * script from stdin, given the heredoc directly (`bash <<EOF`, `ssh host <<EOF`) or down a pipe
 * from the heredoc's own pipeline (`cat <<EOF | bash`); a shell given a script file, a `-c`
 * string or a remote command reads the body as data, and so does one after `&&` or `;`. Reading
 * text as commands, or losing the quote state in it, turned an escaped grep pattern into an
 * operand. It is one left-to-right pass, because the backward search it replaces ran from every
 * whitespace position, went quadratic, and was killed by the 5 s hook timeout before it could block.
 *
 * Known false positives, accepted, both failing closed and visibly: a pager's search argument sits
 * in operand position, so `less +/'process\\.env'` blocks; and a pwsh positional word settles
 * nothing (readShellWord), so `pwsh x.ps1 <<EOF` reads its heredoc as a script. Known gaps: input
 * that reaches a verb through xargs (`echo web\\.env | xargs cat`) is not an operand; a runner with
 * flags or an assignment before the verb (`sudo -E cat`, `env A=1 cat`) is not a read on any
 * spelling, because FILE_ACCESS does not count it; an arithmetic shift (`$((1<<2))`) reads as a
 * heredoc whose body hides the lines after it; and a `@'` header typed into bash hides the lines
 * up to its `'@` from this reading, though bash would run them.
 */
function pathReadings(text) {
  const readings = [];
  const frames = [];
  // Where the scan stands in the current command: before its verb ("command"), between xargs
  // and its verb ("xargs"), among a read verb's words ("read"), or anywhere else ("other").
  let position = "command";
  let runner = false;
  // The current command's name once it is known (`bash`, `git`); a read verb does not set it. When
  // it is a shell, `shell` reads its operands (readShellWord) to settle where its script comes from.
  let command = null;
  let shell = null;
  // What the next word is: an input redirect's operand ("path"), an output redirect's target
  // ("target"), a heredoc delimiter ("heredoc"), a here-string ("text"), or an ordinary word (null).
  let redirect = null;
  let stripTabs = false;
  // Heredocs opened on the current line, each with the shell it was given if any; their bodies
  // start at the next newline.
  const heredocs = [];
  // Whether the current command reads the previous one's output through `|` or `|&`.
  let piped = false;
  // Whether a heredoc opened in the current pipeline, how many have opened in all (a group or
  // substitution that opened one feeds it to the pipeline it stands in), the `{` groups open, and
  // the shells piped into from a heredoc's pipeline on the current line (`cat <<EOF | bash`).
  let heredocInPipeline = false;
  let heredocsOpened = 0;
  const groups = [];
  const pipedShells = [];
  // The word being read, or null between words: where its current stretch of text starts, the
  // stretches before each `$(...)` inside its double quotes (the substitution's words are read on
  // their own, so a nest of them is read once, not once per level), whether the scan stands
  // inside its double quotes, and whether those are a PowerShell `@"..."@` here-string's.
  let word = null;

  // The substitution or group opened at `saved` has closed: a heredoc opened inside it is in the
  // pipeline it stands in, and otherwise that pipeline's state is what it was.
  function closeGroup(saved) {
    heredocInPipeline = saved.heredocInPipeline || heredocsOpened > saved.heredocsOpened;
  }

  // The word ends at `end`: record its path reading, heredoc delimiter or shell operand, and
  // whether it is the verb, runner or name that sets the command's position.
  function endWord(end) {
    const value = word.parts.join("") + text.slice(word.start, end);
    word = null;
    if (redirect === "heredoc") {
      const delimiter = value.replace(/['"\\]/g, "");
      if (delimiter) {
        heredocs.push({ delimiter, stripTabs, shell });
        heredocsOpened++;
        heredocInPipeline = true;
      }
    } else if (redirect === "path" || (position === "read" && redirect !== "text")) {
      if (/\w\\\./.test(value)) {
        // A trailing separator does not change the file a path names (`apps\\web\\.env\\`).
        const path = value.replace(/\\/g, "/");
        readings.push(path, path.replace(/\/+$/, ""));
      }
    } else if (redirect === null && position === "other" && shell !== null) {
      // A file descriptor before a redirect (`2>&1`) is not an operand.
      if (!(/^\d+$/.test(value) && (text[end] === "<" || text[end] === ">"))) {
        readShellWord(shell, value);
      }
    }
    if (redirect === null && (position === "command" || position === "xargs")) {
      const verb = value.toLowerCase();
      if (position === "xargs" && verb.length > 1 && verb.startsWith("-")) {
        // one of xargs' own flags
      } else if (READ_VERB_SET.has(verb) || (position === "command" && verb === ".")) {
        position = "read";
      } else if (position === "command" && !runner && RUNNER_SET.has(verb)) {
        runner = true;
      } else if (position === "command" && !runner && verb === "xargs") {
        position = "xargs";
      } else {
        if (position === "command") {
          if (verb === "}" && groups.length > 0) closeGroup(groups.pop());
          command = verb.slice(verb.lastIndexOf("/") + 1);
          shell = SHELLS.has(command) ? { name: command, stdin: true } : null;
          if (shell !== null && piped && heredocInPipeline) pipedShells.push(shell);
        }
        position = "other";
      }
    }
    redirect = null;
  }

  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (word?.quoted) {
      // Inside a word's double quotes. A `$(` there nests a command whose own quotes do not close
      // these, so the word is set aside until the `)` that closes it. A backtick is not nested
      // here: inside PowerShell's double quotes it is an escape (`"a`nb"`), so it skips the next
      // character as a backslash does. Only a `"@` that starts a line closes a here-string.
      if (c === '"' && (!word.hereString || (text[i - 1] === "\n" && text[i + 1] === "@"))) {
        i += word.hereString ? 2 : 1;
        word.quoted = false;
        word.hereString = false;
      } else if (c === "$" && text[i + 1] === "(") {
        word.parts.push(text.slice(word.start, i));
        frames.push({
          closer: ")",
          position,
          runner,
          command,
          shell,
          redirect,
          word,
          heredocInPipeline,
          heredocsOpened,
        });
        position = "command";
        runner = false;
        command = null;
        shell = null;
        redirect = null;
        word = null;
        i += 2;
      } else {
        i += c === "\\" || c === "`" ? 2 : 1;
      }
    } else if (word !== null) {
      if (isBlank(c) || WORD_END.includes(c)) {
        endWord(i);
      } else if (c === "'") {
        // A single-quoted string, or a PowerShell `@'...'@` here-string, whose apostrophes are text.
        const [closer, after] = opensHereString(text, i) ? ["\n'@", 3] : ["'", 1];
        const close = text.indexOf(closer, i + 1);
        i = close === -1 ? text.length : close + after;
      } else if (c === "$" && text[i + 1] === "'") {
        // ANSI-C quoting: a backslash escapes inside it, so `$'it\\'s'` is one string.
        i += 2;
        while (i < text.length && text[i] !== "'") i += text[i] === "\\" ? 2 : 1;
        i = Math.min(i + 1, text.length);
      } else if (c === '"') {
        word.quoted = true;
        word.hereString = opensHereString(text, i);
        i++;
      } else if (c === "\\" && i + 1 < text.length && QUOTING.includes(text[i + 1])) {
        i += 2;
      } else {
        i++;
      }
    } else if (c === "(" || (c === "`" && frames.at(-1)?.closer !== "`")) {
      frames.push({
        closer: c === "(" ? ")" : "`",
        position,
        command,
        shell,
        heredocInPipeline,
        heredocsOpened,
      });
      position = "command";
      runner = false;
      command = null;
      shell = null;
      redirect = null;
      i++;
    } else if (c === "`" || c === ")") {
      const frame = frames.at(-1)?.closer === c ? frames.pop() : null;
      if (frame?.word) {
        // The substitution closed; the word it sat in resumes inside its double quotes.
        ({ position, runner, command, shell, redirect, word } = frame);
        word.start = i + 1;
      } else {
        // A nested command that stood in command position was that command.
        position = !frame || frame.position === "command" ? "other" : frame.position;
        command = frame ? frame.command : null;
        shell = frame ? frame.shell : null;
        redirect = null;
      }
      if (frame) closeGroup(frame);
      i++;
    } else if (c === "&" && text[i + 1] === ">") {
      i += text[i + 2] === ">" ? 3 : 2;
      redirect = "target";
    } else if (COMMAND_START.includes(c) && (c !== "{" || position === "command")) {
      position = "command";
      runner = false;
      command = null;
      shell = null;
      redirect = null;
      // `|` and `|&` pipe into the next command; `||`, `;`, `&` and a newline end the pipeline, so
      // a shell after them does not read a heredoc opened before them. A `{` opens a group inside
      // the same pipe stage.
      const pair = c === "|" && (text[i + 1] === "|" || text[i + 1] === "&");
      if (c === "{") {
        groups.push({ heredocInPipeline, heredocsOpened });
      } else {
        piped = c === "|" && text[i + 1] !== "|";
        if (!piped) heredocInPipeline = false;
      }
      if (c === "\n") {
        // A heredoc body is data, not commands, unless a shell reads it: a commit message line
        // that starts with `More` or `Less` is prose, not a read.
        const script =
          heredocs.some((heredoc) => heredoc.shell?.stdin) ||
          pipedShells.some((pipedShell) => pipedShell.stdin);
        pipedShells.length = 0;
        i = afterHeredocBodies(text, i + 1, heredocs.splice(0), script);
      } else {
        i += pair ? 2 : 1;
      }
    } else if (c === "<") {
      if (text[i + 1] === "<" && text[i + 2] === "<") {
        i += 3;
        redirect = "text";
      } else if (text[i + 1] === "<") {
        stripTabs = text[i + 2] === "-";
        i += stripTabs ? 3 : 2;
        redirect = "heredoc";
      } else if (text[i + 1] === "#") {
        // A PowerShell block comment runs to `#>`. In bash `<#` is a syntax error, so nothing runs.
        const close = text.indexOf("#>", i + 2);
        i = close === -1 ? text.length : close + 2;
      } else {
        i += text[i + 1] === "&" || text[i + 1] === ">" ? 2 : 1;
        redirect = "path";
      }
    } else if (c === ">") {
      i++;
      if (text[i] === ">") i++;
      if (text[i] === "&" || text[i] === "|") i++;
      redirect = "target";
    } else if (isBlank(c)) {
      i++;
    } else if (c === "#") {
      // A comment runs to the end of its line; an apostrophe in it opens nothing.
      const newline = text.indexOf("\n", i);
      i = newline === -1 ? text.length : newline;
    } else {
      // A word starts here; the branch above reads it from this character on.
      word = { start: i, parts: [], quoted: false };
    }
  }
  if (word !== null) endWord(text.length);
  return readings;
}

/** Returns a block reason when the command reads a sensitive file or directory, else null. */
function scan(command) {
  // A read split across lines by a shell line continuation is one read. The path reading joins
  // fewer lines than this (PATH_CONTINUATION says which).
  const text = command.replace(/\\\r?\n/g, " ");
  const normalized = normalizeCommand(text);
  if (!FILE_ACCESS.test(normalized)) return null;
  // Each path reading on a line of its own: a newline is in every pattern's edge classes, so
  // each line reads as its word would alone and no match spans two of them.
  const readings = [normalized, ...pathReadings(command.replace(PATH_CONTINUATION, " "))].join("\n");
  if (SENSITIVE_FILES.some((pattern) => pattern.test(readings))) {
    return "BLOCKED: Bash command references a sensitive file pattern. Access sensitive files manually outside Claude Code.";
  }
  if (SENSITIVE_DIRS.some((pattern) => pattern.test(readings))) {
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
