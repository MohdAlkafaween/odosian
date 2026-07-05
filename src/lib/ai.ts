import { prisma } from "./prisma";

export interface AnalysisFinding {
  category: string;
  severity: string;
  title: string;
  detail: string;
}

export interface AnalysisSuggestion {
  priority: number;
  title: string;
  description: string;
  codeSnippet: string;
}

export interface EvasionRisk {
  technique: string;
  description: string;
  mitigation: string;
}

export interface AIMitreMapping {
  tacticId: string;
  tacticName: string;
  techniqueId: string;
  techniqueName: string;
  subTechniqueId: string | null;
  subTechniqueName: string | null;
  confidence: number;
}

export interface AnalyzeResult {
  score: number;
  rating: string;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  findings: AnalysisFinding[];
  suggestions: AnalysisSuggestion[];
  evasionRisks: EvasionRisk[];
  fpRisk: string;
  mitreMappings: AIMitreMapping[];
}

export interface EnhanceResult {
  enhancedQuery: string;
  changelog: { change: string; reason: string }[];
  newSeverity: string;
  newRiskScore: number;
  investigationGuide: string;
  falsePositives: string[];
  references: string[];
  indexPatterns: string[];
  newMitreMappings: AIMitreMapping[];
  enhancedTitle: string;
  enhancedDescription: string;
}

export interface GenerateResult {
  title: string;
  description: string;
  query: string;
  language: string;
  ruleType: string;
  severity: string;
  riskScore: number;
  tags: string[];
  indexPatterns: string[];
  interval: string;
  fromTime: string;
  maxSignals: number;
  investigationGuide: string;
  falsePositives: string[];
  references: string[];
  mitreMappings: AIMitreMapping[];
  score: number;
  notes: string;
}

export interface FeedbackResult {
  score: number;
  rating: string;
  feedback: string;
  topIssues: string[];
  quickFixes: string[];
  verdict: string;
}

interface AICallResult<T> {
  result: T;
  modelUsed: string;
  tokensUsed: number;
  latencyMs: number;
}

export class AIError extends Error {
  public retryAfterMs?: number;
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "AIError";
  }
}

function extractProviderMessage(body: string): string {
  try {
    const parsed = JSON.parse(body);
    return parsed?.error?.message || parsed?.message || body.substring(0, 300);
  } catch {
    return body.substring(0, 300);
  }
}

function classifyProviderError(status: number, body: string): AIError {
  const msg = extractProviderMessage(body);
  switch (status) {
    case 401:
    case 403:
      return new AIError(`AI provider authentication failed: ${msg}`, status, false);
    case 429:
      return new AIError(`AI provider rate limit exceeded. Please try again later.`, status, true);
    case 503:
      return new AIError(`AI provider is temporarily unavailable: ${msg}`, status, true);
    default:
      if (status >= 500) {
        return new AIError(`AI provider internal error (${status}): ${msg}`, status, true);
      }
      return new AIError(`AI provider returned ${status}: ${msg}`, status, false);
  }
}

function parseAIJson<T>(raw: string): T {
  let cleaned = raw.trim();

  cleaned = cleaned.replace(/```(?:json|JSON|javascript|Javascript|JS)?\s*\n?([\s\S]*?)\n?\s*```/g, "$1").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through
  }

  const extracted = extractJsonBlock(cleaned);
  if (extracted !== null) {
    try {
      return JSON.parse(extracted);
    } catch {
      const withoutTrailing = extracted.replace(/,\s*([}\]])/g, "$1");
      try {
        return JSON.parse(withoutTrailing);
      } catch {
        // fall through
      }
    }
  }

  const withoutTrailing = cleaned.replace(/,\s*([}\]])/g, "$1");
  try {
    return JSON.parse(withoutTrailing);
  } catch {
    // fall through
  }

  const repaired = repairTruncatedJson(cleaned);
  if (repaired !== null) {
    try {
      return JSON.parse(repaired);
    } catch {
      // fall through
    }
  }

  throw new Error(`Failed to parse AI response as JSON: ${raw.substring(0, 300)}`);
}

function extractJsonBlock(text: string): string | null {
  const startIdx = text.search(/[{\[]/);
  if (startIdx === -1) return null;

  const opener = text[startIdx];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0 && ch === closer) {
        return text.substring(startIdx, i + 1);
      }
    }
  }

  return null;
}

function repairTruncatedJson(text: string): string | null {
  const startIdx = text.search(/[{\[]/);
  if (startIdx === -1) return null;

  let chunk = text.substring(startIdx);
  chunk = chunk.replace(/,\s*([}\]])/g, "$1");

  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (let i = 0; i < chunk.length; i++) {
    const ch = chunk[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }

  if (stack.length === 0) return null;

  if (inString) chunk += '"';

  const lastColon = chunk.lastIndexOf(":");
  const lastComma = chunk.lastIndexOf(",");
  if (lastColon > lastComma) {
    const afterColon = chunk.substring(lastColon + 1).trim();
    if (afterColon === "" || afterColon === '"') {
      chunk = chunk.substring(0, chunk.lastIndexOf(",") !== -1 ? chunk.lastIndexOf(",") : lastColon);
    }
  }

  chunk += stack.reverse().join("");
  return chunk;
}

async function getProvider() {
  const dbProvider = await prisma.aIProvider.findFirst({
    where: { isDefault: true, isActive: true },
  });

  if (dbProvider) {
    return {
      baseUrl: dbProvider.baseUrl.replace(/\/+$/, ""),
      apiKey: dbProvider.apiKey,
      model: dbProvider.model,
      maxTokens: dbProvider.maxTokens,
      temperature: dbProvider.temperature,
      name: dbProvider.name,
    };
  }

  return {
    baseUrl: (process.env.AI_BASE_URL || "").replace(/\/+$/, ""),
    apiKey: process.env.AI_API_KEY || "",
    model: process.env.AI_MODEL || "",
    maxTokens: 4096,
    temperature: 0.3,
    name: process.env.AI_MODEL || "unknown",
  };
}

const MAX_ATTEMPTS = 3;
const BACKOFF_DELAYS = [1000, 3000];

export async function callAI<T>(promptName: string, userMessage: string): Promise<AICallResult<T>> {
  const provider = await getProvider();
  if (!provider.apiKey) throw new Error("AI provider API key is not configured");

  const prompt = await prisma.prompt.findFirst({
    where: { name: promptName, isActive: true },
  });
  if (!prompt) throw new Error(`Prompt "${promptName}" not found or inactive`);

  const url = `${provider.baseUrl}/chat/completions`;

  const body = {
    model: provider.model,
    messages: [
      { role: "system", content: prompt.systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: provider.maxTokens,
    temperature: provider.temperature,
    response_format: { type: "json_object" },
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delay = (lastError instanceof AIError && lastError.retryAfterMs)
        ? lastError.retryAfterMs
        : BACKOFF_DELAYS[attempt - 1];
      await new Promise((r) => setTimeout(r, delay));
    }

    const start = Date.now();

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      const netMsg = e instanceof Error ? e.message : "Unknown network error";
      lastError = new AIError(
        `Failed to connect to AI provider: ${netMsg}`,
        503,
        true,
      );
      if (attempt < MAX_ATTEMPTS - 1) continue;
      throw lastError;
    }

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const aiErr = classifyProviderError(res.status, errText);
      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        if (retryAfter) {
          const seconds = parseInt(retryAfter);
          if (!isNaN(seconds)) {
            aiErr.retryAfterMs = Math.min(seconds * 1000, 30000);
          }
        }
      }
      if (aiErr.retryable && attempt < MAX_ATTEMPTS - 1) {
        lastError = aiErr;
        continue;
      }
      throw aiErr;
    }

    try {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";
      const tokensUsed = data.usage?.total_tokens ?? data.usage?.prompt_tokens
        ? (data.usage.prompt_tokens || 0) + (data.usage.completion_tokens || 0)
        : 0;

      const result = parseAIJson<T>(content);

      return {
        result,
        modelUsed: provider.name,
        tokensUsed,
        latencyMs,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < MAX_ATTEMPTS - 1) continue;
      throw lastError;
    }
  }

  throw lastError || new AIError("AI call failed after retries", 503, false);
}

export async function callAIWithSystemPrompt<T>(systemPrompt: string, userMessage: string): Promise<AICallResult<T>> {
  const provider = await getProvider();
  if (!provider.apiKey) throw new Error("AI provider API key is not configured");

  const url = `${provider.baseUrl}/chat/completions`;

  const body = {
    model: provider.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: provider.maxTokens,
    temperature: provider.temperature,
    response_format: { type: "json_object" },
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delay = (lastError instanceof AIError && lastError.retryAfterMs)
        ? lastError.retryAfterMs
        : BACKOFF_DELAYS[attempt - 1];
      await new Promise((r) => setTimeout(r, delay));
    }

    const start = Date.now();

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      const netMsg = e instanceof Error ? e.message : "Unknown network error";
      lastError = new AIError(`Failed to connect to AI provider: ${netMsg}`, 503, true);
      if (attempt < MAX_ATTEMPTS - 1) continue;
      throw lastError;
    }

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const aiErr = classifyProviderError(res.status, errText);
      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        if (retryAfter) {
          const seconds = parseInt(retryAfter);
          if (!isNaN(seconds)) aiErr.retryAfterMs = Math.min(seconds * 1000, 30000);
        }
      }
      if (aiErr.retryable && attempt < MAX_ATTEMPTS - 1) { lastError = aiErr; continue; }
      throw aiErr;
    }

    try {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";
      const tokensUsed = data.usage?.total_tokens ?? data.usage?.prompt_tokens
        ? (data.usage.prompt_tokens || 0) + (data.usage.completion_tokens || 0)
        : 0;

      return { result: parseAIJson<T>(content), modelUsed: provider.name, tokensUsed, latencyMs };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < MAX_ATTEMPTS - 1) continue;
      throw lastError;
    }
  }

  throw lastError || new AIError("AI call failed after retries", 503, false);
}
