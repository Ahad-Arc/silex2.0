/**
 * SILEX AI Zenith — Server-Side Configuration Module
 * 
 * Manages AI provider settings, vector dimensions, retrieval limits, and credentials securely on the server.
 * AI secrets MUST NEVER be exported or exposed to browser bundles.
 */

export interface AIConfig {
  provider: "gemini" | "openai" | "mock";
  model: string;
  embeddingModel: string;
  embeddingDimensions: number;
  hasApiKey: boolean;
  topKLimit: number;
  similarityThreshold: number;
  maxToolIterations: number;
  maxQueryLength: number;
  maxTokensOutput: number;
  maxContextChars: number;
}

export function getAIConfig(): AIConfig {
  if (typeof window !== "undefined") {
    throw new Error(
      "CRITICAL SECURITY ERROR: AI configuration modules must NEVER be executed in client browser environments."
    );
  }
  const provider = (process.env.AI_PROVIDER as "gemini" | "openai") || "gemini";
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const hasApiKey = Boolean(
    provider === "gemini" ? geminiKey : provider === "openai" ? openaiKey : geminiKey || openaiKey
  );

  return {
    provider: hasApiKey ? provider : "mock",
    model: process.env.AI_MODEL || (provider === "gemini" ? "gemini-3.6-flash" : "gpt-4o"),
    embeddingModel:
      process.env.AI_EMBEDDING_MODEL ||
      (provider === "gemini" ? "gemini-embedding-001" : "text-embedding-3-small"),
    embeddingDimensions: 1536, // Native dimension for ai_memory schema (extensions.vector(1536))
    hasApiKey,
    topKLimit: 5,
    similarityThreshold: 0.85,
    maxToolIterations: 3,
    maxQueryLength: 2000,
    maxTokensOutput: 1024,
    maxContextChars: 8000,
  };
}
