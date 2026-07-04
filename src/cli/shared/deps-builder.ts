import { TOOLKIT_PACKAGE_NAME } from "../../update/fetch";

/**
 * Framework-specific runtime + dev dependencies for new scaffolds.
 * Pure mapping — no side effects, no I/O.
 */
export function getFrameworkDeps(framework: string): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
} {
  switch (framework) {
    case "next.js":
      return {
        dependencies: {
          next: "^16.0.0",
          react: "^19.0.0",
          "react-dom": "^19.0.0",
        },
        devDependencies: {
          "@biomejs/biome": "^2.0.0",
          "@types/react": "^19.0.0",
          "@types/react-dom": "^19.0.0",
          typescript: "^5.7.0",
        },
      };
    case "astro":
      return {
        dependencies: {
          astro: "^5.0.0",
          "@astrojs/tailwind": "^6.0.0",
        },
        devDependencies: {
          "@biomejs/biome": "^2.0.0",
          typescript: "^5.7.0",
        },
      };
    case "capacitor":
      return {
        dependencies: {
          react: "^19.0.0",
          "react-dom": "^19.0.0",
          "@capacitor/core": "^7.0.0",
          "@capacitor/cli": "^7.0.0",
        },
        devDependencies: {
          "@biomejs/biome": "^2.0.0",
          "@types/react": "^19.0.0",
          "@types/react-dom": "^19.0.0",
          typescript: "^5.7.0",
          vite: "^6.0.0",
          "@vitejs/plugin-react": "^4.0.0",
        },
      };
    case "tauri":
      return {
        dependencies: {
          react: "^19.0.0",
          "react-dom": "^19.0.0",
          "@tauri-apps/api": "^2.0.0",
        },
        devDependencies: {
          "@biomejs/biome": "^2.0.0",
          "@types/react": "^19.0.0",
          "@types/react-dom": "^19.0.0",
          typescript: "^5.7.0",
          vite: "^6.0.0",
          "@vitejs/plugin-react": "^4.0.0",
          "@tauri-apps/cli": "^2.0.0",
        },
      };
    case "bun-cli":
      return {
        dependencies: {
          commander: "^13.0.0",
        },
        devDependencies: {
          "@biomejs/biome": "^2.0.0",
          "@types/bun": "^1.0.0",
          typescript: "^5.7.0",
        },
      };
    case "library":
      return {
        dependencies: {},
        devDependencies: {
          "@biomejs/biome": "^2.0.0",
          typescript: "^5.7.0",
        },
      };
    default:
      return { dependencies: {}, devDependencies: {} };
  }
}

/**
 * Automation tooling deps installed for standalone + monorepo scopes only.
 * @param toolkitVersion - the running CLI version, so scaffolds pin the toolkit
 *   that produced them instead of a stale hardcoded floor.
 */
export function getAutomationDeps(toolkitVersion: string): Record<string, string> {
  return {
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    [TOOLKIT_PACKAGE_NAME]: `^${toolkitVersion}`,
    "simple-git-hooks": "^2.11.0",
  };
}
