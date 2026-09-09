import type { AnalysisResult } from "@/types/analysis";
import type { AICompletionResult, AIMessage, AIProviderConfig } from "@/types/ai";
import { getProvider } from "./providers";
import { buildAnalysisContext, SYSTEM_PROMPT } from "./context-builder";
import { AIProviderError } from "./provider";

function run(messages: AIMessage[], config: AIProviderConfig): Promise<AICompletionResult> {
  return getProvider(config.provider).complete(messages, config);
}

export async function askWebsite(result: AnalysisResult, question: string, config: AIProviderConfig): Promise<AICompletionResult> {
  const q = question.trim().slice(0, 1000);
  if (!q) throw new AIProviderError("Question is empty.", 400);
  return run(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `ANALYSIS CONTEXT for ${result.url}:\n\n${buildAnalysisContext(result)}\n\nQUESTION: ${q}` },
    ],
    config,
  );
}

export async function explainPage(result: AnalysisResult, config: AIProviderConfig): Promise<AICompletionResult> {
  return run(
    [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `ANALYSIS CONTEXT for ${result.url}:\n\n${buildAnalysisContext(result)}\n\nTASK: Write a "PAGE ARCHITECTURE" explanation (150–300 words). Describe how the page is structured (header/nav/main/sections/footer as actually present in the DOM outline), the main content areas and their approximate size, the navigation, repeated component-like patterns, the technologies observed and how they show up, and the most significant quality findings. Reference real element names and numbers from the context only.`,
      },
    ],
    config,
  );
}

export async function explainIssue(result: AnalysisResult, issueId: string, config: AIProviderConfig): Promise<AICompletionResult> {
  const issue = result.issues.find((i) => i.id === issueId);
  if (!issue) throw new AIProviderError("Issue not found in this analysis.", 404);
  const node = issue.nodeId !== null ? result.dom.nodes[issue.nodeId] : null;
  const nodeInfo = node ? `Affected element: <${node.tag}${node.idAttr ? ` id="${node.idAttr}"` : ""}${node.classes.length ? ` class="${node.classes.join(" ")}"` : ""}> at depth ${node.depth}${node.sourceLine ? `, source line ${node.sourceLine}` : ""}, attributes: ${JSON.stringify(node.attributes).slice(0, 400)}` : "No single affected element.";
  return run(
    [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `ANALYSIS CONTEXT for ${result.url}:\n\n${buildAnalysisContext(result).slice(0, 4000)}\n\nISSUE:\nCategory: ${issue.category}\nSeverity: ${issue.severity}\nTitle: ${issue.title}\nDescription: ${issue.description}\nEvidence: ${issue.evidence}\n${nodeInfo}\n\nTASK: Explain (1) why this matters for this specific page, (2) what concretely was detected, (3) how to fix it with a short code example where appropriate. Under 200 words.`,
      },
    ],
    config,
  );
}
