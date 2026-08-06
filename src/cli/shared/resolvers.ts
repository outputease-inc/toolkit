import { resolve } from "node:path";
import type { ProjectType } from "../../marker/schema";
import type { detectWorkspace } from "../../scaffold/workspace";
import type { ScaffoldScope } from "../../schema/scaffold";
import { BACKEND_QUESTION, RUNTIME_QUESTION } from "../../tree/additive-routes";
import type { AdditiveRouteConfig } from "../../tree/schema";

/**
 * Resolve additive route configs from user choices and leaf platform.
 */
export function resolveAdditiveRoutes(
  platformKey: string,
  runtimeChoice?: string,
  backendChoice?: string,
): AdditiveRouteConfig[] {
  const configs: AdditiveRouteConfig[] = [];

  if (runtimeChoice && runtimeChoice !== "bun") {
    if (RUNTIME_QUESTION.applicablePlatforms.has(platformKey)) {
      const opt = RUNTIME_QUESTION.options.find((o) => o.value === runtimeChoice);
      if (opt?.config) configs.push(opt.config);
    }
  }

  if (backendChoice && backendChoice !== "none") {
    if (BACKEND_QUESTION.applicablePlatforms.has(platformKey)) {
      const opt = BACKEND_QUESTION.options.find((o) => o.value === backendChoice);
      if (opt?.config) configs.push(opt.config);
    }
  }

  return configs;
}

/**
 * Map a leaf's `platformKey` to the `.outputease` marker `projectType`.
 * The marker enum is broader than `platformKey` — tooling splits into cli/library.
 */
export function resolveMarkerProjectType(platformKey: string): ProjectType {
  switch (platformKey) {
    case "webApp":
      return "web-app";
    case "contentSite":
      return "content-site";
    case "mobileApp":
      return "mobile-app";
    case "desktopApp":
      return "desktop-app";
    case "tooling":
      // Tooling covers cli-tool + library; default to library (the broader bucket)
      // until we thread the leaf id all the way through. Override available in
      // future via leaf metadata.
      return "library";
    default:
      return "library";
  }
}

/**
 * Resolve target directory based on scope and workspace info.
 * Workspace scopes place output into the detected apps/ or packages/ dir.
 */
export function resolveTargetDir(
  cwd: string,
  name: string,
  scope: ScaffoldScope | undefined,
  ws: ReturnType<typeof detectWorkspace>,
): string {
  if (scope === "workspace-app" && ws.detected) {
    return resolve(cwd, ws.appsDir ?? "apps", name);
  }
  if (scope === "workspace-package" && ws.detected) {
    return resolve(cwd, ws.packagesDir ?? "packages", name);
  }
  return resolve(cwd, name);
}
