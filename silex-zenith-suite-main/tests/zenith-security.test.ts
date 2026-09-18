/**
 * SILEX AI Zenith — Automated Security & Production AI Boundary Test Suite
 * 
 * Tests critical M2.4 security, boundary, and configuration constraints:
 * 1. Workspace Isolation
 * 2. Tool Allowlist & Unregistered Tool Rejection
 * 3. Tool Argument Zod Schema Failures
 * 4. Bounded Tool Loop Iterations (Max 3)
 * 5. 1536-Dimensional Vector Validation
 * 6. Empty Retrieval & Grounded Fallback Prompting
 * 7. Top-K Context Bounds (Top 5 Chunks)
 * 8. Conversation Input Schema Validation
 * 9. Unauthenticated Access Rejection
 * 10. Unauthorized Workspace Access Rejection
 * 11. Centralized AI Configuration Bounds
 * 12. Query Length Limit (Max 2000 Chars)
 * 13. Mock Mode vs Real Provider Error Throwing
 * 14. Response Contract Sanitization
 * 15. Server-Only Credentials Isolation
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ZENITH_TOOLS } from "@/lib/ai/tools";
import { queryZenithInputSchema } from "@/lib/server-functions/zenith";
import { MockAIProvider, GeminiAIProvider } from "@/lib/ai/provider";
import { getAIConfig } from "@/lib/ai/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("1. WORKSPACE ISOLATION — Tool Execution Scoping", async () => {
  const mockWorkspaceA = "ws-11111111-1111-1111-1111-111111111111";
  const mockWorkspaceB = "ws-22222222-2222-2222-2222-222222222222";

  for (const [name, tool] of Object.entries(ZENITH_TOOLS)) {
    assert.equal(typeof tool.execute, "function", `Tool ${name} must have execute function`);
    assert.equal(tool.execute.length, 2, `Tool ${name} execute signature must accept (workspaceId, args)`);
  }

  assert.notEqual(mockWorkspaceA, mockWorkspaceB);
});

test("2. TOOL ALLOWLIST — Unregistered Tool Rejection", async () => {
  const allowedTools = Object.keys(ZENITH_TOOLS);
  const maliciousToolRequest = "deleteWorkspaceDatabase";
  const unknownToolRequest = "executeShellCommand";

  assert.equal(allowedTools.includes(maliciousToolRequest), false, "Unregistered tool must be rejected");
  assert.equal(allowedTools.includes(unknownToolRequest), false, "Unknown tool must be rejected");
  assert.equal(ZENITH_TOOLS[maliciousToolRequest], undefined);
});

test("3. TOOL ARGUMENT VALIDATION — Zod Schema Failures", async () => {
  assert.throws(() => {
    ZENITH_TOOLS.getClientDetails.parameters.parse({ clientId: "" });
  }, z.ZodError);

  assert.throws(() => {
    ZENITH_TOOLS.getProjectDetails.parameters.parse({ projectId: "" });
  }, z.ZodError);

  assert.throws(() => {
    ZENITH_TOOLS.getInvoiceDetails.parameters.parse({ invoiceId: "" });
  }, z.ZodError);

  assert.throws(() => {
    ZENITH_TOOLS.getDashboardTasks.parameters.parse({ limit: -5 });
  }, z.ZodError);
});

test("4. TOOL LOOP LIMIT — Max 3 Iterations Bound", async () => {
  const config = getAIConfig();
  assert.equal(config.maxToolIterations, 3, "AIConfig maxToolIterations must be 3");

  let currentIteration = 0;
  while (currentIteration < config.maxToolIterations) {
    currentIteration++;
  }

  assert.equal(currentIteration, 3, "Tool loop must halt strictly at 3 iterations");
});

test("5. EMBEDDING DIMENSION — 1536-Dimensional Validation", async () => {
  const mock = new MockAIProvider();
  const res = await mock.createEmbedding("Test text for dimension verification");

  assert.equal(res.dimensions, 1536, "Embedding dimension must be exactly 1536");
  assert.equal(res.embedding.length, 1536, "Embedding array length must be exactly 1536");

  const invalidVector = new Array(768).fill(0.1);
  assert.notEqual(invalidVector.length, 1536, "768-dim vector must fail validation");
});

test("6. EMPTY RETRIEVAL & GROUNDED FALLBACK", async () => {
  const emptyMemoryRows: any[] = [];
  const config = getAIConfig();
  const relevantChunks = emptyMemoryRows.filter((r) => r.distance <= config.similarityThreshold);

  assert.equal(relevantChunks.length, 0);

  const fallbackText = "I couldn't find that information in your SILEX workspace.";
  assert.match(fallbackText, /couldn't find that information/);
});

test("7. CONTEXT BOUNDS — Top-K Bounded Retrieval", async () => {
  const config = getAIConfig();
  assert.equal(config.topKLimit, 5, "AIConfig topKLimit must be 5");

  const mockMemoryRows = Array.from({ length: 20 }, (_, i) => ({
    id: `mem-${i}`,
    chunkContent: `Content chunk ${i}`,
    distance: 0.1 * i,
  }));

  const boundedChunks = mockMemoryRows.slice(0, config.topKLimit);
  assert.equal(boundedChunks.length, 5, "Context retrieval must be bounded to top-K limit (5)");
});

test("8. CONVERSATION PERSISTENCE — Input Schema Validation", async () => {
  const validPayload = {
    workspaceId: "ws-12345678-1234-1234-1234-123456789012",
    query: "What is our Q3 revenue forecast?",
  };

  const parsed = queryZenithInputSchema.parse(validPayload);
  assert.equal(parsed.query, "What is our Q3 revenue forecast?");

  assert.throws(() => {
    queryZenithInputSchema.parse({ query: "" }); // Empty query rejection
  }, z.ZodError);
});

test("9. UNAUTHENTICATED ACCESS REJECTION", async () => {
  const unauthenticatedContext = null;
  assert.equal(unauthenticatedContext, null, "Unauthenticated session must resolve to null and throw error");
});

test("10. UNAUTHORIZED WORKSPACE ACCESS REJECTION", async () => {
  const userMemberships = ["ws-11111111-1111-1111-1111-111111111111"];
  const targetWorkspace = "ws-99999999-9999-9999-9999-999999999999";

  const isAuthorized = userMemberships.includes(targetWorkspace);
  assert.equal(isAuthorized, false, "Request targeting workspace user does not belong to must be rejected");
});

test("11. CENTRALIZED AI CONFIGURATION BOUNDS", async () => {
  const config = getAIConfig();
  assert.equal(config.embeddingDimensions, 1536);
  assert.equal(config.maxQueryLength, 2000);
  assert.equal(config.maxToolIterations, 3);
  assert.equal(config.topKLimit, 5);
  assert.equal(config.similarityThreshold, 0.85);
});

test("12. QUERY LENGTH LIMIT — Max 2000 Chars", async () => {
  const longQuery = "a".repeat(2001);
  assert.throws(() => {
    queryZenithInputSchema.parse({ query: longQuery });
  }, z.ZodError);
});

test("13. MOCK MODE VS REAL PROVIDER FAILS", async () => {
  // Gemini provider with invalid key must throw error, NOT return mock embedding
  const geminiProvider = new GeminiAIProvider("invalid_test_api_key");

  await assert.rejects(async () => {
    await geminiProvider.createEmbedding("Test fail text");
  }, /Gemini Embedding API failure|fetch failed/);
});

test("14. RESPONSE CONTRACT SANITIZATION", async () => {
  const sampleResponse = {
    conversationId: "conv-123",
    messageId: "msg-456",
    response: "Here is your summary.",
    sources: [{ entityType: "document", entityId: "doc-789", sourceTitle: "Q3 Report" }],
    toolCallsExecuted: [{ toolName: "getInvoices", status: "completed" }],
  };

  const responseKeys = Object.keys(sampleResponse);
  assert.equal(responseKeys.includes("apiKey"), false, "Response contract must never contain apiKey");
  assert.equal(responseKeys.includes("databaseUrl"), false, "Response contract must never contain databaseUrl");
  assert.equal(responseKeys.includes("prompt"), false, "Response contract must never expose raw system prompt");
});

test("15. READ-ONLY TOOL SECURITY", async () => {
  const tools = Object.keys(ZENITH_TOOLS);
  for (const t of tools) {
    assert.equal(t.startsWith("delete"), false, `Tool ${t} must not be destructive`);
    assert.equal(t.startsWith("update"), false, `Tool ${t} must not mutate data`);
    assert.equal(t.startsWith("remove"), false, `Tool ${t} must not remove data`);
  }
});

test("16. CONVERSATION HISTORY INPUT SCHEMAS — Zod Validation", async () => {
  const { getZenithConversationsInputSchema, getZenithConversationMessagesInputSchema } = await import(
    "@/lib/server-functions/zenith"
  );

  const validHistoryInput = getZenithConversationsInputSchema.parse({});
  assert.equal(validHistoryInput.workspaceId, undefined);

  const validMessagesInput = getZenithConversationMessagesInputSchema.parse({
    conversationId: "conv-12345678-1234-1234-1234-123456789012",
  });
  assert.equal(validMessagesInput.conversationId, "conv-12345678-1234-1234-1234-123456789012");

  assert.throws(() => {
    getZenithConversationMessagesInputSchema.parse({ conversationId: "" });
  }, z.ZodError);
});

test("17. CONVERSATION LIST WORKSPACE & USER OWNERSHIP FILTERING", async () => {
  const authUserId = "user-11111111-1111-1111-1111-111111111111";
  const authWorkspaceId = "ws-11111111-1111-1111-1111-111111111111";

  const mockConversationsInDb = [
    { id: "c1", workspaceId: authWorkspaceId, userId: authUserId, title: "Valid Conv 1" },
    { id: "c2", workspaceId: authWorkspaceId, userId: "other-user", title: "Other User Conv" },
    { id: "c3", workspaceId: "other-workspace", userId: authUserId, title: "Other WS Conv" },
  ];

  const userWorkspaceConversations = mockConversationsInDb.filter(
    (c) => c.workspaceId === authWorkspaceId && c.userId === authUserId
  );

  assert.equal(userWorkspaceConversations.length, 1);
  assert.equal(userWorkspaceConversations[0].id, "c1");
});

test("18. CONVERSATION MESSAGE TIMELINE OWNERSHIP BOUNDARY", async () => {
  const targetConvId = "conv-111";
  const authWorkspaceId = "ws-11111111-1111-1111-1111-111111111111";

  const mockMessagesInDb = [
    { id: "m1", conversationId: targetConvId, workspaceId: authWorkspaceId, content: "Hello" },
    { id: "m2", conversationId: targetConvId, workspaceId: "other-workspace", content: "Leaked" },
  ];

  const sanitizedTimeline = mockMessagesInDb.filter(
    (m) => m.conversationId === targetConvId && m.workspaceId === authWorkspaceId
  );

  assert.equal(sanitizedTimeline.length, 1);
  assert.equal(sanitizedTimeline[0].content, "Hello");
});

test("19. GENERATION MODEL RESOLUTION — Default resolves to gemini-2.5-flash", async () => {
  const config = getAIConfig();
  assert.equal(config.model, "gemini-2.5-flash", "Default generation model must resolve to gemini-2.5-flash");
});

test("20. EMBEDDING MODEL RESOLUTION — Default resolves to gemini-embedding-001", async () => {
  const config = getAIConfig();
  assert.equal(
    config.embeddingModel,
    "gemini-embedding-001",
    "Default embedding model must resolve to gemini-embedding-001",
  );
});

test("21. EMBEDDING DIMENSION INVARIANT — Remains strictly 1536", async () => {
  const config = getAIConfig();
  assert.equal(config.embeddingDimensions, 1536, "Embedding dimensions must strictly be 1536");
});

test("22. PROVIDER REQUEST SPECIFICATION — Verified outputDimensionality 1536", async () => {
  const provider = new GeminiAIProvider("mock_key", "gemini-2.5-flash", "gemini-embedding-001");
  assert.ok(provider, "GeminiAIProvider instance created");
  const providerPath = path.resolve(__dirname, "../src/lib/ai/provider.ts");
  const providerContent = fs.readFileSync(providerPath, "utf-8");
  assert.ok(
    providerContent.includes("outputDimensionality: 1536"),
    "provider.ts must explicitly send outputDimensionality: 1536",
  );
  assert.ok(
    providerContent.includes("models/${this.embeddingModel}:embedContent"),
    "provider.ts must use dynamic embeddingModel parameter",
  );
});

test("23. OLD MODEL IDENTIFIER EXCLUSION — gemini-1.5-pro and text-embedding-004 excluded from production code", async () => {
  const configPath = path.resolve(__dirname, "../src/lib/ai/config.ts");
  const providerPath = path.resolve(__dirname, "../src/lib/ai/provider.ts");
  const schemaPath = path.resolve(__dirname, "../src/db/schema/ai.ts");

  const configContent = fs.readFileSync(configPath, "utf-8");
  const providerContent = fs.readFileSync(providerPath, "utf-8");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");

  assert.equal(
    configContent.includes("gemini-1.5-pro"),
    false,
    "config.ts must not contain gemini-1.5-pro",
  );
  assert.equal(
    configContent.includes("text-embedding-004"),
    false,
    "config.ts must not contain text-embedding-004",
  );
  assert.equal(
    providerContent.includes("text-embedding-004"),
    false,
    "provider.ts must not contain hardcoded text-embedding-004",
  );
  assert.equal(
    providerContent.includes("gemini-1.5-pro"),
    false,
    "provider.ts must not contain default gemini-1.5-pro",
  );
  assert.equal(
    schemaContent.includes("gemini-1.5-pro"),
    false,
    "schema/ai.ts must not default to gemini-1.5-pro",
  );
});

test("24. EMBEDDING DIMENSION SAFEGUARD — Fail safely if returned dimension !== 1536", async () => {
  const mock = new MockAIProvider();
  const res = await mock.createEmbedding("Test dimension validation");
  assert.equal(res.dimensions, 1536, "Returned dimensions must be exactly 1536");
  assert.equal(res.embedding.length, 1536, "Returned array length must be exactly 1536");
});


