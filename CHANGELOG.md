# Changelog — SILEX 2.0 (Zenith Suite)

All notable development milestones, architectural improvements, and security enhancements for the SILEX 2.0 platform are documented in this file, grounded strictly in the project documentation and verified codebase implementation.

---

## [v1.0.0] - Production Release

### 1. SILEX 2.0 Foundation
- **Database Architecture Layer**: Designed and implemented 41 PostgreSQL tables across 12 domain schemas (`identity`, `workspaces`, `crm`, `projects`, `finance`, `documents`, `ai`, `notifications`, `analytics`, `automation`, `system`) using Drizzle ORM and RFC 9562 UUIDv7 primary keys.
- **Drizzle Runtime Database Layer**: Initialized production Drizzle database client (`src/db/index.ts`) with lazy singleton instance using `postgres` driver and environment-driven `DATABASE_URL`.
- **Fullstack SSR Runtime**: Configured TanStack Start with React 19, Vite, and Nitro compilation targeting Cloudflare Workers.
- **Design System & Visual Shell**: Implemented Tailwind CSS v4 dark-theme design tokens, glassmorphic card panels, Lucide icon taxonomy, Radix UI component primitives, dynamic AppShell navigation, and Command Menu.

### 2. Authentication & Workspace Security
- **Supabase SSR Integration**: Configured `@supabase/ssr` server and browser clients for secure cookie-based session tracking.
- **User Auto-Provisioning**: Created PostgreSQL migration trigger (`20260914000000_auto_provision_users.sql`) synchronizing `auth.users` into `public.users` on signup.
- **Multi-Tenant Server Authorization**: Built `requireWorkspaceAccess()` server utility enforcing session authentication, active workspace membership verification, role validation, and tenant scoping.
- **Authentication Resilience**: Hardened OAuth callback and sign-up flows (`auth.callback.tsx`, `auth.tsx`, `app.tsx`) with hash-based session fallback, error parameter parsing, and preservation of deep-link redirect target URLs across authentication redirects.
- **Onboarding Flow & Provisioning**: Built interactive 4-step onboarding wizard (`/onboarding`) with profile setup, workspace provisioning, slug collision resolution, and owner role assignment.

### 3. Customer Relationship Management (CRM)
- **Client Directory**: Implemented full lifecycle tracking for active, lead, and archived client accounts with custom attributes and addresses.
- **Key Contacts Roster**: Implemented multi-contact management (`client_contacts`) supporting primary contact designation, contact updates, soft deletes, and automatic promotion of remaining contacts.
- **Internal Notes Collaboration**: Created author-attributed client notes with "Pin to top" ordering and automatic vector ingestion into `ai_memory`.
- **Dynamic Revenue & Financial Aggregations**: Implemented live calculation of client Lifetime Value (LTV), total invoiced amount, outstanding balance, and project counts directly from the financial database ledger.

### 4. Finance, Invoices & Payments
- **Atomic Sequential Invoicing**: Implemented thread-safe sequential invoice numbering (`INV-1001`) via `workspace_settings.invoiceNextNumber` tracking.
- **Line Items & Precision Math**: Implemented line-item boundaries (`invoices` + `invoice_items`) with integer cents precision, subtotal calculations, tax rates, and discount deductions.
- **Invoice Status Lifecycle**: Implemented transition states (`draft` → `sent` → `paid` / `overdue` / `cancelled`) with automated domain event publishing (`invoice.paid`).
- **Unified Transactions Ledger**: Combined client payments (`payments`) and operating business expenses (`expenses`) into a unified cashflow ledger computing net cash available.
- **Operational Expense Tracking**: Implemented 9 canonical expense categories, vendor attribution, project budget linking, and soft-delete audit preservation.
- **Billing & Subscriptions**: Implemented canonical plan tiers (`free`, `pro`, `enterprise`) with resource quotas, Stripe webhook HMAC constant-time signature verification, and a built-in $0-cost transactional simulation mode for development.

### 5. Projects, Tasks & Kanban
- **Project Lifecycle Management**: Implemented client-linked or standalone projects with budgets, timelines, status tracking, and member assignments.
- **Task Mutation Architecture**: Implemented `createTaskFn`, `updateTaskStatusFn`, `updateTaskFn`, and `deleteTaskFn` with workspace authorization, assignee membership verification, and domain event publishing (`task.created`, `task.updated`, `task.completed`).
- **Interactive 4-Column Kanban Board**: Built Kanban board (`/app/projects/$id`) with canonical statuses (`todo`, `in_progress`, `in_review`, `completed`), status transition dropdowns, and priority badges.
- **Task Detail Drawer & Inline Editing**: Built slide-out task drawer supporting metadata inspection, inline field editing, assignee replacement, and soft-deletion confirmations.
- **Realtime Threaded Comments**: Connected task comments to Supabase Realtime WebSocket subscriptions (`postgres_changes` on `task_comments`) with channel scoping by `task_id`.

### 6. Zenith AI Engine & RAG Store
- **Semantic Vector Storage**: Configured PostgreSQL `pgvector` store (`ai_memory`) with 1536-dimensional embeddings and cosine distance (`<=>`) retrieval.
- **RAG Ingestion Subsystem**: Implemented deterministic text chunking (`chunking.ts`) and automated ingestion service (`ai-ingestion.ts`) indexing workspace documents, tasks, and client notes.
- **Tool Calling Architecture**: Implemented read-only workspace-isolated tool execution registry (`tools.ts`) enabling structured queries for projects, tasks, invoices, and documents with iteration bounds.
- **Dual AI Provider**: Built provider abstraction (`provider.ts`) supporting Google Gemini (`gemini-3.6-flash`, `gemini-embedding-001`) with automatic, zero-dependency `MockAIProvider` fallback.
- **Zenith Assistant UX**: Integrated slide-out `AIDock` and full-page AI Studio (`/app/ai`) with conversation history navigation, source citation badges, and executed tool status badges.

### 7. Documents, Folders & Storage
- **Folder Hierarchy & Organization**: Implemented nested workspace folders (`folders`) and template categorization.
- **Document Editor**: Built full document reader/editor supporting rich JSON structure preservation, text editing mode, word/character metrics, and soft delete.
- **Storage Subsystem Abstraction**: Built multi-provider storage architecture (`DisabledStorageProvider`, `LocalDevStorageProvider`, `SupabaseStorageProvider`) defaulting to $0 metadata-only mode without paid cloud dependencies.
- **Media Security & Sanitization**: Implemented filename sanitization (path traversal, null byte, and control character stripping), MIME allowlist validation (max 25MB documents / 50MB files), and cross-tenant path verification.

### 8. Workspace Management & Branding
- **Workspace Settings**: Implemented configurable workspace profile settings including custom slug, default currency, fiscal year start month, tax ID, and invoice prefixes.
- **Visual Branding Palette**: Built live color swatch preview and storage for primary, secondary, and accent hex branding colors + logo URL.
- **Team Collaborator Roster**: Implemented member listing with roles (`Owner`, `Admin`, `Member`), job titles, role updates respecting hierarchy, and member deactivation safeguards.
- **Zero-Cost Team Invitations**: Implemented a $0 shareable invite system generating 64-character high-entropy cryptographic tokens with SHA-256 database hashing and 7-day expiration.

### 9. Developer Security & API Keys
- **High-Entropy Key Generation**: Implemented workspace API key generation (`slx_live_<48 hex chars>`) with custom scopes (`*`, `read`, `read,write`) and expiration presets.
- **SHA-256 Hash Storage**: Raw API keys are never stored in the database; only SHA-256 hashes are persisted, with raw secrets presented strictly once upon creation.
- **Role-Based Key Management**: Restricts API key generation and revocation to `admin` and `owner` workspace roles.

### 10. Notifications & Preferences
- **Notification Persistence & Center**: Implemented workspace-isolated notifications (`/app/notifications`) with read status tracking and bulk mark-as-read actions.
- **Realtime Header Notification Bell**: Built `useRealtimeNotifications` hook subscribing to WebSocket events with live unread counter increments.
- **Granular Delivery Preferences**: Implemented user notification preferences (`user_preferences` / `notification_preferences`) for Push, Email, and Slack channels across 6 workspace trigger events.

### 11. Global Command Search (`Cmd+K`)
- **Multi-Entity Search Engine**: Built server-side `globalSearchFn` executing indexed searches across Projects, Tasks, Documents, CRM Clients, Invoices, and Expenses.
- **Zero-Cost Native SQL**: Uses PostgreSQL-native `ilike` and `sql` JSON text querying without external search SaaS dependencies.
- **Command Menu UI**: Upgraded `CommandDialog` with 200ms debounced input, loading spinner, grouped entity results, Lucide icons, and keyboard navigation.

### 12. Automation Engine & Worker Infrastructure
- **Domain Event Publisher**: Built transactional domain event publishing within Drizzle database transactions (`publishDomainEvent`).
- **Condition & Action Registry**: Built safe condition evaluator supporting 8 operators and allowlisted action handlers (`create_notification`, `create_audit_log`, `update_task_status`, `dispatch_webhook`).
- **Outbox Worker Processor**: Built row-locking processor (`FOR UPDATE SKIP LOCKED`, batch size 10) with 5-minute stale claim recovery and deterministic idempotency keys.
- **Outbound Webhook Dispatcher**: Implemented HTTP delivery subsystem with HMAC-SHA256 signature headers, SSRF pre-flight validation, and retry backoff.
- **Automation Manager UI**: Integrated full Automation & Webhooks management into `/app/settings` with rule builder, execution history, and one-time secret modals.
- **Worker Cron Scheduling**: Configured native Cloudflare Workers Cron Triggers (`*/5 * * * *`), timing-safe bearer-token protected HTTP endpoints (`/api/v1/automation/worker`), and local CLI worker runner (`scripts/run-worker.ts` / `npm run worker`).

### 13. Production Hardening & Verification
- **Automated Test Suite**: Created and verified 36 test suites containing 505 deterministic tests covering all domain invariants, security bounds, and UI contracts.
- **Connection Pool Tuning**: Optimized Postgres client initialization with bounded connection limits (`DB_MAX_CONNECTIONS`), `idle_timeout: 20`, `connect_timeout: 10`, and `prepare: false` for Supabase Transaction Pooler compatibility.
- **Zero Hardcoded Secrets & Clean Git Hygiene**: Completed full secret scan, verified all credentials isolated to environment variables, hardened `.gitignore`, and validated clean builds.
