import { type EmitterFamily, emitterFamilySchema } from "../../schema/agent-targets";
import { type Emitter, EmitterNotImplementedError } from "../types";
import { claudePassthrough } from "./claude-passthrough";
import { codexPassthrough } from "./codex-passthrough";
import { commandsMdOpencode } from "./commands-md";
import { commandsTomlGemini } from "./commands-toml";
import { instructionsGeminiSettings, mcpGeminiSettings } from "./gemini-settings";
import {
  instructionsCopilotMd,
  instructionsMdcRule,
  instructionsWindsurfRule,
} from "./ide-instructions";
import { mcpDevinJson } from "./ide-mcp";
import { instructionsAgentsMd, instructionsClaudeMd } from "./instructions-md";
import { mcpJsonMcpServers, mcpJsonServers } from "./mcp-json";
import { mcpTomlCodex } from "./mcp-toml";
import { instructionsOpencodeJson, mcpOpencodeJson } from "./opencode-json";
import { skillsCopy } from "./skills-copy";

/**
 * Emitter registry (spec 008). Keyed by `EmitterFamily`. Every enum member has
 * an entry — unimplemented families use a stub that throws
 * `EmitterNotImplementedError` at generate time (exit 4), never at validate time.
 * The `family-known` cross-field rule reads `KNOWN_FAMILIES` so a data entry can
 * only reference a family the engine knows about.
 */

function stub(family: EmitterFamily): Emitter {
  return () => {
    throw new EmitterNotImplementedError(family);
  };
}

export const EMITTER_REGISTRY: Record<EmitterFamily, Emitter> = {
  "instructions-agentsmd": instructionsAgentsMd,
  "instructions-claudemd": instructionsClaudeMd,
  "instructions-gemini-settings": instructionsGeminiSettings,
  "instructions-mdc-rule": instructionsMdcRule,
  "instructions-windsurf-rule": instructionsWindsurfRule,
  "instructions-copilot-md": instructionsCopilotMd,
  "instructions-opencode-json": instructionsOpencodeJson,
  "mcp-json-mcpServers": mcpJsonMcpServers,
  "mcp-json-servers": mcpJsonServers,
  "mcp-toml-codex": mcpTomlCodex,
  "mcp-opencode-json": mcpOpencodeJson,
  "mcp-gemini-settings": mcpGeminiSettings,
  "mcp-devin-json": mcpDevinJson,
  "commands-toml-gemini": commandsTomlGemini,
  "commands-md-opencode": commandsMdOpencode,
  "skills-copy": skillsCopy,
  "claude-passthrough": claudePassthrough,
  "codex-passthrough": codexPassthrough,
};

/** Every family the engine recognizes (registry keys === EmitterFamily enum members). */
export const KNOWN_FAMILIES: ReadonlySet<EmitterFamily> = new Set(
  Object.keys(EMITTER_REGISTRY) as EmitterFamily[],
);

/** Enum members that MUST all be registered (guards the registry-completeness invariant). */
export const ALL_FAMILIES: readonly EmitterFamily[] = emitterFamilySchema.options;

export function getEmitter(family: EmitterFamily): Emitter {
  return EMITTER_REGISTRY[family];
}
