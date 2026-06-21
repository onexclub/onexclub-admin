import type { LlmProviderConfig, LlmProviderId } from "./types";

/** Preset base URLs — override with PLAN_LLM_BASE_URL for custom endpoints. */
const PROVIDER_DEFAULTS: Record<
  LlmProviderId,
  { baseUrl: string; model: string; keyEnv: string[] }
> = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    keyEnv: ["PLAN_LLM_API_KEY", "GROQ_API_KEY"],
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    keyEnv: ["PLAN_LLM_API_KEY", "OPENAI_API_KEY"],
  },
  together: {
    baseUrl: "https://api.together.xyz/v1",
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    keyEnv: ["PLAN_LLM_API_KEY", "TOGETHER_API_KEY"],
  },
  custom: {
    baseUrl: "",
    model: "",
    keyEnv: ["PLAN_LLM_API_KEY"],
  },
};

function resolveApiKey(candidates: string[]): string | undefined {
  for (const name of candidates) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

/**
 * Read LLM config from env. Switch vendors by changing PLAN_LLM_PROVIDER only.
 *
 * ```
 * PLAN_LLM_PROVIDER=groq          # groq | openai | together | custom
 * PLAN_LLM_API_KEY=...            # or legacy GROQ_API_KEY / OPENAI_API_KEY
 * PLAN_LLM_MODEL=...              # optional model override
 * PLAN_LLM_BASE_URL=...           # required when provider=custom
 * ```
 */
export function getLlmConfig(): LlmProviderConfig | null {
  const rawProvider = (process.env.PLAN_LLM_PROVIDER ?? "groq").trim().toLowerCase();
  const provider = (["groq", "openai", "together", "custom"].includes(rawProvider)
    ? rawProvider
    : "groq") as LlmProviderId;

  const preset = PROVIDER_DEFAULTS[provider];
  const apiKey = resolveApiKey(preset.keyEnv);
  if (!apiKey) return null;

  const baseUrl = (process.env.PLAN_LLM_BASE_URL ?? preset.baseUrl).replace(/\/$/, "");
  const model = process.env.PLAN_LLM_MODEL ?? preset.model;

  if (!baseUrl || !model) return null;

  return { provider, apiKey, model, baseUrl };
}

export function isLlmConfigured(): boolean {
  return getLlmConfig() != null;
}
