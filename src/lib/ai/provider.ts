import type { AICompletionResult, AIMessage, AIProviderConfig, AIProviderId, AIStatus } from "@/types/ai";

export interface AIProvider {
  id: AIProviderId;
  label: string;
  defaultBaseUrl: string | null;
  defaultModel: string;
  complete(messages: AIMessage[], config: AIProviderConfig, signal?: AbortSignal): Promise<AICompletionResult>;
}

export class AIProviderError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

const PROVIDER_IDS: AIProviderId[] = ["openai", "gemini", "openrouter", "custom"];

export function isProviderId(v: unknown): v is AIProviderId {
  return typeof v === "string" && (PROVIDER_IDS as string[]).includes(v);
}

/**
 * Resolve the effective configuration: server env vars first, optional per-request
 * override on top. Keys never leave the server.
 */
export function resolveConfig(override?: Partial<AIProviderConfig>): AIProviderConfig | null {
  const envProvider = process.env.AI_PROVIDER;
  const provider = isProviderId(override?.provider) ? override!.provider! : isProviderId(envProvider) ? envProvider : null;
  const apiKey = override?.apiKey?.trim() || process.env.AI_API_KEY?.trim() || "";
  const model = override?.model?.trim() || process.env.AI_MODEL?.trim() || "";
  const baseUrl = override?.baseUrl?.trim() || process.env.AI_BASE_URL?.trim() || undefined;
  if (!provider) return null;
  if (!apiKey && provider !== "custom") return null;
  return { provider, apiKey, model, baseUrl };
}

export function getStatus(): AIStatus {
  const cfg = resolveConfig();
  return { configured: Boolean(cfg), provider: cfg?.provider ?? null, model: cfg?.model || null };
}
