/**
 * Public barrel for the `outputease init` command.
 * Concrete logic lives in:
 *   - ./commands/init/run      → runInit() programmatic core
 *   - ./commands/init/action   → initAction() CLI / prompt handler
 *   - ./shared/resolvers       → resolveAdditiveRoutes, resolveMarkerProjectType
 */
export { initAction } from "./commands/init/action";
export { type RunInitOptions, runInit } from "./commands/init/run";
export { resolveAdditiveRoutes, resolveMarkerProjectType } from "./shared/resolvers";
