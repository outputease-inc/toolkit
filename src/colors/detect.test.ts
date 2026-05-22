import { describe, expect, test } from "bun:test";
import { supportsTruecolor } from "./detect";

describe("supportsTruecolor", () => {
  test.each([
    [{ NO_COLOR: "1" }, false],
    [{ COLORTERM: "truecolor" }, true],
    [{ COLORTERM: "24bit" }, true],
    [{ TERM: "xterm-kitty" }, true],
    [{ TERM: "alacritty" }, true],
    [{ TERM: "wezterm" }, true],
    [{ TERM: "iterm2" }, true],
    [{ TERM: "xterm-256color" }, false],
    [{}, false],
    // NO_COLOR overrides COLORTERM
    [{ NO_COLOR: "1", COLORTERM: "truecolor" }, false],
  ])("env=%j → %s", (env, expected) => {
    expect(supportsTruecolor(env)).toBe(expected);
  });
});
