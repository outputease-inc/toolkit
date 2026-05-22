import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { printBanner } from "./banner";

describe("printBanner", () => {
  afterEach(() => {
    delete process.env.NO_BANNER;
  });

  it("suppresses output when noBanner is true", () => {
    const spy = spyOn(console, "log").mockImplementation(() => {});
    printBanner({ noBanner: true });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("suppresses output when NO_BANNER env is set", () => {
    const spy = spyOn(console, "log").mockImplementation(() => {});
    process.env.NO_BANNER = "1";
    printBanner();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("renders wide banner when terminal >= 48 cols", () => {
    const lines: string[] = [];
    const spy = spyOn(console, "log").mockImplementation((...args) => {
      lines.push(String(args[0] ?? ""));
    });
    const orig = process.stdout.columns;
    Object.defineProperty(process.stdout, "columns", { value: 120, configurable: true });
    printBanner({ version: "0.0.1" });
    // Banner is one console.log call with embedded newlines; split to count lines
    const allLines = lines.flatMap((l) => l.split("\n"));
    const nonEmpty = allLines.filter((l) => l.trim().length > 0);
    // 1 dots + 6 Output rows + 6 Ease rows + 1 label = 14 non-empty lines
    expect(nonEmpty.length).toBeGreaterThanOrEqual(13);
    spy.mockRestore();
    Object.defineProperty(process.stdout, "columns", { value: orig, configurable: true });
  });

  it("renders narrow banner when terminal < 48 cols", () => {
    const lines: string[] = [];
    const spy = spyOn(console, "log").mockImplementation((...args) => {
      lines.push(String(args[0] ?? ""));
    });
    const orig = process.stdout.columns;
    Object.defineProperty(process.stdout, "columns", { value: 40, configurable: true });
    printBanner();
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    expect(nonEmpty.length).toBe(1);
    spy.mockRestore();
    Object.defineProperty(process.stdout, "columns", { value: orig, configurable: true });
  });

  it("includes version string in output", () => {
    const lines: string[] = [];
    const spy = spyOn(console, "log").mockImplementation((...args) => {
      lines.push(String(args[0] ?? ""));
    });
    const orig = process.stdout.columns;
    Object.defineProperty(process.stdout, "columns", { value: 120, configurable: true });
    printBanner({ version: "1.2.3" });
    const joined = lines.join("\n");
    expect(joined).toContain("1.2.3");
    spy.mockRestore();
    Object.defineProperty(process.stdout, "columns", { value: orig, configurable: true });
  });

  it("wide banner emits brand RGB escapes matching brand hex (SC-006, T071)", () => {
    const lines: string[] = [];
    const spy = spyOn(console, "log").mockImplementation((...args) => {
      lines.push(String(args[0] ?? ""));
    });
    const orig = process.stdout.columns;
    Object.defineProperty(process.stdout, "columns", { value: 120, configurable: true });
    printBanner({ version: "0.2.0" });
    const joined = lines.join("\n");
    spy.mockRestore();
    Object.defineProperty(process.stdout, "columns", { value: orig, configurable: true });

    expect(joined).toContain("\x1b[38;2;169;155;249m");
    expect(joined).toContain("\x1b[38;2;127;216;255m");
    expect(joined).toContain("\x1b[38;2;253;212;104m");
    expect(joined).toContain("\x1b[38;2;249;176;157m");
    expect(joined).toContain("\x1b[1;38;2;255;255;255m");
    expect(joined).toContain("\x1b[0m");
  });

  it("narrow banner emits lilac brand RGB escape (SC-006, T071)", () => {
    const lines: string[] = [];
    const spy = spyOn(console, "log").mockImplementation((...args) => {
      lines.push(String(args[0] ?? ""));
    });
    const orig = process.stdout.columns;
    Object.defineProperty(process.stdout, "columns", { value: 40, configurable: true });
    printBanner({ version: "0.2.0" });
    const joined = lines.join("\n");
    spy.mockRestore();
    Object.defineProperty(process.stdout, "columns", { value: orig, configurable: true });

    expect(joined).toContain("\x1b[38;2;169;155;249m");
    expect(joined).toContain("\x1b[1;38;2;255;255;255m");
  });
});
