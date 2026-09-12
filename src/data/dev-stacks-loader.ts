import type { DevStackEntry } from "../schema/dev-stacks";
import { devStacksFileSchema } from "../schema/dev-stacks";
import { makeStackLoader } from "./make-loader";

const loader = makeStackLoader<DevStackEntry>("dev-stacks.json", devStacksFileSchema);

/**
 * Load and validate the dev-stacks dataset (parsed + Zod-validated, cached).
 * Throws on structural errors.
 */
export function loadDevStacks(): DevStackEntry[] {
  return loader.load();
}

/** Absolute path to the bundled dev-stacks.json file. */
export function getDevStacksPath(): string {
  return loader.getPath();
}
