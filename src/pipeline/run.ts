/**
 * Token-listing utility (legacy 6-phase pipeline orchestrator removed in 0.2.0
 * per FR-010). The Eta-based scaffolder in `src/cli/init.ts` fills CLI-resolvable
 * placeholders at scaffold time, so the post-scaffold pass is no longer needed.
 */

import { listTokens } from "./token-replacer";

export interface ListResult {
  tokens: Map<string, number>;
}

export function runListTokens(root: string): ListResult {
  return { tokens: listTokens(root) };
}
