import { supportsTruecolor } from "./detect";

/**
 * OutputEase brand hex values. Mirrors `packages/brand/src/colors.ts` —
 * inlined here so the toolkit (MIT, open-source) stays decoupled from the
 * brand package. Keep these in sync with brand if those ever change.
 */
export const BRAND_HEX = {
  summerNight: "#241F44",
  lilac: "#A99BF9",
  paleCyan: "#7FD8FF",
  crayola: "#FDD468",
  salmon: "#F9B09D",
  white: "#FFFFFF",
} as const;

export type BrandKey = keyof typeof BRAND_HEX;

const RESET = "\x1b[0m";

export function fg(color: BrandKey, env: NodeJS.ProcessEnv = process.env): string {
  if (!supportsTruecolor(env)) {
    return "";
  }
  const [r, g, b] = hexToRgb(BRAND_HEX[color]);
  return `\x1b[38;2;${r};${g};${b}m`;
}

export function bg(color: BrandKey, env: NodeJS.ProcessEnv = process.env): string {
  if (!supportsTruecolor(env)) {
    return "";
  }
  const [r, g, b] = hexToRgb(BRAND_HEX[color]);
  return `\x1b[48;2;${r};${g};${b}m`;
}

export function paint(text: string, color: BrandKey, env: NodeJS.ProcessEnv = process.env): string {
  const open = fg(color, env);
  if (open === "") {
    return text;
  }
  return `${open}${text}${RESET}`;
}

/**
 * Semantic role → brand color mapping per contracts/cli-init-deltas.md.
 * - success → Pale Cyan
 * - selected → Lilac
 * - error → Salmon
 * - info → Crayola
 */
export const ROLE_TO_BRAND: Record<"success" | "selected" | "error" | "info", BrandKey> = {
  success: "paleCyan",
  selected: "lilac",
  error: "salmon",
  info: "crayola",
};

export function role(
  text: string,
  semantic: keyof typeof ROLE_TO_BRAND,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return paint(text, ROLE_TO_BRAND[semantic], env);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, "");
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return [r, g, b];
}
