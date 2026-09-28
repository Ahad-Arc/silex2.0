# Security Architecture — Silex Zenith Suite

## 1. Authentication & Session Management

- **Provider**: **Supabase Auth** (`@supabase/supabase-js`, `@supabase/ssr`).
- **Session Tokens**: PKCE-based flow storing encrypted session refresh tokens in HTTP-only `sameSite: "lax"` secure cookies.
- **Session Tracking**: Active user sessions are tracked in `sessions` table with token hashes (`token_hash`), IP addresses, user agents, and expiration times.
- **OAuth Providers**: Native support for Google, GitHub, and custom SAML/OIDC enterprise providers.

### User Auto-Provisioning (`auth.users` ➔ `public.users`)

- **Database Trigger**: New Supabase Auth registrations fire PostgreSQL trigger `handle_new_user()` (`supabase/migrations/20260914000000_auto_provision_users.sql`) which automatically creates or updates the user record in `public.users`.
- **Identity Retention**: The `auth.users` UUID (`new.id`) is preserved as `public.users.id` primary key for 1:1 identity mapping across foreign keys.

### Server Authentication Context (`getServerAuthContext`)

- **Helper**: `src/lib/supabase/server-context.ts` provides `getServerAuthContext(cookieAdapter)` for server functions.
- **Verification**: Validates the JWT session via `@supabase/ssr` `getUser()`, reads `public.users` via Drizzle ORM, and returns `{ authUser, userId, appUser }`.
- **Browser Boundary**: Strictly server-only with runtime `typeof window !== "undefined"` guard to prevent execution or credentials leakage in browser bundles.
- **Client Non-Trust**: Server functions MUST NOT trust user IDs or `workspace_id` parameters sent arbitrarily from browser payloads.
- **Authentication Failure**: Supabase JWT authentication failure strictly throws `AuthContextError("UNAUTHENTICATED")`. Server context NEVER fabricates authenticated users, workspace memberships, or admin roles.

### Authentication Boundary Invariants

1. **No Browser-Controlled Authentication Bypass**:
   - `localStorage` cannot establish an authenticated state under any circumstances.
   - Route guard helper `requireAuthGuard` strictly verifies authoritative session state via `supabase.auth.getSession()`. Unauthenticated requests redirect to `/auth`.
2. **Zero Hardcoded Identities**:
   - Server authentication context never fabricates fallback identities or demo user records (`018f6730-1000-7000-8000-000000000001` completely eliminated).
3. **Authoritative Environment Configuration**:
   - `src/lib/supabase/config.ts` strictly resolves `supabaseUrl` and `supabaseAnonKey` from environment variables (`VITE_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY`).
   - Zero hardcoded fallback credentials exist in source code. Missing environment variables throw explicit runtime exceptions.

### Workspace Authorization Scoping Chain (`requireWorkspaceAccess`)

- **Helper**: `src/lib/auth/workspace.ts` provides `requireWorkspaceAccess({ workspaceId, requiredRole })`.
- **Trust Boundary & Authorization Chain**:
  ```
  Authenticated User (Supabase Session)
        ↓
  getServerAuthContext()
        ↓
  Query workspace_members (user_id = authenticated_user.id)
        ↓
  Verify workspace_id match & active membership status
        ↓
  Authorized Workspace Context
        ↓
  Server Function Execution
        ↓
  Workspace-Scoped Drizzle Query
  ```
- **Untrusted Client Inputs**: Browser-supplied `workspace_id` parameter is NEVER trusted directly. If supplied, `requireWorkspaceAccess()` verifies that the authenticated user actually has active membership in `workspace_members` for that specific `workspace_id`. If omitted, it derives the user's default workspace from `workspace_members`.

### Finance & Payment Authorization Scoping Chain

- **Authorization Hierarchy**:
  ```
  Authenticated User (Supabase Session)
        ↓
  getServerAuthContext()
        ↓
  requireWorkspaceAccess()
        ↓
  Verify Client Ownership (clients.workspace_id = authorized_workspace_id)
        ↓
  Atomic Invoice & Items Transaction (invoices + invoice_items)
        ↓
  Verify Invoice Ownership for Payments (invoices.workspace_id = authorized_workspace_id)
        ↓
  Payment Ledger Insertion & Invoice Status Sync
  ```
- **Security Protections**:
  1. Client-supplied invoice numbers are ignored; numbers are generated atomically server-side from `workspace_settings`.
  2. Users cannot attach invoices to clients from another workspace.
  3. Users cannot record payments against invoices belonging to another workspace.

### Projects & Tasks Authorization Scoping Chain

- **Authorization Hierarchy**:
  ```
  Authenticated User (Supabase Session)
        ↓
  getServerAuthContext()
        ↓
  requireWorkspaceAccess()
        ↓
  Verify Project Workspace Ownership (projects.workspace_id = authorized_workspace_id)
        ↓
  Verify Task Workspace Ownership (tasks.workspace_id = authorized_workspace_id)
  ```
- **Security Protections**:
  1. All project queries filter by `projects.workspace_id = authorized_workspace_id`.
  2. All task queries filter by `tasks.workspace_id = authorized_workspace_id`.
  3. Projects referencing a client verify that `clients.workspace_id` matches the authorized workspace.

### AI Zenith Security & Privacy Boundaries (`src/lib/ai/`)

- **Server-Only Execution**: AI requests execute strictly within TanStack Start server functions. Browser components (`AIDock`, `/app/ai`) cannot directly query AI provider APIs.
- **Credentials Privacy**: AI API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`) are read strictly from process environment variables and are protected by `typeof window !== "undefined"` guards in `src/lib/ai/config.ts`.
- **Multi-Tenant Memory Isolation**: All AI vector memory operations (`ai_memory`) enforce explicit workspace scoping (`ai_memory.workspace_id = authorized_workspace_id`). Cross-workspace vector memory retrieval or insertion is strictly prohibited.
- **RAG Ingestion Scoping Chain (`src/lib/server-functions/ai-ingestion.ts`)**:
  ```
  Authenticated User (Supabase Session)
        ↓
  getServerAuthContext()
        ↓
  requireWorkspaceAccess()
        ↓
  Authorized Workspace Context
        ↓
  Fetch Entity (documents / tasks / client_notes) with workspace_id filter
        ↓
  Generate 1536-dim Embedding Vector (or throw explicit error on provider failure)
        ↓
  Replace / Insert ai_memory (workspace_id = authorized_workspace_id)
  ```
- **Allowed Source Rules**: Ingestion is restricted to `documents`, `tasks`, and `client_notes`. System secrets, passwords, auth tokens, and raw credentials can never be indexed into `ai_memory`.
- **Embedding Failure Safety**: If an embedding provider returns an error or dimension mismatch, the ingestion transaction fails safely. Storing fake zero/random/placeholder vectors is strictly prohibited.
- **Embedding Standard & Model Lineage**: Native 1536-dimensional embeddings generated via `gemini-embedding-001` (`outputDimensionality: 1536`) stored in `extensions.vector(1536)`. Generation powered by `gemini-3.6-flash`. If an embedding model migration occurs with existing embeddings, vectors must be re-generated (current `ai_memory` row count is 0; retrieval threshold calibration remains pending live verification).

### AI Zenith Query Engine & Production AI Boundary (`src/lib/server-functions/zenith.ts`)

- **Authorization Hierarchy**:
  ```
  Authenticated User (Supabase Session)
        ↓
  getServerAuthContext()
        ↓
  requireWorkspaceAccess()
        ↓
  Authorized Workspace Context
        ↓
  Verify Conversation Workspace & User Ownership (ai_conversations.workspace_id = auth.workspaceId AND user_id = auth.userId)
        ↓
  Vector Search on ai_memory (WHERE workspace_id = authorized_workspace_id)
        ↓
  Read-Only Tool Execution (ZENITH_TOOLS with workspace_id scoping)
        ↓
  Persist ai_conversations, ai_messages, ai_tool_calls (workspace_id = authorized_workspace_id)
        ↓
  Sanitized ZenithQueryResponse (no raw prompts, stack traces, or credentials exposed)
  ```
- **Security Protections**:
  1. The LLM is NEVER a security boundary. Even if a prompt asks to query another workspace ID, tool handlers explicitly overwrite and enforce `auth.workspaceId`.
  2. All Zenith tools in Milestone 2 are strictly READ-ONLY. Destructive mutations, deletions, financial modifications, and external side effects are prohibited.
  3. Tool arguments are strictly validated against Zod schemas (`ZENITH_TOOLS[name].parameters.parse()`) prior to tool execution.
  4. Tool loops are hard-bounded to a maximum of 3 iterations per query to prevent unbounded AI loops or cost amplification (`maxToolIterations: 3`).
  5. Conversation lookup explicitly verifies `conversation.workspaceId === auth.workspaceId` AND `conversation.userId === auth.userId`. Rejects cross-user or cross-workspace conversation spoofing.
  6. Public response contract `ZenithQueryResponse` exposes strictly `{ conversationId, messageId, content, sources, toolCalls, usage }`. Secrets, internal prompts, raw DB errors, and stack traces are stripped.


## 2. Multi-Tenant Authorization & RBAC

### Tenant Isolation (`workspace_id`)

Every data query executed in the backend must include an explicit filter condition for `workspace_id` matching the user's current active workspace in their session:

```typescript
// Mandatory Multi-Tenant Query Scoping
const activeWorkspaceId = session.activeWorkspaceId;

const clientRecords = await db
  .select()
  .from(clients)
  .where(and(eq(clients.workspaceId, activeWorkspaceId), isNull(clients.deletedAt)));
```

### Role-Based Access Control (RBAC)

- System Roles: `owner`, `admin`, `member`, `guest`.
- Custom Roles (`workspace_roles`): Custom permissions array stored in JSON format (e.g. `["invoices:create", "clients:delete"]`).
- Middleware Enforcement: Server functions and route loaders verify role permissions before mutating or returning sensitive data.

---

## 3. Database Row-Level Security (RLS) & Realtime Security

All database tables in Supabase have **Row Level Security (RLS)** enabled. Standard policy templates enforce tenant and recipient boundaries:

```sql
-- Multi-Tenant Workspace RLS Policy (Clients, Projects, Tasks, Invoices, Task Comments)
CREATE POLICY task_comments_tenant_isolation ON task_comments
    FOR ALL
    USING (
        workspace_id IN (
            SELECT public.get_user_workspace_ids(auth.uid())
        )
    );

-- Recipient & Workspace User Isolation Policy (Notifications)
CREATE POLICY notifications_user_isolation ON notifications
    FOR ALL
    USING (
        recipient_user_id = auth.uid()
        AND workspace_id IN (
            SELECT public.get_user_workspace_ids(auth.uid())
        )
    );
```

### Realtime WebSocket Security Architecture (`src/hooks/use-realtime-notifications.ts`)

1. **Security Boundary vs Filtering Optimization**:
   - Client-side WebSocket filter (`filter: workspace_id=eq.<workspaceId>`) is strictly a **client filtering optimization** to avoid rendering local events across workspace switches.
   - **PostgreSQL Row Level Security (RLS)** is the **unbypassable security boundary**. Supabase Realtime checks PostgreSQL RLS policies under the subscriber's JWT identity (`auth.uid()`) before broadcasting any row event (`INSERT`, `UPDATE`, `DELETE`).
   - Unauthorized users cannot receive notifications intended for other users or comments belonging to unauthorized workspaces, regardless of client filter parameters.
2. **Realtime Channel Topic Strategy & Lifecycle**:
   - Channel topic naming format: `notifs:${workspaceId}:${recipientUserId}`.
   - Subscriptions are strictly isolated by workspace ID and recipient user ID.
   - `useRealtimeNotifications` hook automatically tears down and cleans up previous WebSocket channels on component unmount or when `workspaceId` / `recipientUserId` dependencies change, preventing stale subscriptions or memory leaks.
3. **Publication & Grants**:
   - Tables `notifications` and `task_comments` are registered in Supabase `supabase_realtime` publication (`ALTER PUBLICATION supabase_realtime ADD TABLE notifications, task_comments;`).
   - Grants restricted to `authenticated` and `service_role` roles. Browser code never uses service-role credentials.

---

## 4. Secret & Environment Variable Management

All sensitive secrets are loaded via process environment variables and MUST NEVER be committed to Git:

| Variable Name               | Sensitivity         | Purpose                                                  |
| :-------------------------- | :------------------ | :------------------------------------------------------- |
| `VITE_SUPABASE_URL`         | Public / Safe       | Supabase project API gateway endpoint.                   |
| `VITE_SUPABASE_ANON_KEY`    | Public / Safe       | Supabase anonymous client key for public requests.       |
| `SUPABASE_SERVICE_ROLE_KEY` | **CRITICAL SECRET** | Supabase admin key used ONLY in secure server functions. |
| `DATABASE_URL`              | **CRITICAL SECRET** | Postgres connection string for Drizzle ORM queries.      |
| `STRIPE_SECRET_KEY`         | **CRITICAL SECRET** | Secret API key for Stripe payment processing.            |
| `STRIPE_WEBHOOK_SECRET`     | **CRITICAL SECRET** | HMAC signing secret for validating Stripe webhooks.      |

---

## 5. Input Validation & API Protection

1. **Zod Runtime Schema Validation**: All user inputs (forms, API payloads, route params) are validated via Zod schemas before hitting business logic or database queries.
2. **Idempotency Protection**: Financial and state-changing mutations require an `Idempotency-Key` header verified against `idempotency_keys` table.
3. **Audit Trails**: Security actions (login attempts, role modifications, API key generation) generate immutable entries in `audit_logs`.

---

## 6. Domain Event & Transactional Outbox Security (`src/lib/events/`)

1. **Server Context Workspace Derivation**:
   - `publishDomainEvent` derives `workspaceId` and `actorId` strictly from authenticated server context (`requireWorkspaceAccess`).
   - Browser payloads cannot supply or override `workspaceId` as an event authorization mechanism.
2. **Sensitive Payload Field Sanitization (`sanitizeEventPayload`)**:
   - Event payloads are automatically filtered before insertion into `events` or `outbox_events`.
   - Fields containing sensitive keywords (`password`, `passwordHash`, `secret`, `token`, `accessToken`, `refreshToken`, `keyHash`, `apiKey`, `creditCard`) are stripped out.
3. **Transactional Outbox Consistency**:
   - Domain events and outbox queue entries are written synchronously within the same Drizzle ORM database transaction (`tx`) as the primary business mutation.
   - If the business transaction fails or rolls back, outbox event generation rolls back atomically, preventing orphaned or uncommitted events.

---

## 7. Automation Engine Condition & Action Security (`src/lib/automation/`)

1. **Prototype Pollution Defense (`resolveFieldPath`)**:
   - Condition evaluation resolves dot-notation property paths (e.g. `event.payload.amountCents`) against untrusted input objects.
   - Access to dangerous properties (`__proto__`, `constructor`, `prototype`) is strictly intercepted and blocked, returning `undefined`.
   - Field path string length is restricted to max 100 characters and nested depth to max 5 levels.
2. **Allowlisted Static Action Registry (`ACTION_REGISTRY`)**:
   - Action execution is restricted to a static allowlist of 4 explicit action types: `create_notification`, `create_audit_log`, `update_task_status`, `dispatch_webhook`.
   - Unknown action types requested in workflow definitions are rejected with structured validation errors.
   - Arbitrary code execution (`eval`, `Function`), dynamic imports, and arbitrary SQL execution are prohibited.
3. **Trusted Execution Context (`TrustedExecutionContext`)**:
   - Action handlers require a server-validated `TrustedExecutionContext` containing `workspaceId` and `actorUserId`.
   - Action parameters (e.g. `recipientUserId`, `taskId`, `webhookId`) CANNOT override or tamper with `workspaceId`. Handlers enforce tenant ownership (e.g. tasks must belong to `context.workspaceId`, webhooks must belong to `context.workspaceId`).
4. **Network & HTTP Execution Safety in M5.2/M5.3**:
   - `dispatch_webhook` action validates `webhookId` ownership and payload size bounds (max 16KB).
   - `dispatch_webhook` produces a validated dispatch intent descriptor object only. **Zero network calls or `fetch()` HTTP requests are executed in M5.3.** Actual webhook HTTP delivery is strictly isolated to **TASK-M5.4**.

---

## 8. Outbox Processor & Workflow Engine Security (`src/lib/automation/processor.ts`, `runner.ts`)

1. **PostgreSQL Row Locking (`FOR UPDATE SKIP LOCKED`)**:
   - `claimPendingOutboxEvents()` uses row-level PostgreSQL locks (`FOR UPDATE SKIP LOCKED`) inside a single database transaction.
   - Prevents worker race conditions, duplicate outbox event claims, and lock contention across stateless edge / background workers. Batch size is strictly bounded (default 10, max 100).
2. **Stale Processing Claim Recovery**:
   - `recoverStaleProcessingClaims()` sweeps processing claims older than 5 minutes (`claimed_at < NOW() - 5m`).
   - If `retry_count < 3`, claims are reset to `pending` with `claimed_at = NULL` and `retry_count += 1`.
   - If `retry_count >= 3`, claims transition to `failed` dead-letter status, preventing infinite processing loops on worker crashes.
3. **Deterministic Rule-Level Idempotency (`auto_run:{ruleId}:{outboxEventId}`)**:
   - Every rule execution attempt atomically reserves key `auto_run:{ruleId}:{outboxEventId}` in `idempotency_keys` table using `INSERT INTO idempotency_keys ... ON CONFLICT DO NOTHING`.
   - Prevents duplicate rule execution if a worker crashes midway through a multi-rule outbox event batch.
4. **Trusted Actor Context Preservation**:
   - `TrustedExecutionContext.actorUserId` is derived strictly from `outbox_events.actor_id` (a server-authoritative column set during domain event publication).
   - Event payload contents (`payload.createdBy`, `payload.updatedBy`) are data only and are NEVER promoted to trusted actor identity, preventing impersonation attacks.
5. **Isolated Per-Rule Transactions & Multi-Rule Fault Isolation**:
   - Each matching rule executes inside its own isolated transaction boundary.
   - Idempotency key reservation, condition evaluation, action execution, and `automation_runs` log persistence commit together atomically per rule. Failure in Rule B does not roll back Rule A.

---

## 9. Webhook Dispatcher & Outbound Delivery Security (`src/lib/automation/webhooks.ts`, `src/lib/automation/dispatcher.ts`)

1. **HMAC-SHA256 Cryptographic Signatures (`crypto.subtle`)**:
   - Webhook payloads are signed using Web Crypto API (`crypto.subtle`).
   - Canonical signing string: `${timestamp}.${rawJSONPayload}`.
   - Signature header: `X-Silex-Signature: t={timestamp},v1={hex_signature}`.
   - Receivers verify signatures to guarantee payload authenticity and integrity.
2. **Server-Only Secret Handling**:
   - Webhook secrets are server-only. They are NEVER returned in API responses to clients, logged in process logs, included in audit trails, or written into `webhook_deliveries` records or error messages.
3. **Strict SSRF Pre-flight URL Validation (`validateWebhookTargetUrl`)**:
   - Webhook target URLs MUST use `https:`. Plain `http:`, `file:`, `ftp:`, etc., are strictly rejected.
   - Port MUST be default 443. Custom ports (e.g. 5432, 8080) are prohibited.
   - Target hostnames matching `localhost`, `.local`, `.internal`, `.localhost` are rejected.
   - IP literal addresses in loopback (`127.x`), RFC1918 private ranges (`10.x`, `172.16-31.x`, `192.168.x`), Cloud IMDS link-local (`169.254.169.254`), multicast, unspecified (`0.x`), and IPv6 private/local ranges (`::1`, `fe80::`, `fc00::`) are strictly rejected.
4. **Manual Redirect Prohibition (`redirect: "manual"`)**:
   - Webhook fetch requests execute with `redirect: "manual"`. Redirects are NEVER automatically followed.
   - Any 3xx HTTP status code immediately halts delivery, sets status to `failed` (non-retryable security failure), and records `HTTP redirect prohibited`.
5. **Bounded Request Payloads & Response Storage**:
   - Outbound JSON request payloads are bounded to 16 KiB (16,384 bytes). Oversized payloads are rejected before network fetch.
   - Stored HTTP response bodies are bounded to 2 KiB (2,048 bytes). Responses exceeding 2KB are truncated and appended with `[TRUNCATED]`.
6. **HTTP Duration Timeout**:
   - Webhook requests execute with `AbortSignal.timeout(10000)`. Requests exceeding 10 seconds abort immediately.
7. **3-Phase Transaction Isolation (Zero DB Locks During Network I/O)**:
   - Phase 1: DB transaction claims pending delivery (`FOR UPDATE SKIP LOCKED`).
   - Phase 2: Outbound HTTP `fetch()` executes with **ZERO database transactions held open**.
   - Phase 3: DB transaction commits execution status, HTTP response status code, bounded response body, duration, and next retry schedule.
8. **Maximum 5 Total HTTP Attempts**:
   - Delivery retry count tracks consumed retries (initial = 0). Retries schedule via exponential backoff (10s, 60s, 300s, 1800s with ±10% jitter).
   - If `consumedRetries >= 4` (after attempt 5 fails), status transitions to terminal `failed`. NO 6th attempt is ever executed.

---

## 10. Automation Server Functions & Secure Worker Triggers Security (`src/lib/server-functions/automation.ts`)

1. **Role-Based Access Control (RBAC)**:
   - Rule & Webhook Read Operations (`getAutomationRulesFn`, `getAutomationRuleByIdFn`, `getAutomationRunsFn`, `getAutomationRunByIdFn`): Permitted for `member`, `admin`, `owner` roles within authorized workspace context (`requireWorkspaceAccess`).
   - Rule & Webhook Mutation Operations (`createAutomationRuleFn`, `updateAutomationRuleFn`, `toggleAutomationRuleFn`, `deleteAutomationRuleFn`, `getWebhooksFn`, `createWebhookFn`, `updateWebhookFn`, `deleteWebhookFn`, `getWebhookDeliveriesFn`): Permitted ONLY for `admin` and `owner` roles.
2. **Server-Derived Identity (`createdBy`)**:
   - `createdBy` attribute on automation rules is set strictly from `auth.userId` obtained from `requireWorkspaceAccess()`. Client-supplied user identities in request bodies are ignored.
3. **Allowlisted Action Registry Validation (`automationActionSchema`)**:
   - Rule actions are parsed and validated strictly against `automationActionSchema` from `src/lib/automation/actions.ts`. Unregistered or dynamic action specifications are rejected during input parsing.
4. **Webhook Secret Isolation & One-Time Return**:
   - Database queries for `getWebhooksFn` and `getWebhookDeliveriesFn` use explicit column selection that strictly excludes `webhooks.secret`.
   - Webhook signing secrets are generated using 32-byte cryptographically secure random bytes (`crypto.getRandomValues` / `node:crypto`) and returned **ONLY ONCE** in the `createWebhookFn` response.
5. **SSRF Target URL Re-Validation**:
   - `createWebhookFn` and `updateWebhookFn` execute pre-flight SSRF URL checks via `validateWebhookTargetUrl()`, rejecting HTTP protocol, non-443 ports, loopback, private RFC1918 IPs, and cloud metadata IMDS addresses.
6. **Execution Log Sanitization (`sanitizeExecutionLogs`)**:
   - Execution logs returned by `getAutomationRunsFn` and `getAutomationRunByIdFn` are recursively sanitized to strip sensitive keys (`secret`, `password`, `token`, `authorization`, `api_key`, `hmac`).
7. **Compliance Audit Trail**:
   - Rule mutations (`created`, `updated`, `toggled`, `deleted`) and webhook mutations (`created`, `updated`, `deleted`) record compliance audit entries in `audit_logs` capturing `actorId = auth.userId`, `workspaceId`, `entityType`, `entityId`, `oldValues`, and `newValues`.
8. **Secure Worker Triggers (`triggerAutomationOutboxWorkerFn`, `triggerWebhookDeliveryWorkerFn`)**:
   - **Dual Authorization Model**:
     - **External System / Cron**: Validated via server-side HTTP request header `Authorization: Bearer <CRON_SECRET>` compared against `process.env.CRON_SECRET` using timing-safe constant-time string comparison (`timingSafeEqualStrings`).
     - **Manual Authenticated Execution**: Permitted for authenticated Workspace Admin or Owner sessions (`requireWorkspaceAccess({ workspaceId, requiredRole: "admin" })`). Ordinary members and unauthenticated requests are strictly rejected.
   - **Public Input Schema Hardening**: `cronSecret` is strictly REMOVED from public server function input contracts (`triggerAutomationOutboxWorkerInputSchema`, `triggerWebhookDeliveryWorkerInputSchema`). Input parameters accept only safe operational configuration (`batchSize?: number` bounded to $1 \le \text{batchSize} \le 100$, default 10). Secrets can NEVER be supplied as business input fields.
   - **Credentials Leakage Protection**: `CRON_SECRET` is never logged to process stdout/stderr, written into audit logs, returned in HTTP responses, or exposed in error messages. Unauthenticated browser execution is blocked by runtime environment guards (`typeof window !== "undefined"`).




