import * as p from "@clack/prompts";
import type { AdditiveRouteQuestion } from "../../../tree/additive-routes";

/**
 * Prompt the user for an additive-route choice (runtime, backend).
 * Auto-selects when only one option is available. Returns null on Ctrl+C.
 */
export async function askAdditiveRouteQuestion(
  question: AdditiveRouteQuestion,
): Promise<string | null> {
  // Auto-select when only one option is available
  if (question.options.length === 1) {
    const auto = question.options[0];
    if (auto) {
      p.log.info(`${question.question} ${auto.label}`);
      return auto.value;
    }
  }

  const result = await p.select({
    message: question.question,
    options: question.options.map((o) => ({
      value: o.value,
      label: o.label,
      hint: o.hint,
    })),
  });
  if (p.isCancel(result)) return null;
  return result as string;
}
