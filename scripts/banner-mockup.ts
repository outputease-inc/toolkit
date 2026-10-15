#!/usr/bin/env bun
// Banner mockup v2 — block-letter "OutputEase" + brand color accents
// Run: bun run packages/toolkit/scripts/banner-mockup.ts
import pc from "picocolors";

const L = (s: string) => pc.magentaBright(s);
const C = (s: string) => pc.cyanBright(s);
const Y = (s: string) => pc.yellowBright(s);
const S = (s: string) => pc.redBright(s);
const W = (s: string) => pc.bold(pc.white(s));

function hdr(t: string, d: string) {
  console.log(`\n${pc.dim("━".repeat(70))}\n  ${pc.bold(C(t))}\n  ${pc.dim(d)}\n${pc.dim("━".repeat(70))}\n`);
}
function clack() {
  console.log(`  ${pc.gray("│")}\n  ${pc.gray("◆")}  What type of project?\n  ${pc.gray("│")}  ${C("●")} Web App   ${pc.dim("○")} CLI Tool\n  ${pc.gray("└")}\n`);
}
function ctx(fn: () => void) {
  console.log(pc.dim("  ┌─ In context ──────────────────────────────────────────────────┐"));
  fn();
  console.log(`  ${pc.gray("◇")}  ${pc.inverse(" OutputEase Toolkit ")}`);
  clack();
  console.log(pc.dim("  └──────────────────────────────────────────────────────────────┘\n"));
}

// Block-letter font: each letter is an array of 6 rows
// Using ██ style block chars, ~7-9 chars wide per letter
const FONT: Record<string, string[]> = {
  O: [" ████╗ ","██╔═██╗","██║ ██║","██║ ██║","╚████╔╝"," ╚══╝ "],
  u: ["      ","██╗██╗","██║██║","██║██║","╚███╔╝"," ╚══╝ "],
  t: ["      ","█████╗","╚██╔═╝"," ██║  "," ██║  "," ╚═╝  "],
  p: ["      ","████╗ ","██╔██╗","████╔╝","██╔══╝","╚═╝   "],
  E: ["█████╗","██╔══╝","████╗ ","██╔═╝ ","█████╗","╚════╝"],
  a: ["      "," ███╗ ","╔═██║ ","████║ ","╚═██╚╗"," ╚══╝ "],
  s: ["      ","████╗ ","██╔═╝ ","╚███╗ ","████╔╝","╚═══╝ "],
  e: ["      "," ███╗ ","████║ ","██╔═╝ ","╚███╗ "," ╚══╝ "],
};

function renderWord(word: string, colorFn: (s: string) => string): string[] {
  const rows: string[] = ["","","","","",""];
  for (const ch of word) {
    const glyph = FONT[ch];
    if (!glyph) continue;
    for (let r = 0; r < 6; r++) rows[r] += colorFn(glyph[r]!) + " ";
  }
  return rows;
}

// ── F1: Full "OutputEase" block text, single line, brand bar above ──
function optF1() {
  hdr("F1 — Full Block Letters (one line)", "~72 cols, 6 rows + accent bar");
  const draw = () => {
    const bar = `  ${Y("██")}${C("██")}${S("██")}${L("██")}`;
    console.log(bar);
    const rows: string[] = ["","","","","",""];
    for (const ch of "Output") {
      const g = FONT[ch]; if (!g) continue;
      for (let r = 0; r < 6; r++) rows[r] += W(g[r]!) + " ";
    }
    for (const ch of "Ease") {
      const g = FONT[ch]; if (!g) continue;
      for (let r = 0; r < 6; r++) rows[r] += L(g[r]!) + " ";
    }
    for (const row of rows) console.log(`  ${row}`);
    console.log(`  ${pc.dim("Toolkit v0.0.1")}\n`);
  };
  draw();
  ctx(draw);
}

// ── F2: Stacked "Output" over "Ease", brand dots as separator ──
function optF2() {
  hdr("F2 — Stacked (Output / Ease)", "~48 cols, 13 rows + brand separator");
  const draw = () => {
    const output = renderWord("Output", W);
    for (const row of output) console.log(`  ${row}`);
    console.log(`  ${Y("●")} ${C("●")} ${S("●")} ${L("●")}`);
    const ease = renderWord("Ease", L);
    for (const row of ease) console.log(`  ${row}`);
    console.log(`  ${pc.dim("Toolkit v0.0.1")}\n`);
  };
  draw();
  ctx(draw);
}

// ── F3: Block letters with color gradient across letters ──
function optF3() {
  hdr("F3 — Gradient Colors Across Letters", "Each letter pair uses a brand color, ~72 cols");
  const draw = () => {
    const colors = [Y, Y, C, C, S, S, L, L, L, L];
    const word = "OutputEase";
    const rows: string[] = ["","","","","",""];
    for (let i = 0; i < word.length; i++) {
      const g = FONT[word[i]!]; if (!g) continue;
      const c = colors[i]!;
      for (let r = 0; r < 6; r++) rows[r] += c(g[r]!) + " ";
    }
    for (const row of rows) console.log(`  ${row}`);
    console.log(`  ${pc.dim("Toolkit v0.0.1")}\n`);
  };
  draw();
  ctx(draw);
}

// ── F4: Block letters + 4-color vertical bars on left ──
function optF4() {
  hdr("F4 — Block Letters + Vertical Brand Bars", "4-color bar left edge, ~74 cols");
  const draw = () => {
    const bars = [Y("█"), C("█"), S("█"), L("█"), Y("█"), C("█")];
    const rows: string[] = ["","","","","",""];
    for (const ch of "Output") {
      const g = FONT[ch]; if (!g) continue;
      for (let r = 0; r < 6; r++) rows[r] += W(g[r]!) + " ";
    }
    for (const ch of "Ease") {
      const g = FONT[ch]; if (!g) continue;
      for (let r = 0; r < 6; r++) rows[r] += L(g[r]!) + " ";
    }
    for (let r = 0; r < 6; r++)
      console.log(`  ${bars[r]} ${rows[r]}`);
    console.log(`    ${pc.dim("Toolkit v0.0.1")}\n`);
  };
  draw();
  ctx(draw);
}

// ── MAIN ──
console.log(`\n${pc.bold("╔═══════════════════════════════════════════════════════════╗")}`);
console.log(pc.bold("║   OutputEase Toolkit — Block Letter Banner Preview       ║"));
console.log(`${pc.bold("╚═══════════════════════════════════════════════════════════╝")}\n`);

optF1(); optF2(); optF3(); optF4();

console.log(pc.dim("━".repeat(70)));
console.log(pc.bold(pc.green("\n  Preview complete.")));
console.log(pc.dim("  Pick F1-F4 or describe adjustments.\n"));
