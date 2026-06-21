/** Vendor-agnostic LLM request — any OpenAI-compatible API (Groq, OpenAI, Together, etc.). */
export type LlmJsonCompletionOptions = {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  retryHint?: string;
};

export type LlmProviderId = "groq" | "openai" | "together" | "custom";

export type LlmProviderConfig = {
  provider: LlmProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
};
