export type AIProviderId = "openai" | "gemini" | "openrouter" | "custom";

export interface AIProviderConfig {
  provider: AIProviderId;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionResult {
  text: string;
  model: string;
  provider: AIProviderId;
}

export type AIMode = "ask" | "explain-page" | "explain-issue";

export interface AIRequest {
  analysisId: string;
  mode: AIMode;
  question?: string;
  issueId?: string;
  /** Optional per-request override (kept server-side; never echoed back). */
  config?: Partial<AIProviderConfig>;
}

export interface AIStatus {
  configured: boolean;
  provider: AIProviderId | null;
  model: string | null;
}
