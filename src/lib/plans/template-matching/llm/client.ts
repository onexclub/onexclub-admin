import { getLlmConfig } from "./config";
import type { LlmJsonCompletionOptions } from "./types";

/**
 * Call any OpenAI-compatible chat completions API with JSON response mode.
 * **Reuse:** Groq today; swap to OpenAI/Together via PLAN_LLM_PROVIDER env only.
 */
export async function callLlmJsonCompletion(options: LlmJsonCompletionOptions): Promise<string> {
  const config = getLlmConfig();
  if (!config) {
    throw new Error(
      "LLM not configured. Set PLAN_LLM_API_KEY (or GROQ_API_KEY) and optionally PLAN_LLM_PROVIDER in .env.local.",
    );
  }

  const userContent = options.retryHint
    ? `${options.userPrompt}\n\nIMPORTANT: ${options.retryHint}`
    : options.userPrompt;

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: options.temperature ?? 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${config.provider} LLM error ${response.status}: ${body.slice(0, 400)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    throw new Error(`${config.provider} LLM returned empty content`);
  }
  return content;
}
