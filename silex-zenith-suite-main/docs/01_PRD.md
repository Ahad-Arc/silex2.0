# Product Requirements Document (PRD) — Silex Zenith Suite

## 1. Executive Summary & Vision

**Silex Zenith Suite** (`silex2.0`) is a next-generation, AI-native enterprise workspace and operations management platform. Built to empower modern teams, agencies, and hyper-growth enterprises, Silex Zenith integrates CRM, multi-tenant Workspace Management, Project & Task Tracking, Automated Invoicing & Financial Accounting, Vector-powered AI Assistants, and Document Collaboration into a unified fullstack application.

---

## 2. Core Target Audience & Use Cases

1. **Digital Agencies & Consultancies**: Managing client relationships, contract projects, task delivery, hourly rate tracking, and automated billing/invoicing.
2. **Growth Teams & SaaS Operations**: Requiring multi-tenant workspace isolation, custom role-based access control (RBAC), and transactional activity auditing.
3. **AI-Enabled Enterprises**: Leveraging RAG (Retrieval-Augmented Generation) across workspace documents, tasks, and client notes via an inline AI Assistant.

---

## 3. Product Functional Architecture & Modules

### 3.1. Identity & Multi-Tenant Workspace Management

- **Authentication**: Email/Password and OAuth (Google, GitHub) via Supabase Auth with session hash tracking.
- **Tenant Isolation**: Every operational entity is strictly partitioned by `workspace_id`.
- **Custom RBAC**: Granular permissions stored as JSON array per custom role (`workspace_roles`) and assigned to workspace members (`workspace_members`).
- **Workspace Onboarding & Team Invites**: Tokenized email invitations (`workspace_invitations`) with expiration dates.

### 3.2. Customer Relationship Management (CRM)

- **Client Directory**: Track leads, active clients, archived accounts, billing/shipping addresses, and custom attributes.
- **Client Contacts**: Multi-contact mapping per client with primary contact flags.
- **Client Notes**: Pinned and timestamped internal collaboration notes per client.

### 3.3. Project & Task Lifecycle Tracking

- **Projects**: Client-associated or standalone projects with budgets (`budget_cents`), timelines, status stages, and team assignment.
- **Task Management**: Hierarchical task tracking with self-referencing parent-child relationships (`parent_task_id`), priority levels (`low`, `medium`, `high`, `urgent`), estimated hours, and due-date performance indexing.
- **Collaboration**: Task tags, assignees, and threaded comments (`task_comments`).

### 3.4. Invoicing & Financial Operations

- **Invoice Creation**: Auto-generated sequential invoice numbers (e.g. `INV-1001`), tax, line items, discounts, and multi-currency support (default `USD`).
- **Payments**: Partial and full payment recording tied to transaction references with idempotency keys.
- **Expenses**: Category breakdown, project billing linking, and receipt storage.
- **Subscription Billing**: Integration with Stripe Customer & Subscription IDs.

### 3.5. AI Zenith Engine & RAG Store

- **AI Conversations & Dock**: Floating AI sidebar dock supporting natural language interactions.
- **RAG & Memory (`pgvector`)**: 1536-dimensional vector store (`ai_memory`) indexing documents, tasks, and client notes.
- **Tool Calling (`ai_tool_calls`)**: Structured AI function execution for querying invoices, updating task statuses, and searching knowledge bases.

### 3.6. Documents, Notifications & System Services

- **Document Management**: Nested folder trees (`folders`), rich JSON content documents (`documents`), and attachments (`attachments`).
- **Notifications & Preferences**: Unread notification tracking and user preference toggles (Email, Push, Slack).
- **Audit & Analytics**: Domain event stream (`events`), audit logs (`audit_logs`), outbox pattern (`outbox_events`), and webhooks (`webhooks`).

---

## 4. Non-Functional Requirements

- **Performance**: Sub-100ms API response time powered by SSR and indexed Postgres queries.
- **Security**: Supabase RLS policies, RFC 9562 UUIDv7 keys, and encrypted token hashes.
- **Reliability**: Transactional outbox pattern for async event delivery and idempotent payment endpoints.
