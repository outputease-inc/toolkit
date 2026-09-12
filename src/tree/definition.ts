import { BUN_PREREQ } from "./prereqs";
import type { DecisionTreeLeaf, DecisionTreeNode } from "./schema";

/**
 * Hardcoded decision tree for the interactive CLI.
 * Each node is a question; each option leads to another node or a terminal leaf.
 */

export const DECISION_TREE: DecisionTreeNode[] = [
  {
    id: "project-type",
    question: "What are you building?",
    options: [
      {
        value: "web-app",
        label: "Web App",
        hint: "Full-stack or frontend web application",
        next: "web-framework",
      },
      {
        value: "content-site",
        label: "Content Site",
        hint: "Blog, docs, or marketing site",
        next: "content-framework",
      },
      {
        value: "mobile-app",
        label: "Mobile App",
        hint: "Cross-platform mobile application",
        next: "mobile-styling",
      },
      {
        value: "desktop-app",
        label: "Desktop App",
        hint: "Native desktop application",
        next: "desktop-styling",
      },
      {
        value: "cli-tool",
        label: "CLI Tool",
        hint: "Command-line tool or utility",
        next: null,
      },
      {
        value: "library",
        label: "Library",
        hint: "Shared TypeScript package or utility library",
        next: null,
      },
    ],
  },
  {
    id: "web-framework",
    question: "Which framework?",
    options: [
      {
        value: "nextjs",
        label: "Next.js",
        hint: "React framework with SSR, routing, and API routes",
        next: "styling",
      },
    ],
  },
  {
    id: "styling",
    question: "Styling approach?",
    options: [
      {
        value: "tailwind",
        label: "Tailwind CSS",
        hint: "Utility-first CSS framework",
        next: null,
      },
    ],
  },
  {
    id: "content-framework",
    question: "Which framework?",
    options: [
      {
        value: "astro-tailwind",
        label: "Astro",
        hint: "Content-focused framework with island architecture",
        next: null,
      },
    ],
  },
  {
    id: "mobile-styling",
    question: "Mobile framework?",
    options: [
      {
        value: "capacitor-react",
        label: "Capacitor + React",
        hint: "Cross-platform native apps with web technologies",
        next: null,
      },
    ],
  },
  {
    id: "desktop-styling",
    question: "Desktop framework?",
    options: [
      {
        value: "tauri-react",
        label: "Tauri + React",
        hint: "Fast, secure desktop apps with Rust backend",
        next: null,
      },
    ],
  },
];

/**
 * Terminal leaves — each maps a decision tree path to a stack resolution config.
 * Key is the terminal option's value (the last option selected before `next: null`).
 */
export const DECISION_TREE_LEAVES: Record<string, DecisionTreeLeaf> = {
  tailwind: {
    id: "nextjs-tailwind",
    route: "framework:nextjs",
    platformKey: "webApp",
    exclusionChoices: {
      "package-manager": "Bun install",
      runtime: "Bun",
      "test-runner": "Bun test",
    },
    frameworkConfig: {
      framework: "next.js",
      entryPoint: "app/page.tsx",
      devCommand: "next dev",
      buildCommand: "next build",
      directories: ["app", "public"],
    },
    prerequisites: [BUN_PREREQ],
  },
  "astro-tailwind": {
    id: "astro-tailwind",
    route: "framework:astro",
    platformKey: "contentSite",
    exclusionChoices: {
      "package-manager": "Bun install",
      runtime: "Bun",
      "test-runner": "Bun test",
    },
    frameworkConfig: {
      framework: "astro",
      entryPoint: "src/pages/index.astro",
      devCommand: "astro dev",
      buildCommand: "astro build",
      directories: ["src/pages", "src/layouts", "src/components", "public"],
    },
    prerequisites: [BUN_PREREQ],
  },
  "capacitor-react": {
    id: "capacitor-react",
    route: "platform:capacitor",
    platformKey: "mobileApp",
    exclusionChoices: {
      "package-manager": "Bun install",
      runtime: "Bun",
      "test-runner": "Bun test",
    },
    frameworkConfig: {
      framework: "capacitor",
      entryPoint: "src/main.tsx",
      devCommand: "vite",
      buildCommand: "vite build",
      directories: ["src", "public", "android", "ios"],
    },
    prerequisites: [
      BUN_PREREQ,
      {
        name: "Xcode",
        detect: { kind: "binary", cmd: "xcrun", args: ["--version"] },
        severity: "recommended",
        reason: "required to build the iOS target",
        installHint: { url: "https://apps.apple.com/app/xcode/id497799835" },
        appliesTo: ["darwin"],
      },
      {
        name: "Android SDK (adb)",
        detect: { kind: "binary", cmd: "adb", args: ["version"] },
        severity: "recommended",
        reason: "required to build the Android target",
        installHint: {
          url: "https://developer.android.com/studio",
          command: "Install Android Studio, then enable platform-tools.",
        },
      },
      {
        name: "Java JDK 17+",
        detect: { kind: "binary", cmd: "java", args: ["-version"] },
        severity: "recommended",
        reason: "required by the Android Gradle build",
        installHint: {
          url: "https://adoptium.net",
          command:
            process.platform === "win32"
              ? "winget install EclipseAdoptium.Temurin.17.JDK"
              : "Install via your platform package manager or https://adoptium.net",
        },
      },
    ],
  },
  "tauri-react": {
    id: "tauri-react",
    route: "platform:tauri",
    platformKey: "desktopApp",
    exclusionChoices: {
      "package-manager": "Bun install",
      runtime: "Bun",
      "test-runner": "Bun test",
    },
    frameworkConfig: {
      framework: "tauri",
      entryPoint: "src/main.tsx",
      devCommand: "tauri dev",
      buildCommand: "tauri build",
      directories: ["src", "src-tauri", "public"],
    },
    prerequisites: [
      BUN_PREREQ,
      {
        name: "Rust (cargo)",
        detect: { kind: "binary", cmd: "cargo", args: ["--version"] },
        severity: "required",
        reason: "Tauri compiles a Rust backend; `tauri dev` will fail without it",
        installHint: {
          url: "https://rustup.rs",
          command:
            process.platform === "win32"
              ? "winget install Rustlang.Rustup"
              : "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
        },
      },
    ],
  },
  "cli-tool": {
    id: "bun-cli",
    route: "runtime:bun",
    platformKey: "tooling",
    exclusionChoices: {
      "package-manager": "Bun install",
      runtime: "Bun",
      "test-runner": "Bun test",
    },
    frameworkConfig: {
      framework: "bun-cli",
      entryPoint: "src/index.ts",
      devCommand: "bun run src/index.ts",
      buildCommand: "bun build ./src/index.ts --outdir ./dist --target bun",
      directories: ["src"],
    },
    prerequisites: [BUN_PREREQ],
  },
  library: {
    id: "typescript-library",
    route: "base",
    platformKey: "tooling",
    exclusionChoices: {
      "package-manager": "Bun install",
      runtime: "Bun",
      "test-runner": "Bun test",
    },
    frameworkConfig: {
      framework: "library",
      entryPoint: "src/index.ts",
      devCommand: "tsc --watch",
      buildCommand: "tsc",
      directories: ["src"],
    },
    prerequisites: [BUN_PREREQ],
  },
};
