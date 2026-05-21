import { describe, expect, test } from "bun:test";
import { BRAND_HEX, fg, paint, ROLE_TO_BRAND, role } from "./brand-ansi";

const TRUECOLOR_ENV = { COLORTERM: "truecolor" } as NodeJS.ProcessEnv;
const PLAIN_ENV = { NO_COLOR: "1" } as NodeJS.ProcessEnv;

describe("brand-ansi", () => {
  test("fg() emits exact 24-bit escape for each brand color when truecolor supported", () => {
    expect(fg("summerNight", TRUECOLOR_ENV)).toBe("\x1b[38;2;36;31;68m");
    expect(fg("lilac", TRUECOLOR_ENV)).toBe("\x1b[38;2;169;155;249m");
    expect(fg("paleCyan", TRUECOLOR_ENV)).toBe("\x1b[38;2;127;216;255m");
    expect(fg("crayola", TRUECOLOR_ENV)).toBe("\x1b[38;2;253;212;104m");
    expect(fg("salmon", TRUECOLOR_ENV)).toBe("\x1b[38;2;249;176;157m");
  });

  test("fg() returns empty string when truecolor unsupported (graceful fallback)", () => {
    expect(fg("lilac", PLAIN_ENV)).toBe("");
  });

  test("paint() wraps text with open + reset under truecolor; passthrough under NO_COLOR", () => {
    const wrapped = paint("hi", "lilac", TRUECOLOR_ENV);
    expect(wrapped.startsWith("\x1b[38;2;")).toBe(true);
    expect(wrapped.endsWith("\x1b[0m")).toBe(true);
    expect(paint("hi", "lilac", PLAIN_ENV)).toBe("hi");
  });

  test("role() maps semantic roles to brand colors per contract", () => {
    expect(ROLE_TO_BRAND.success).toBe("paleCyan");
    expect(ROLE_TO_BRAND.selected).toBe("lilac");
    expect(ROLE_TO_BRAND.error).toBe("salmon");
    expect(ROLE_TO_BRAND.info).toBe("crayola");
    expect(role("ok", "success", TRUECOLOR_ENV)).toContain(fg("paleCyan", TRUECOLOR_ENV));
  });

  test("BRAND_HEX contains all 6 brand entries", () => {
    expect(Object.keys(BRAND_HEX).sort()).toEqual(
      ["crayola", "lilac", "paleCyan", "salmon", "summerNight", "white"].sort(),
    );
  });
});
