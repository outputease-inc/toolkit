/**
 * Detect whether the current terminal supports 24-bit truecolor.
 * Detection order per research R4:
 *   1. NO_COLOR set (any value) → false
 *   2. COLORTERM includes "truecolor" or "24bit" → true
 *   3. TERM matches known truecolor terminal pattern → true
 *   4. Else → false
 */
const TRUECOLOR_TERM_RE = /^(xterm-kitty|alacritty|wezterm|iterm2)/;

export function supportsTruecolor(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") {
    return false;
  }
  const colorterm = env.COLORTERM ?? "";
  if (colorterm.includes("truecolor") || colorterm.includes("24bit")) {
    return true;
  }
  const term = env.TERM ?? "";
  if (TRUECOLOR_TERM_RE.test(term)) {
    return true;
  }
  return false;
}
