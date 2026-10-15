import { z } from "zod";

/**
 * Zod schemas and typed data for the placeholder registry.
 *
 * The registry defines valid placeholder tokens used in the toolkit templates,
 * a blocklist of framework-specific terms, and known non-token patterns.
 */

const tokenCategorySchema = z.object({
  tokens: z.record(z.string(), z.string()),
});

const knownNonTokensSchema = z.object({
  description: z.string(),
  single_letter_regex: z.string(),
  literals: z.array(z.string()),
});

const removalHintEntrySchema = z.object({
  scope: z.string(),
  pattern: z.string(),
});

const removalHintsSchema = z
  .record(z.string(), z.union([z.string(), removalHintEntrySchema]))
  .transform((hints) => {
    const entries: Record<string, z.infer<typeof removalHintEntrySchema>> = {};
    let description = "";
    for (const [key, value] of Object.entries(hints)) {
      if (typeof value === "string") {
        description = value;
      } else {
        entries[key] = value;
      }
    }
    return { description, entries };
  });

const notesSchema = z.object({
  OR_REMOVE_suffix: z.string(),
  contextual_examples: z.string(),
});

export const registrySchema = z.object({
  description: z.string(),
  categories: z.record(z.string(), tokenCategorySchema),
  known_non_tokens: knownNonTokensSchema,
  framework_terms_blocklist: z.array(z.string()),
  removal_hints: z.record(z.string(), z.union([z.string(), removalHintEntrySchema])),
  notes: notesSchema,
});

export type PlaceholderRegistry = z.infer<typeof registrySchema>;

export { PLACEHOLDER_REGISTRY } from "./registry-data";

export {
  knownNonTokensSchema,
  notesSchema,
  removalHintEntrySchema,
  removalHintsSchema,
  tokenCategorySchema,
};
