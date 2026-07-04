import pc from "picocolors";

/**
 * Block-letter font glyphs. Each letter is 6 rows tall, ~6-7 chars wide.
 * Uses box-drawing characters (╔╗╚╝║═) for a clean terminal aesthetic.
 */
const FONT: Record<string, string[]> = {
  O: [" ████╗ ", "██╔═██╗", "██║ ██║", "██║ ██║", "╚████╔╝", " ╚══╝ "],
  u: ["      ", "██╗██╗", "██║██║", "██║██║", "╚███╔╝", " ╚══╝ "],
  t: ["      ", "█████╗", "╚██╔═╝", " ██║  ", " ██║  ", " ╚═╝  "],
  p: ["      ", "████╗ ", "██╔██╗", "████╔╝", "██╔══╝", "╚═╝   "],
  E: ["█████╗", "██╔══╝", "████╗ ", "██╔═╝ ", "█████╗", "╚════╝"],
  a: ["      ", " ███╗ ", "╔═██║ ", "████║ ", "╚═██╚╗", " ╚══╝ "],
  s: ["      ", "████╗ ", "██╔═╝ ", "╚███╗ ", "████╔╝", "╚═══╝ "],
  e: ["      ", " ███╗ ", "████║ ", "██╔═╝ ", "╚███╗ ", " ╚══╝ "],
};

const FONT_ROWS = 6;
const WIDE_THRESHOLD = 48;

/** 24-bit truecolor ANSI escape for exact brand hex values. */
const RESET = "\x1b[0m";
function rgb(r: number, g: number, b: number): (s: string) => string {
  return (s: string) => `\x1b[38;2;${r};${g};${b}m${s}${RESET}`;
}

/** Exact OutputEase brand colors via 24-bit truecolor. */
const lilac = rgb(169, 155, 249); // #A99BF9
const paleCyan = rgb(127, 216, 255); // #7FD8FF
const crayola = rgb(253, 212, 104); // #FDD468
const salmon = rgb(249, 176, 157); // #F9B09D
const wht = (s: string) => `\x1b[1;38;2;255;255;255m${s}${RESET}`;

function renderWord(word: string, colorFn: (s: string) => string): string[] {
  const rows: string[] = Array.from({ length: FONT_ROWS }, () => "");
  for (const ch of word) {
    const glyph = FONT[ch];
    if (!glyph) continue;
    for (let r = 0; r < FONT_ROWS; r++) rows[r] += `${colorFn(glyph[r]!)} `;
  }
  return rows;
}

function buildWideBanner(version?: string): string {
  const vStr = version ? ` v${version}` : "";
  const dots = `  ${crayola("●")} ${paleCyan("●")} ${salmon("●")} ${lilac("●")}`;
  const output = renderWord("Output", wht);
  const ease = renderWord("Ease", lilac);
  const label = `  ${pc.dim(`Toolkit${vStr}`)}`;

  return [...output.map((r) => `  ${r}`), ...ease.map((r) => `  ${r}`), dots, label].join("\n");
}

function buildNarrowBanner(version?: string): string {
  const vStr = version ? ` v${version}` : "";
  return `  ${lilac("◈")}  ${wht("Output")}${lilac("Ease")}  ${pc.dim(`Toolkit${vStr}`)}`;
}

export interface PrintBannerOptions {
  noBanner?: boolean;
  version?: string;
}

export function printBanner(opts: PrintBannerOptions = {}): void {
  if (opts.noBanner) return;
  if (process.env.NO_BANNER === "1") return;

  const cols = process.stdout.columns ?? 80;
  const banner =
    cols >= WIDE_THRESHOLD ? buildWideBanner(opts.version) : buildNarrowBanner(opts.version);

  console.log("");
  console.log(banner);
  console.log("");
}
