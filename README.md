# SILEX 2.0 — Zenith Suite

> **Next-Generation, AI-Native Enterprise Workspace & Business Operating System**
> Built with TanStack Start, React 19, Supabase SSR, Drizzle ORM, PostgreSQL with `pgvector`, and Cloudflare Workers.

---

## 🌟 Overview

**SILEX 2.0 (Zenith Suite)** is a fullstack, production-grade business operating platform designed for modern agencies, digital consultancies, SaaS operators, and fast-moving teams. It unifies essential operational workflows into a single cohesive interface:

- **Customer Relationship Management (CRM)** with multi-contact rosters and financial metrics
- **Projects & Tasks** featuring an interactive 4-column Kanban board, assignee management, and realtime threaded comments
- **Financial Operations & Invoicing** with atomic sequential numbering, line items, taxes, discounts, partial payments, and expense tracking
- **AI Zenith Engine** featuring workspace-scoped Retrieval-Augmented Generation (RAG) powered by PostgreSQL `pgvector` (1536-dimensional embeddings) and tool execution
- **Documents & Knowledge Management** with nested folders, rich content, template management, and automatic vector indexing
- **Enterprise Multi-Tenant Workspaces** with custom roles, role-based access control (RBAC), and high-entropy tokenized invitations
- **Business Automation & Webhook Dispatcher** with an outbox pattern, rule engine, condition evaluator, HMAC-SHA256 signatures, and worker scheduling
- **Global Full-Text Search** via `Cmd+K` command menu across projects, tasks, documents, clients, invoices, and expenses
- **Developer Security & API Keys** with SHA-256 token hashing and scoped access control

---

## 🏗 System Architecture

```
                                  ┌──────────────────────────────┐
                                  │      Client Web Browser      │
                                  │   React 19 / TanStack Router │
                                  └──────────────┬───────────────┘
                                                 │
                                                 │ HTTPS / WSS
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │      Nitro SSR Engine        │
                                  │   Cloudflare Module Target   │
                                  └──────────────┬───────────────┘
                                                 │
                   ┌─────────────────────────────┼─────────────────────────────┐
                   ▼                             ▼                             ▼
       ┌──────────────────────┐      ┌──────────────────────┐      ┌──────────────────────┐
       │   Supabase Auth      │      │ TanStack Server Fns  │      │ Automation Worker    │
       │   Session & Cookies  │      │ (auth & tenant gate) │      │ (Outbox & Webhooks)  │
       └──────────────────────┘      └───────────┬──────────┘      └───────────┬──────────┘
                                                 │                             │
                                                 ▼                             ▼
                                  ┌──────────────────────────────┐
                                  │      Drizzle ORM Layer       │
                                  │  41 Tables / RFC 9562 UUIDv7 │
                                  └──────────────┬───────────────┘
                                                 │
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │    PostgreSQL Database       │
                                  │  pgvector / RLS / Triggers   │
                                  └──────────────────────────────┘
```

---

## 🚀 Major Modules & Capabilities

### 1. Identity, Authentication & Multi-Tenant Security
- **Authentication**: Managed via Supabase Auth (`@supabase/ssr`) supporting Email/Password, OAuth providers (Google, GitHub), and email confirmation flows.
- **Strict Multi-Tenancy**: Every operational database record is partitioned by `workspace_id`. Server functions enforce tenant isolation via `requireWorkspaceAccess()`.
- **Role Hierarchy**: Structured permissions (`owner: 3`, `admin: 2`, `member: 1`) protecting sensitive settings, billing, API key generation, and member deactivation.
- **User Auto-Provisioning**: PostgreSQL database trigger automatically synchronizes `auth.users` into `public.users` on signup.

### 2. Customer Relationship Management (CRM)
- **Client Directory**: Track active clients, leads, archived accounts, billing/shipping addresses, and custom metadata.
- **Key Contacts Roster**: Multi-contact management per client with primary contact flags, direct `mailto:` / `tel:` actions, and contact soft-deletes.
- **Internal Collaboration Notes**: Timestamped, author-attributed client notes with "Pin to top" ordering and automatic AI Zenith RAG vector indexing.
- **Live Financial Aggregations**: Real-time computation of client Lifetime Value (LTV), total invoiced amount, outstanding balance, and active project counts directly from the financial ledger.

### 3. Projects, Tasks & Kanban Board
- **Project Tracking**: Budget tracking, dates, status lifecycles (`planning`, `active`, `completed`, `on_hold`), and team member assignments.
- **Interactive Kanban Board**: 4 canonical status columns (`todo`, `in_progress`, `in_review`, `completed`), status dropdowns, and task priority badges (`urgent`, `high`, `medium`, `low`).
- **Task Detail Drawer**: Full task metadata inspection, inline editing, assignee management, and soft-delete safeguards.
- **Realtime Comments**: Threaded task discussions backed by Supabase Realtime WebSocket subscriptions on `task_comments` scoped by `task_id`.

### 4. Finance, Invoicing & Payments Ledger
- **Invoice Generation**: Atomic sequential invoice numbering (`INV-1001`), tax calculation, customizable line items, discounts, and currency formatting.
- **Lifecycle Management**: Status tracking (`draft` → `sent` → `paid` / `overdue` / `cancelled`) with automated domain event dispatching.
- **Unified Transactions Ledger**: Combines incoming client payments and outgoing operational expenses into a single chronological ledger calculating net available cash.
- **Expense Tracking**: Category breakdown (9 canonical categories), vendor attribution, project budget linking, and receipt reference metadata.
- **Subscription Management**: Plan tier quotas (`free`, `pro`, `enterprise`) with built-in $0 simulation fallback and Stripe webhook HMAC signature verification.

### 5. Zenith AI Engine & RAG Store
- **Semantic Vector Search**: 1536-dimensional vector store (`ai_memory`) powered by PostgreSQL `pgvector` with cosine distance retrieval (`<=>`).
- **RAG Ingestion**: Deterministic text chunking and automatic embedding indexing for documents, tasks, and client notes.
- **Tool Calling Registry**: Read-only, workspace-isolated tools allowing the AI assistant to query invoices, projects, tasks, and workspace documents.
- **AI Dock & Studio**: Slide-out assistant drawer (`AIDock`) available across the entire application and dedicated full-page AI Studio (`/app/ai`) with conversation history and source citations.
- **Dual Provider Architecture**: Production support for Google Gemini (`gemini-3.6-flash`, `gemini-embedding-001`) with automatic, safe mock fallback (`MockAIProvider`) for local development without API keys.

### 6. Documents & Knowledge Base
- **Directory Hierarchy**: Nested folder structures, search filtering, and workspace templates.
- **Document Editor**: Clean reading/editing interface supporting JSON structure preservation, text editing, and word count analytics.
- **Automatic RAG Indexing**: Real-time vector store synchronization upon saving document content.
- **Attachment Metadata**: Metadata tracking for attached project files, specs, and receipts.

### 7. Automation & Webhook Dispatcher
- **Transactional Outbox Pattern**: Atomic domain event persistence in PostgreSQL within the originating mutation transaction (`outbox_events`).
- **Rule Engine**: Condition evaluation supporting 8 operators (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `in`) with prototype pollution defense.
- **Allowlisted Actions**: Side-effect execution including notifications, audit logs, task status updates, and webhook dispatching.
- **Outbound Webhook Dispatcher**: Asynchronous delivery engine featuring HMAC-SHA256 signature headers, SSRF pre-flight validation (private/internal IP blocking), bounded retries with exponential backoff, and atomic row claiming (`FOR UPDATE SKIP LOCKED`).
- **Worker Infrastructure**: Native Cloudflare Workers Cron Trigger support (`*/5 * * * *`), timing-safe bearer-token protected HTTP endpoints (`/api/v1/automation/worker`), and local CLI worker runner (`npm run worker`).

### 8. Global Command Search (`Cmd+K`)
- **Unified Search**: Instant, debounced search across 6 business domains (Projects, Tasks, Documents, CRM Clients, Invoices, Expenses).
- **Security Scoped**: Strictly partitioned to the authenticated workspace with soft-delete exclusion and zero credential exposure.

### 9. Workspace Administration & Developer Security
- **Workspace Branding & Settings**: Dynamic workspace profile, customizable slug, currency, tax ID, and hex branding color swatches.
- **Team Management & Zero-Cost Invites**: High-entropy 64-character tokenized invitation links (`/auth?invitation=<token>`) with 7-day expiration and zero external email SaaS cost.
- **Developer API Keys**: Generate high-entropy API keys (`slx_live_...`). Keys are hashed using SHA-256 before database storage; raw secrets are displayed only once upon generation.
- **Notification Preferences**: Granular user controls for in-app push, email, and Slack delivery across 6 workspace event types.

---

## 💡 Student-Friendly $0-Cost Architecture

SILEX 2.0 is specifically architected to be completely functional, testable, and deployable with **zero mandatory paid cloud services**:

| Component | Standard / Production Option | Student-Friendly $0 Default |
| :--- | :--- | :--- |
| **Hosting** | Cloudflare Workers / Pages | Cloudflare Free Tier (Nitro module preset) |
| **Database** | Supabase PostgreSQL 17 | Supabase Free Tier (includes `pgvector`) |
| **Authentication** | Supabase Auth | Supabase Free Tier (Email & OAuth) |
| **AI / Embeddings** | Google Gemini API | Built-in `MockAIProvider` (works with no API key) |
| **Billing / Stripe** | Live Stripe Account & Webhooks | Built-in $0-cost transactional simulation mode |
| **Team Invites** | Paid transactional email (Resend/Sendgrid) | Shareable tokenized URLs (copied directly from UI) |
| **Worker Cron** | Paid external scheduler | Native Cloudflare Cron Trigger or `npm run worker` CLI |
| **File Storage** | Cloud Object Storage (S3 / GCS) | Metadata-only mode (`STORAGE_MODE=disabled`) |

---

## ⚠️ Important Limitations & Architectural Boundaries

1. **Physical File Storage**: Physical object storage (e.g. AWS S3, Cloudflare R2, or Supabase Storage buckets) is **not required or provisioned by default**. The application defaults to `STORAGE_MODE=disabled`, tracking document and expense attachments as metadata records in PostgreSQL. An optional sandboxed local filesystem provider (`STORAGE_MODE=local`) is available for local testing.
2. **Third-Party Email Services**: Outbound transactional emails are not sent automatically unless configured. Team invitations generate direct high-entropy links for sharing.
3. **Database Dependency**: The application requires a PostgreSQL connection (Supabase recommended) with the `pgvector` extension enabled for AI RAG features.

---

## 🛠 Local Development Setup

### Prerequisites
- **Node.js**: v20+ or v22+
- **npm** or **bun**
- A Supabase project (Free Tier) with PostgreSQL

### 1. Clone the Repository
```bash
git clone https://github.com/Ahad-Arc/silex2.0.git
cd silex2.0/silex-zenith-suite-main
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy the example environment configuration:
```bash
cp .env.example .env
```

Configure your `.env` with your Supabase credentials:
```env
# Public Client Variables
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_APP_URL=http://localhost:3000

# Server-Only Database & Worker Credentials
DATABASE_URL=postgresql://postgres.your-project-id:your-password@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require
DB_MAX_CONNECTIONS=10
CRON_SECRET=your-random-cron-secret-token

# Optional: AI Provider (omitting this safely activates MockAIProvider)
# GEMINI_API_KEY=your-gemini-api-key

# Storage Mode (default: disabled for $0 metadata-only mode)
STORAGE_MODE=disabled
```

### 4. Database Schema Setup
Push migrations or check schema with Drizzle Kit:
```bash
npx drizzle-kit check
```

### 5. Start the Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:3000`.

---

## 🧪 Verification & Testing Commands

SILEX 2.0 includes a comprehensive test suite of 505 unit, integration, and security tests:

```bash
# Run the complete test suite (505/505 tests across 36 suites)
npm test

# Run TypeScript strict type verification
npx tsc --noEmit

# Run production compilation (Nitro Cloudflare SSR bundle)
npm run build

# Verify Drizzle ORM schema consistency
npx drizzle-kit check

# Verify Git formatting and whitespace
git diff --check

# Run local automation worker batch (CLI runner)
npm run worker
```

---

## 📦 Technology Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router)
- **UI & State**: [React 19](https://react.dev/), [TanStack Query](https://tanstack.com/query), [Lucide Icons](https://lucide.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with dark-mode HSL design tokens
- **Primitives**: [Radix UI](https://www.radix-ui.com/) & [cmdk](https://cmdk.paco.me/)
- **Database & ORM**: [Drizzle ORM](https://orm.drizzle.team/), PostgreSQL 17, `pgvector`, `postgres.js`
- **Identity & Realtime**: [Supabase Auth](https://supabase.com/auth) & [Supabase Realtime](https://supabase.com/realtime)
- **AI & Vectors**: [Google Gemini 1.5/2.0 API](https://ai.google.dev/) (`gemini-3.6-flash`, `gemini-embedding-001`)
- **Serverless Runtime**: [Nitro](https://nitro.unjs.io/) (Target: Cloudflare Workers)

---

## 📄 License

This project is licensed under the MIT License.
