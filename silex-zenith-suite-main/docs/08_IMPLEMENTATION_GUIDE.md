# Developer Implementation Guide & Post-Task Protocol

## 1. Codebase Directory Map

```
silex-zenith-suite-main/
├── docs/                         # Central Project Documentation Suite
│   ├── 01_PRD.md
│   ├── 02_TECH_STACK.md
│   ├── 03_APP_FLOW.md
│   ├── 04_DATABASE_SCHEMA.md
│   ├── 05_SECURITY.md
│   ├── 06_DESIGN_SYSTEM.md
│   ├── 07_DEPLOYMENT.md
│   ├── 08_IMPLEMENTATION_GUIDE.md
│   ├── 09_STATUS_AND_ROADMAP.md
│   ├── 10_TASK_TRACKER.md
│   └── README.md
├── drizzle/                      # Generated SQL Migrations
├── public/                       # Static Public Assets
├── src/
│   ├── components/               # React Components
│   │   ├── silex/                # Silex Zenith Layout & Feature Shells (AppShell, AIDock)
│   │   └── ui/                   # Reusable UI Primitives (Buttons, Dialogs, Tables)
│   ├── db/                       # Database Schema & Runtime Client
│   │   ├── index.ts              # Server-Side Drizzle ORM Singleton Client (db)
│   │   └── schema/               # Drizzle ORM Schema Domain Files (41 Tables)
│   ├── hooks/                    # Custom React Hooks
│   ├── lib/                      # Core Libraries & Utilities
│   │   └── supabase/             # Supabase SSR & Client Setup
│   ├── routes/                   # TanStack Router File-Based Pages & API Endpoints
│   ├── router.tsx                # TanStack Router Setup
│   ├── server.ts                 # Nitro Server Entrypoint
│   └── styles.css                # Global Tailwind CSS v4 Styling Tokens
├── drizzle.config.ts             # Drizzle Kit Configuration
├── package.json                  # NPM Project Dependencies & Scripts
└── vite.config.ts                # Vite & TanStack Plugin Configuration
```

---

## 2. Coding Conventions & Best Practices

1. **TypeScript Strict Mode**: Avoid `any` types. Utilize type definitions exported directly from Drizzle ORM schemas or Zod infer types:
   ```typescript
   import type { Client } from "@/db/schema";
   ```
2. **Database Runtime Handle (`src/db/index.ts`)**:
   - The database client instance (`import { db } from "@/db"`) is a **SERVER-ONLY SINGLETON**.
   - NEVER import `src/db/index.ts` or `@/db` in browser-rendered React components.
   - Database queries MUST execute exclusively inside TanStack Start server functions (`createServerFn`).
   - `DATABASE_URL` is read strictly from server-side process environment and must never be exposed via `VITE_*` variables.
3. **User Auto-Provisioning Lifecycle & Server Auth Context (`src/lib/supabase/server-context.ts`)**:
   - When a user signs up via Supabase Auth, PostgreSQL trigger `handle_new_user()` (`supabase/migrations/20260914000000_auto_provision_users.sql`) automatically inserts a corresponding row into `public.users`.
   - Server functions MUST resolve user identity via `getServerAuthContext(cookieAdapter)` which validates the Supabase session token and returns `{ authUser, userId, appUser }`.
   - Server functions MUST NOT trust user IDs or `workspace_id` parameters sent arbitrarily from browser requests.
4. **Workspace Authorization & Membership Verification (`src/lib/auth/workspace.ts`)**:
   - `requireWorkspaceAccess({ workspaceId, requiredRole })` derives the authenticated user via `getServerAuthContext()`.
   - Checks `workspace_members` table for matching `user_id` and `workspace_id` (or resolves default workspace if omitted).
   - Enforces membership verification before any workspace-scoped Drizzle query executes.
   - Throws structured authorization errors (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`).
5. **CRM Server Function Architecture (`src/lib/server-functions/crm.ts`)**:
   - Built using TanStack Start `createServerFn({ method: 'GET' | 'POST' })`.
   - Validates input payloads using Zod schemas (`getClientsInputSchema`, `createClientInputSchema`, `getClientByIdInputSchema`).
   - Server functions execute inside server boundaries and return sanitized Drizzle ORM query results.
6. **Finance Server Function Architecture & Monetary Precision (`src/lib/server-functions/invoices.ts`)**:
   - Includes `getInvoicesFn`, `getInvoiceByIdFn`, `createInvoiceFn`, `getPaymentsFn`, and `createPaymentFn`.
   - **Sequential Numbering Strategy**: Atomically reads and increments `workspace_settings.invoiceNextNumber` within a Drizzle transaction (`INV-1001`, `INV-1002`). Rejects frontend invoice number manipulation.
   - **Monetary Precision**: All financial amounts (`subtotalCents`, `taxCents`, `discountCents`, `totalCents`, `amountPaidCents`) are processed and persisted as integer cents (`Math.round(amount * 100)`). Floating-point persistence is forbidden.
   - **Transaction Boundaries**: Invoice and line item insertions (`invoices` + `invoice_items`) execute inside `db.transaction()` blocks to prevent orphaned records.
   - **Payment Verification**: Payments verify that the referenced `invoiceId` belongs strictly to the authorized workspace before updating `invoices.amountPaidCents` and status.
7. **Projects & Dashboard Architecture (`src/lib/server-functions/projects.ts`)**:
   - Includes `getProjectsFn`, `getProjectByIdFn`, `createProjectFn`, and `getDashboardTasksFn`.
   - Enforces workspace authorization (`requireWorkspaceAccess`) and client relationship validation.
   - **Dashboard Data Aggregation (`src/routes/app.index.tsx`)**: Combines real database queries from `getInvoicesFn()`, `getClientsFn()`, `getProjectsFn()`, and `getDashboardTasksFn()`.
   - **Mock-Data Policy**: Mock data is strictly replaced with real database query results. When the workspace database contains no records, routes present clean empty/zero state indicators without fabricating persisted data.
8. **AI Zenith Server Architecture & Provider Abstraction (`src/lib/ai/`)**:
   - **Server-Only Boundary**: `src/lib/ai/config.ts` enforces `typeof window !== "undefined"` guards to guarantee AI credentials (`GEMINI_API_KEY`, `OPENAI_API_KEY`) are never imported or bundled into client code.
   - **Supported Engines**: Primary Google Gemini Engine (`gemini-2.5-flash`, `gemini-embedding-001`), with `MockAIProvider` fallback when credentials are unconfigured.
   - **Vector Dimension Standard**: `ai_memory` schema (`extensions.vector(1536)`) standardizes 1536-dimensional embeddings. Changing embedding models requires regenerating embeddings if existing rows are present; currently `ai_memory` contains zero rows. Retrieval threshold calibration remains pending live evaluation.
9. **RAG Vector Ingestion & Chunking Pipeline (`src/lib/ai/chunking.ts`, `src/lib/server-functions/ai-ingestion.ts`)**:
   - **Supported Ingestion Scope**: `documents`, `tasks`, and `client_notes` ONLY. Auth tokens, keys, passwords, and private configurations are strictly excluded.
   - **Deterministic Text Normalization & Chunking**: `normalizeText` cleans whitespace and line breaks. `chunkText` extracts bounded chunks (~800 characters, ~150 character overlap) while preserving sentence boundaries and source metadata (`sourceTitle`, `entityType`, `entityId`, `chunkIndex`, `totalChunks`, `contentHash`).
   - **Deduplication Strategy**: Computes SHA-256 `contentHash` of normalized source content. Re-ingestion compares `metadata.contentHash` in `ai_memory` and skips embedding generation if content is unchanged.
   - **Safety & Error Handling**: On changed content, replaces old memory rows within `db.transaction()`. If embedding fails or produces invalid dimensions (!== 1536), throws an explicit error and aborts transaction without creating zero/fake vector rows.
   - **Workspace Isolation Boundary**: All ingestion server functions (`indexDocumentFn`, `indexTaskFn`, `indexClientNoteFn`, `reindexWorkspaceMemoryFn`) enforce `requireWorkspaceAccess({ workspaceId })`. Client-provided workspace IDs are untrusted.
10. **AI Zenith Query Engine & Tool Calling (`src/lib/ai/tools.ts`, `src/lib/server-functions/zenith.ts`)**:
   - **Server Function Boundary**: `queryZenithFn` executes inside TanStack Start server functions using `requireWorkspaceAccess({ workspaceId })`. Client payloads cannot bypass session authorization or access arbitrary workspaces.
   - **Semantic RAG Retrieval**: Generates 1536-dimensional query embedding via `provider.createEmbedding()`, performs vector similarity search on `ai_memory` (`<=>` cosine operator), filters by `ai_memory.workspace_id = auth.workspaceId`, and bounds output to top-K relevant chunks.
   - **Read-Only Tool Registry**: `ZENITH_TOOLS` in `src/lib/ai/tools.ts` defines explicit read-only workspace tools (`getClients`, `getClientById`, `getProjects`, `getProjectById`, `getInvoices`, `getInvoiceById`, `getPayments`, `getDashboardTasks`). Destructive mutations are strictly prohibited.
   - **Bounded Tool Loop**: Tool decisions execute within a hard loop bound (maximum 3 iterations). Tool calls are logged in `ai_tool_calls` table and results are appended to prompt context.
   - **System Prompt Grounding**: System prompt strictly instructs Zenith to use retrieved workspace context and real-time tool outputs. If facts are absent, Zenith states "I couldn't find that information in your SILEX workspace" rather than inventing data.
   - **Conversation Persistence**: Conversation metadata is stored in `ai_conversations`, messages in `ai_messages`, and tool logs in `ai_tool_calls`.
11. **Realtime Collaboration & WebSockets Architecture (`src/hooks/use-realtime-notifications.ts`, `src/lib/server-functions/notifications.ts`)**:
    - **Notification Server Functions**: `getNotificationsFn`, `markNotificationReadFn`, `markAllNotificationsReadFn`, `createNotificationFn` enforce workspace access (`requireWorkspaceAccess`) and recipient user ID isolation (`notifications.recipient_user_id = auth.userId`).
    - **Task Comments Server Functions**: `getTaskCommentsFn`, `createTaskCommentFn` in `src/lib/server-functions/projects.ts` enforce workspace scoping (`task_comments.workspace_id = auth.workspaceId`) and assign `authorId` from server auth context.
    - **Supabase Realtime WebSockets**: Client hook `useRealtimeNotifications` subscribes to `postgres_changes` on `notifications` table over WebSockets scoped to `workspaceId` and `recipientUserId`. Channel topic naming (`notifs:${workspaceId}:${recipientUserId}`) ensures clean tear-down and subscription re-initialization on workspace/user context changes.
    - **UI Integration**: Header notification bell in `AppShell` displays unread count badges and auto-increments on live WebSocket events. Notification Center `/app/notifications` persists changes to PostgreSQL with optimistic UI updates.
12. **Domain Event & Transactional Outbox Architecture (`src/lib/events/`)**:
    - **Event Publisher**: `publishDomainEvent(params, tx)` publishes structured, typed domain events (`events`) and outbox records (`outbox_events`).
    - **Transaction Integration**: Server function mutations (`createClientFn`, `createProjectFn`, `createTaskCommentFn`, `createInvoiceFn`, `createPaymentFn`) execute event publishing synchronously inside Drizzle ORM transactions (`tx`) to guarantee atomic rollback if the business mutation fails. Fire-and-forget unawaited Promises are strictly prohibited for event persistence.
    - **Event Types**: Supported domain events include `client.created`, `project.created`, `comment.created`, `invoice.created`, `payment.created`, `invoice.paid`, `task.created`, `task.updated`, `task.completed`.
    - **Payload Sanitization**: Payloads pass through `sanitizeEventPayload()` to automatically strip sensitive credentials (`password`, `token`, `secret`, `keyHash`).
13. **Automation Condition Engine & Action Registry Architecture (`src/lib/automation/`)**:
    - **Condition Engine (`src/lib/automation/conditions.ts`)**: Evaluates trigger conditions (`evaluateCondition`, `evaluateConditions`) against context payloads using 8 allowlisted operators (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `in`). Dot-notation field path resolution (`resolveFieldPath`) blocks prototype pollution (`__proto__`, `constructor`, `prototype`) and bounds path length (max 100 chars, max 5 levels depth).
    - **Action Registry (`src/lib/automation/actions.ts`)**: Static allowlist map (`ACTION_REGISTRY`) exposing 4 action handlers (`create_notification`, `create_audit_log`, `update_task_status`, `dispatch_webhook`).
    - **Trusted Context Enforcement**: Action handlers execute against `TrustedExecutionContext` (`workspaceId`, `actorUserId`, `event`, `correlationId`). Parameters cannot override trusted `workspaceId` or cross workspace boundaries.
    - **Network Safety**: `dispatch_webhook` validates `webhookId` ownership and payload size (max 16KB), building a dispatch intent descriptor without executing network calls or `fetch()`. Actual HTTP delivery is handled in M5.4.
14. **Workflow Execution Engine & Outbox Processor (`src/lib/automation/processor.ts`, `runner.ts`)**:
    - **Atomic Outbox Claiming**: `claimPendingOutboxEvents(executor, batchSize)` uses PostgreSQL row locking `FOR UPDATE SKIP LOCKED` inside single transactions. Bounded batch size (default 10, max 100).
    - **Stale Processing Claim Recovery**: `recoverStaleProcessingClaims(executor)` resets processing claims older than 5 minutes (`claimed_at < NOW() - 5m`) with `retry_count < 3` to `pending`, and fails claims with `retry_count >= 3`.
    - **Workflow Execution Runner**: `executeWorkflowForOutboxEvent(outboxEvent, executor)` queries enabled rules matching trigger event & workspace, constructs `TrustedExecutionContext` using `outbox_events.actor_id`, and executes per-rule transactions.
    - **Rule-Level Idempotency**: Atomically reserves key `auto_run:{ruleId}:{outboxEventId}` in `idempotency_keys` table using `INSERT ... ON CONFLICT DO NOTHING`. If conflict occurs, rule execution is safely skipped.
    - **Server Entrypoint**: `processOutboxBatchFn(batchSize, executor)` exposes the server-side processor execution entrypoint for cron/edge triggers.
15. **Webhook Delivery Dispatcher Subsystem (`src/lib/automation/webhooks.ts`, `src/lib/automation/dispatcher.ts`)**:
    - **Security & Cryptography Helpers**: `generateHmacSignature` (Web Crypto API `crypto.subtle` HMAC-SHA256 with canonical input `t={timestamp}.{rawJSONPayload}`), `validateWebhookTargetUrl` (SSRF pre-flight check enforcing HTTPS-only, default port 443, rejecting localhost/loopback/RFC1918/IMDS/IPv6), `calculateExponentialBackoff` (retry schedule 10s, 60s, 300s, 1800s with ±10% jitter), `classifyWebhookResponse` (2xx delivered, 4xx non-retryable failed, 3xx manual redirect security failure, 429/408/5xx/network retryable pending), `boundedResponseBodyReader` (truncates response body to 2KB max with `[TRUNCATED]`).
    - **Atomic Delivery Claiming**: `claimPendingWebhookDeliveries` uses PostgreSQL `FOR UPDATE SKIP LOCKED` to claim pending delivery rows in bounded batches (1-100, default 10).
    - **Stale Claim Recovery**: `recoverStaleWebhookClaims` resets processing claims older than 5 minutes (`claimed_at < NOW() - 5m`) back to `pending`.
    - **3-Phase Execution Model**: Phase 1 (DB transaction claim) -> Phase 2 (Outbound HTTP `fetch` with zero DB locks held, 10s `AbortSignal` timeout, `redirect: "manual"`) -> Phase 3 (DB transaction commit result).
    - **Retry Limits**: Maximum 5 total HTTP attempts ($0, 1, 2, 3, 4$ consumed retries). At `consumedRetries >= 4`, status transitions to terminal `'failed'`. No 6th attempt.
    - **Server Batch Processor Entrypoint**: `processWebhookDeliveryBatchFn(batchSize, executor)` exposes the server-side entrypoint.
16. **Automation Server Functions & Worker Security (`src/lib/server-functions/automation.ts`)**:
    - **Rule & Webhook Management**: 15 production server functions handling Rule CRUD, execution run history, and webhook delivery management.
    - **Worker Authorization Boundary**: `triggerAutomationOutboxWorkerFn` and `triggerWebhookDeliveryWorkerFn` enforce server-side `Authorization: Bearer <CRON_SECRET>` header verification against `process.env.CRON_SECRET` using timing-safe comparison (`timingSafeEqualStrings`) for cron triggers, or `requireWorkspaceAccess({ workspaceId, requiredRole: "admin" })` for manual Admin/Owner execution.
    - **Public Schema Hardening**: `cronSecret` is strictly removed from public Zod request input schemas (`batchSize?: number` bounded to $1 \le \text{batchSize} \le 100$). Secrets are never exposed, logged, or accepted as public payload parameters.
17. **API & Data Query Patterns**: Wrap database calls in server functions (`createServerFn`) or custom React Query hooks (`useQuery`, `useMutation`).
18. **Form Validation**: Always validate user input with Zod schemas and `@hookform/resolvers/zod`.



---

## 3. Post-Task Maintenance Protocol (MANDATORY)

To keep documentation perpetually up to date with code changes, **every developer and AI coding assistant must perform the following post-task checklist upon completing any code modification**:

### Post-Task Documentation Checklist:

1. **Database Changes**:
   - _Trigger_: Modifying or adding any file in `src/db/schema/*.ts`.
   - _Action_: Update table descriptions, columns, or relations in [`docs/04_DATABASE_SCHEMA.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/04_DATABASE_SCHEMA.md).

2. **Route or Navigation Changes**:
   - _Trigger_: Creating, deleting, or renaming routes in `src/routes/*.tsx`.
   - _Action_: Update layout diagrams, route paths, and user flows in [`docs/03_APP_FLOW.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/03_APP_FLOW.md).

3. **Package & Tooling Updates**:
   - _Trigger_: Running `npm install` or changing `package.json`.
   - _Action_: Update dependencies table in [`docs/02_TECH_STACK.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/02_TECH_STACK.md).

4. **Feature & Task Progress**:
   - _Trigger_: Resolving a bug, completing a task, or delivering a roadmap feature.
   - _Action_: Update status badges in [`docs/09_STATUS_AND_ROADMAP.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/09_STATUS_AND_ROADMAP.md) and check off tasks in [`docs/10_TASK_TRACKER.md`](file:///d:/minii%20projects/silex2.0/silex-zenith-suite-main/docs/10_TASK_TRACKER.md).
