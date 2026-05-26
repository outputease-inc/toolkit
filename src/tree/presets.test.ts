import { describe, expect, it } from "bun:test";
import { getPreset, listPresets } from "./presets";

describe("presets", () => {
  it("resolves 'web-app' to a valid preset with leafId", () => {
    const preset = getPreset("web-app");
    expect(preset).toBeDefined();
    expect(preset?.leafId).toBe("nextjs-tailwind");
    expect(preset?.defaultName).toBe("my-web-app");
  });

  it("resolves 'content-site' preset", () => {
    const preset = getPreset("content-site");
    expect(preset).toBeDefined();
    expect(preset?.leafId).toBe("astro-tailwind");
  });

  it("resolves 'cli-tool' preset", () => {
    const preset = getPreset("cli-tool");
    expect(preset).toBeDefined();
    expect(preset?.leafId).toBe("bun-cli");
  });

  it("returns undefined for unknown preset", () => {
    expect(getPreset("nonexistent")).toBeUndefined();
  });

  it("lists all available presets (9 total)", () => {
    const presets = listPresets();
    expect(presets).toHaveLength(9);
    const names = presets.map((p) => p.name);
    expect(names).toContain("web-app");
    expect(names).toContain("content-site");
    expect(names).toContain("mobile-app");
    expect(names).toContain("desktop-app");
    expect(names).toContain("cli-tool");
    expect(names).toContain("library");
    expect(names).toContain("web-app-supabase");
    expect(names).toContain("web-app-standalone");
    expect(names).toContain("web-app-node");
  });

  it("web-app-supabase preset has additiveRoutes with backend:supabase", () => {
    const preset = getPreset("web-app-supabase");
    expect(preset).toBeDefined();
    expect(preset?.leafId).toBe("nextjs-tailwind");
    expect(preset?.additiveRoutes).toHaveLength(1);
    expect(preset?.additiveRoutes?.[0]?.route).toBe("backend:supabase");
  });

  it("web-app-standalone preset has additiveRoutes with backend:standalone", () => {
    const preset = getPreset("web-app-standalone");
    expect(preset).toBeDefined();
    expect(preset?.additiveRoutes).toHaveLength(1);
    expect(preset?.additiveRoutes?.[0]?.route).toBe("backend:standalone");
  });

  it("web-app-node preset has additiveRoutes with runtime:node", () => {
    const preset = getPreset("web-app-node");
    expect(preset).toBeDefined();
    expect(preset?.additiveRoutes).toHaveLength(1);
    expect(preset?.additiveRoutes?.[0]?.route).toBe("runtime:node");
  });

  it("base presets have no additiveRoutes", () => {
    const webApp = getPreset("web-app");
    expect(webApp?.additiveRoutes).toBeUndefined();
    const cli = getPreset("cli-tool");
    expect(cli?.additiveRoutes).toBeUndefined();
  });
});
