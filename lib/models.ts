export const PAID_MODELS = [
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o",
  "google/gemini-pro-1.5",
  "cohere/command-r-plus",
  "qwen/qwen-2.5-72b-instruct",
  "mistralai/mistral-large",
] as const;

export const FREE_MODELS = [
  "google/gemma-2-9b-it:free",
  "google/gemma-7b-it:free",
  "meta-llama/llama-3-8b-instruct:free",
  "openchat/openchat-7b:free",
] as const;

export type ModelId =
  | (typeof PAID_MODELS)[number]
  | (typeof FREE_MODELS)[number];
