import type { AICompletionResult, AIMessage, AIProviderConfig, AIProviderId } from "@/types/ai";
import { AIProviderError, type AIProvider } from "./provider";

const TIMEOUT_MS = 60_000;

async function postJson(url: string, body: unknown, headers: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener("abort", () => controller.abort());
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: controller.signal });
    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 300);
      try {
        const j = JSON.parse(text);
        detail = j.error?.message ?? j.message ?? detail;
      } catch {
        /* keep text */
      }
      throw new AIProviderError(`Provider returned HTTP ${res.status}: ${detail}`, res.status === 401 || res.status === 403 ? 401 : 502);
    }
    return JSON.parse(text);
  } catch (err) {
    if (err instanceof AIProviderError) throw err;
    if ((err as Error).name === "AbortError") throw new AIProviderError("The AI provider timed out.", 504);
    throw new AIProviderError(`Could not reach the AI provider: ${(err as Error).message}`, 502);
  } finally {
    clearTimeout(timer);
  }
}

/** OpenAI-compatible chat completions (OpenAI, OpenRouter, custom/self-hosted). */
function openAICompatible(id: AIProviderId, label: string, defaultBaseUrl: string | null, defaultModel: string, extraHeaders: Record<string, string> = {}): AIProvider {
  return {
    id,
    label,
    defaultBaseUrl,
    defaultModel,
    async complete(messages: AIMessage[], config: AIProviderConfig, signal?: AbortSignal): Promise<AICompletionResult> {
      const base = (config.baseUrl || defaultBaseUrl || "").replace(/\/+$/, "");
      if (!base) throw new AIProviderError("A base URL is required for the custom provider.", 400);
      const model = config.model || defaultModel;
      const headers: Record<string, string> = { ...extraHeaders };
      if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
      const data = (await postJson(`${base}/chat/completions`, { model, messages, temperature: 0.2, max_tokens: 1200 }, headers, signal)) as {
        choices?: { message?: { content?: string | { text?: string }[] } }[];
        model?: string;
      };
      const raw = data.choices?.[0]?.message?.content;
      const text = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((p) => p.text ?? "").join("") : "";
      if (!text.trim()) throw new AIProviderError("The provider returned an empty response.");
      return { text: text.trim(), model: data.model ?? model, provider: id };
    },
  };
}

const gemini: AIProvider = {
  id: "gemini",
  label: "Google Gemini",
  defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
  defaultModel: "gemini-2.0-flash",
  async complete(messages, config, signal) {
    const base = (config.baseUrl || this.defaultBaseUrl!).replace(/\/+$/, "");
    const model = config.model || this.defaultModel;
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const contents = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
    const body: Record<string, unknown> = { contents, generationConfig: { temperature: 0.2, maxOutputTokens: 1200 } };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    const data = (await postJson(`${base}/models/${encodeURIComponent(model)}:generateContent`, body, { "x-goog-api-key": config.apiKey }, signal)) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text.trim()) throw new AIProviderError("Gemini returned an empty response.");
    return { text: text.trim(), model, provider: "gemini" };
  },
};

export const PROVIDERS: Record<AIProviderId, AIProvider> = {
  openai: openAICompatible("openai", "OpenAI", "https://api.openai.com/v1", "gpt-4o-mini"),
  openrouter: openAICompatible("openrouter", "OpenRouter", "https://openrouter.ai/api/v1", "openai/gpt-4o-mini", { "HTTP-Referer": "https://domscope.local", "X-Title": "DOMScope" }),
  custom: openAICompatible("custom", "Custom (OpenAI-compatible)", null, "default"),
  gemini,
};

export function getProvider(id: AIProviderId): AIProvider {
  return PROVIDERS[id];
}
