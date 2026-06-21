/**
 * @deprecated Use `./llm` — kept so older imports keep working. Vendor-agnostic via PLAN_LLM_* env.
 */
export {
  callLlmJsonCompletion as callGroqJsonCompletion,
  parseAiPlanJson,
  type LlmJsonCompletionOptions as GroqCompletionOptions,
} from "./llm";
