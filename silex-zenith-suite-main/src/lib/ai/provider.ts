import { getAIConfig, AIConfig } from "./config";

export interface GenerateTextOptions {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateTextResult {
  text: string;
  model: string;
  tokensUsed?: number;
}

export interface CreateEmbeddingResult {
  embedding: number[];
  dimensions: number;
}

export interface AIProvider {
  id: string;
  name: string;
  generateText(options: GenerateTextOptions): Promise<GenerateTextResult>;
  createEmbedding(text: string): Promise<CreateEmbeddingResult>;
}

/**
 * Fallback Mock AI Provider for local/testing environments without live credentials.
 */
export class MockAIProvider implements AIProvider {
  id = "mock";
  name = "SILEX Mock Provider";

  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    return {
      text: `[SILEX Zenith AI — Mock Mode]: Processing request: "${options.prompt.slice(0, 60)}..."`,
      model: "silex-mock-v1",
      tokensUsed: 42,
    };
  }

  async createEmbedding(text: string): Promise<CreateEmbeddingResult> {
    // Generate deterministic 1536-dimensional pseudo-embedding vector for testing
    const dims = 1536;
    const embedding: number[] = new Array(dims);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    for (let i = 0; i < dims; i++) {
      embedding[i] = Math.sin(hash + i) * 0.1;
    }

    return {
      embedding,
      dimensions: dims,
    };
  }
}

/**
 * Google Gemini Provider Implementation Handle
 */
export class GeminiAIProvider implements AIProvider {
  id = "gemini";
  name = "Google Gemini AI";
  private apiKey: string;
  private model: string;
  private embeddingModel: string;

  constructor(
    apiKey: string,
    model: string = "gemini-2.5-flash",
    embeddingModel: string = "gemini-embedding-001",
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.embeddingModel = embeddingModel;
  }

  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    // Structural API request handling for Gemini REST endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: options.prompt }],
        },
      ],
      systemInstruction: options.systemInstruction
        ? { parts: [{ text: options.systemInstruction }] }
        : undefined,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const textResult =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
    const tokensUsed = data?.usageMetadata?.totalTokenCount || 0;

    return {
      text: textResult,
      model: this.model,
      tokensUsed,
    };
  }

  async createEmbedding(text: string): Promise<CreateEmbeddingResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.embeddingModel}:embedContent?key=${this.apiKey}`;
    const payload = {
      model: `models/${this.embeddingModel}`,
      content: { parts: [{ text }] },
      outputDimensionality: 1536,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini Embedding API failure (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const values: number[] = data?.embedding?.values || [];

    if (values.length !== 1536) {
      throw new Error(`Gemini Embedding dimension mismatch: expected 1536, got ${values.length}`);
    }

    return {
      embedding: values,
      dimensions: 1536,
    };
  }
}

/**
 * Server-Side AI Provider Factory Resolver
 */
export function getAIProvider(): AIProvider {
  const config = getAIConfig();

  if (!config.hasApiKey) {
    return new MockAIProvider();
  }

  if (config.provider === "gemini" && process.env.GEMINI_API_KEY) {
    return new GeminiAIProvider(process.env.GEMINI_API_KEY, config.model, config.embeddingModel);
  }

  return new MockAIProvider();
}
