import type { AnalyzeResult, EnhanceResult, GenerateResult } from "./ai";
import { prisma } from "./prisma";

const ENGINE_URL = (process.env.ENGINE_URL || "http://localhost:8000").replace(
  /\/+$/,
  "",
);

const ENGINE_TIMEOUT_MS = 120_000;

export class EngineUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineUnavailableError";
  }
}

export class EngineValidationError extends Error {
  constructor(
    message: string,
    public readonly category: string,
    public readonly issues: string[],
  ) {
    super(message);
    this.name = "EngineValidationError";
  }
}

export class EngineAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineAuthError";
  }
}

export class EngineRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineRateLimitError";
  }
}

interface ProviderConfig {
  base_url: string;
  api_key: string;
  model: string;
  max_tokens: number | null;
  temperature: number | null;
}

interface EngineResponse<T> {
  analysis: T;
}

interface EngineErrorBody {
  error: string;
  category: string;
  issues: string[];
}

async function getProviderConfig(providerId?: string): Promise<ProviderConfig> {
  const dbProvider = providerId
    ? await prisma.aIProvider.findUnique({ where: { id: providerId } })
    : await prisma.aIProvider.findFirst({
        where: { isDefault: true, isActive: true },
      });

  if (dbProvider) {
    return {
      base_url: dbProvider.baseUrl.replace(/\/+$/, ""),
      api_key: dbProvider.apiKey,
      model: dbProvider.model,
      max_tokens: dbProvider.maxTokens,
      temperature: dbProvider.temperature,
    };
  }

  return {
    base_url: (process.env.AI_BASE_URL || "").replace(/\/+$/, ""),
    api_key: process.env.AI_API_KEY || "",
    model: process.env.AI_MODEL || "",
    max_tokens: 4096,
    temperature: 0.3,
  };
}

async function callEngine<T>(
  operation: "analyze" | "enhance" | "generate",
  payload: Record<string, unknown>,
  providerId?: string,
): Promise<{ result: T; modelUsed: string; tokensUsed: number; latencyMs: number }> {
  const providerConfig = await getProviderConfig(providerId);

  const url = `${ENGINE_URL}/api/v1/${operation}`;
  const body = {
    provider: providerConfig,
    ...payload,
  };

  const start = Date.now();

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    throw new EngineUnavailableError(
      `Failed to connect to AI engine at ${ENGINE_URL}: ${msg}`,
    );
  }

  const latencyMs = Date.now() - start;

  if (!res.ok) {
    let errorBody: EngineErrorBody;
    const rawText = await res.text().catch(() => "");
    try {
      errorBody = JSON.parse(rawText);
    } catch {
      throw new EngineUnavailableError(
        `Engine returned ${res.status}: ${rawText.substring(0, 300)}`,
      );
    }

    switch (res.status) {
      case 401:
        throw new EngineAuthError(errorBody.error);
      case 422:
        throw new EngineValidationError(
          errorBody.error,
          errorBody.category || "validation",
          errorBody.issues || [],
        );
      case 429:
        throw new EngineRateLimitError(errorBody.error);
      case 503:
      case 504:
        throw new EngineUnavailableError(errorBody.error);
      default:
        throw new Error(`Engine error (${res.status}): ${errorBody.error}`);
    }
  }

  const data = (await res.json()) as EngineResponse<T> & {
    runtime?: {
      latency_ms?: number;
    };
    analysis?: T & {
      modelUsed?: string;
      tokensUsed?: number;
    };
  };

  const analysis = data.analysis as T & {
    modelUsed?: string;
    tokensUsed?: number;
  };

  return {
    result: analysis as T,
    modelUsed: analysis?.modelUsed || providerConfig.model,
    tokensUsed: analysis?.tokensUsed || 0,
    latencyMs: data.runtime?.latency_ms || latencyMs,
  };
}

export async function engineAnalyze(payload: {
  user_id: string;
  rule_text?: string;
  rule_id?: string;
  query?: string;
  language?: string;
}): Promise<{
  result: AnalyzeResult;
  modelUsed: string;
  tokensUsed: number;
  latencyMs: number;
}> {
  return callEngine<AnalyzeResult>("analyze", payload);
}

export async function engineEnhance(payload: {
  user_id: string;
  rule_text: string;
  rule_id?: string;
}): Promise<{
  result: EnhanceResult;
  modelUsed: string;
  tokensUsed: number;
  latencyMs: number;
}> {
  return callEngine<EnhanceResult>("enhance", payload);
}

export async function engineGenerate(payload: {
  user_id: string;
  requirement: string;
}): Promise<{
  result: GenerateResult;
  modelUsed: string;
  tokensUsed: number;
  latencyMs: number;
}> {
  return callEngine<GenerateResult>("generate", payload);
}

export async function checkEngineHealth(): Promise<{
  available: boolean;
  pipelineReady: boolean;
  latencyMs: number;
}> {
  const start = Date.now();
  try {
    const res = await fetch(`${ENGINE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return { available: false, pipelineReady: false, latencyMs };
    }
    const data = (await res.json()) as {
      status: string;
      pipeline_ready: boolean;
    };
    return {
      available: data.status === "ok",
      pipelineReady: data.pipeline_ready,
      latencyMs,
    };
  } catch {
    return { available: false, pipelineReady: false, latencyMs: Date.now() - start };
  }
}

async function fetchSSE(
  operation: "analyze" | "enhance" | "generate",
  payload: Record<string, unknown>,
): Promise<Response> {
  const providerConfig = await getProviderConfig();
  try {
    return await fetch(`${ENGINE_URL}/api/v1/${operation}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ provider: providerConfig, ...payload }),
      signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    throw new EngineUnavailableError(
      `Failed to connect to AI engine at ${ENGINE_URL}: ${msg}`,
    );
  }
}

export async function engineAnalyzeSSE(payload: {
  user_id: string;
  rule_text?: string;
  rule_id?: string;
  query?: string;
  language?: string;
}): Promise<Response> {
  return fetchSSE("analyze", payload);
}

export async function engineEnhanceSSE(payload: {
  user_id: string;
  rule_text: string;
  rule_id?: string;
}): Promise<Response> {
  return fetchSSE("enhance", payload);
}

export async function engineGenerateSSE(payload: {
  user_id: string;
  requirement: string;
}): Promise<Response> {
  return fetchSSE("generate", payload);
}

export { ENGINE_URL };
