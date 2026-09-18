# Database Schema Reference — Silex Zenith Suite

## 1. Overview & Core Standards

The database is built on **PostgreSQL** (managed via Supabase) and defined strictly in TypeScript using **Drizzle ORM** (`src/db/schema/*.ts`).

### Key Schema Conventions:

- **Primary Keys**: Every table uses **RFC 9562 UUIDv7** (`uuidv7()`), generated via `gen_uuidv7()` in Postgres for time-ordered index-friendly sorting.
- **Multi-Tenancy**: All workspace-level domain tables include a mandatory `workspace_id` referencing `workspaces.id` with `onDelete: "cascade"`.
- **Soft Deletes**: Deletable tables feature a `deleted_at` timestamp column. Unique indexes use partial conditions (e.g. `WHERE deleted_at IS NULL`).
- **Timestamps**: All timestamps use timezone-aware types (`timestamp({ withTimezone: true })`) with `.defaultNow()`.
- **Money Values**: Financial values are stored as integers in **cents** (e.g. `subtotal_cents`, `amount_paid_cents`, `hourly_rate_cents`) to eliminate floating-point rounding errors.

---

## 2. Exhaustive Table Specifications (41 Tables across 12 Modules)

### Module 1: Identity & Authentication (`src/db/schema/identity.ts`)

#### 1. `users`

- `id` (`uuid`, PK, RFC 9562 UUIDv7)
- `email` (`varchar(255)`, NOT NULL, unique index `idx_users_email_active`)
- `password_hash` (`varchar(255)`)
- `full_name` (`varchar(255)`, NOT NULL)
- `avatar_url` (`text`)
- `email_verified_at` (`timestamp with tz`)
- `is_active` (`boolean`, default `true`, NOT NULL)
- `is_super_admin` (`boolean`, default `false`, NOT NULL)
- `created_at`, `updated_at`, `deleted_at`

#### 2. `accounts` (OAuth Accounts)

- `id` (`uuid`, PK)
- `user_id` (`uuid`, FK -> `users.id` CASCADE, NOT NULL)
- `provider` (`varchar(50)`, NOT NULL)
- `provider_account_id` (`varchar(255)`, NOT NULL)
- `access_token`, `refresh_token` (`text`)
- `expires_at` (`timestamp with tz`)
- `created_at`, `updated_at`

#### 3. `sessions`

- `id` (`uuid`, PK)
- `user_id` (`uuid`, FK -> `users.id` CASCADE, NOT NULL)
- `token_hash` (`varchar(255)`, NOT NULL, unique index)
- `ip_address` (`varchar(45)`), `user_agent` (`text`)
- `active_workspace_id` (`uuid`)
- `expires_at` (`timestamp with tz`, NOT NULL), `created_at`, `last_seen_at`

#### 4. `user_preferences`

- `id` (`uuid`, PK)
- `user_id` (`uuid`, FK -> `users.id` CASCADE, NOT NULL, unique index)
- `theme` (`varchar(20)`, default `"dark"`, NOT NULL)
- `timezone` (`varchar(100)`, default `"UTC"`, NOT NULL)
- `locale` (`varchar(10)`, default `"en-US"`, NOT NULL)
- `keyboard_shortcuts_enabled` (`boolean`, default `true`, NOT NULL)
- `ui_config` (`jsonb`, default `{}`)
- `updated_at`

---

### Module 2: Workspaces & RBAC (`src/db/schema/workspaces.ts`)

#### 5. `workspaces`

- `id` (`uuid`, PK)
- `name` (`varchar(255)`, NOT NULL)
- `slug` (`varchar(100)`, NOT NULL, unique index where active)
- `logo_url` (`text`)
- `owner_id` (`uuid`, FK -> `users.id` RESTRICT, NOT NULL)
- `plan_tier` (`varchar(50)`, default `"free"`, NOT NULL)
- `is_active` (`boolean`, default `true`, NOT NULL)
- `created_at`, `updated_at`, `deleted_at`

#### 6. `workspace_roles` (Custom Roles)

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `name` (`varchar(100)`, NOT NULL)
- `description` (`text`)
- `permissions` (`jsonb` array of strings, default `[]`)
- `created_at`, `updated_at`

#### 7. `workspace_members`

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `user_id` (`uuid`, FK -> `users.id` CASCADE, NOT NULL)
- `role` (`varchar(50)`, default `"member"`, NOT NULL)
- `custom_role_id` (`uuid`, FK -> `workspace_roles.id` SET NULL)
- `job_title` (`varchar(100)`)
- `hourly_rate_cents` (`bigint` mode number)
- `status` (`varchar(20)`, default `"active"`, NOT NULL)
- `joined_at`, `created_at`, `updated_at`

#### 8. `workspace_settings`

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL, unique index)
- `default_currency` (`varchar(3)`, default `"USD"`, NOT NULL)
- `fiscal_year_start_month` (`smallint`, default `1`, NOT NULL)
- `invoice_prefix` (`varchar(20)`, default `"INV-"`, NOT NULL)
- `invoice_next_number` (`integer`, default `1001`, NOT NULL)
- `tax_id` (`varchar(100)`)
- `branding_colors` (`jsonb`, default `{ primary: "#0F172A" }`)

#### 9. `workspace_invitations`

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `email` (`varchar(255)`, NOT NULL)
- `role` (`varchar(50)`, default `"member"`, NOT NULL)
- `token_hash` (`varchar(255)`, NOT NULL, unique index)
- `invited_by_user_id` (`uuid`, FK -> `users.id` RESTRICT, NOT NULL)
- `status` (`varchar(20)`, default `"pending"`, NOT NULL)
- `expires_at`, `created_at`

---

### Module 3: CRM (`src/db/schema/crm.ts`)

#### 10. `clients`

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `company_name` (`varchar(255)`, NOT NULL)
- `website` (`text`)
- `status` (`varchar(50)`, default `"lead"`, NOT NULL)
- `billing_address` (`jsonb` `Address` object)
- `shipping_address` (`jsonb` `Address` object)
- `custom_fields` (`jsonb`)
- `created_by` (`uuid`, FK -> `users.id` RESTRICT, NOT NULL)
- `created_at`, `updated_at`, `deleted_at`

#### 11. `client_contacts`

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `client_id` (`uuid`, FK -> `clients.id` CASCADE, NOT NULL)
- `first_name`, `last_name` (`varchar(100)`, NOT NULL)
- `email` (`varchar(255)`, NOT NULL), `phone` (`varchar(50)`), `job_title` (`varchar(100)`)
- `is_primary` (`boolean`, default `false`, NOT NULL)
- `created_at`, `updated_at`, `deleted_at`

#### 12. `client_notes`

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `client_id` (`uuid`, FK -> `clients.id` CASCADE, NOT NULL)
- `author_id` (`uuid`, FK -> `users.id` RESTRICT, NOT NULL)
- `content` (`text`, NOT NULL)
- `is_pinned` (`boolean`, default `false`, NOT NULL)
- `created_at`, `updated_at`, `deleted_at`

---

### Module 4: Projects & Tasks (`src/db/schema/projects.ts`)

#### 13. `projects`

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `client_id` (`uuid`, FK -> `clients.id` SET NULL) — OPTIONAL
- `name` (`varchar(255)`, NOT NULL), `code` (`varchar(50)`), `description` (`text`)
- `status` (`varchar(50)`, default `"planning"`, NOT NULL)
- `budget_cents` (`bigint`)
- `start_date`, `due_date` (`timestamp with tz`)
- `created_by` (`uuid`, FK -> `users.id` RESTRICT, NOT NULL)
- `created_at`, `updated_at`, `deleted_at`

#### 14. `project_members`

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `project_id` (`uuid`, FK -> `projects.id` CASCADE, NOT NULL)
- `user_id` (`uuid`, FK -> `users.id` CASCADE, NOT NULL)
- `project_role` (`varchar(50)`, default `"contributor"`, NOT NULL)
- Unique index on (`project_id`, `user_id`).

#### 15. `tasks` (Self-referencing parentTaskId)

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `project_id` (`uuid`, FK -> `projects.id` CASCADE)
- `parent_task_id` (`uuid`, FK -> `tasks.id` CASCADE)
- `title` (`varchar(255)`, NOT NULL), `description` (`text`)
- `status` (`varchar(50)`, default `"todo"`, NOT NULL)
- `priority` (`varchar(20)`, default `"medium"`, NOT NULL)
- `estimated_hours` (`numeric(6,2)`)
- `due_date` (`timestamp with tz`, indexed for performance)
- `completed_at` (`timestamp with tz`)
- `created_by` (`uuid`, FK -> `users.id` RESTRICT, NOT NULL)
- `created_at`, `updated_at`, `deleted_at`

#### 16. `task_assignees`

- Primary Key composite: (`task_id`, `user_id`)
- `task_id` (`uuid`, FK -> `tasks.id` CASCADE)
- `user_id` (`uuid`, FK -> `users.id` CASCADE)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE)
- `assigned_at` (`timestamp with tz`)

#### 17. `task_tags`

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `name` (`varchar(50)`, NOT NULL)
- `color_hex` (`varchar(7)`, default `"#64748B"`, NOT NULL)

#### 18. `task_comments`

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `task_id` (`uuid`, FK -> `tasks.id` CASCADE, NOT NULL)
- `author_id` (`uuid`, FK -> `users.id` RESTRICT, NOT NULL)
- `content` (`text`, NOT NULL)
- `created_at`, `updated_at`, `deleted_at`

---

### Module 5: Finance & Subscriptions (`src/db/schema/finance.ts`)

#### 19. `invoices`

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `client_id` (`uuid`, FK -> `clients.id` RESTRICT, NOT NULL)
- `project_id` (`uuid`, FK -> `projects.id` SET NULL)
- `invoice_number` (`varchar(100)`, NOT NULL)
- `status` (`varchar(50)`, default `"draft"`, NOT NULL)
- `currency` (`varchar(3)`, default `"USD"`, NOT NULL)
- `subtotal_cents`, `tax_cents`, `discount_cents`, `total_cents`, `amount_paid_cents` (`bigint`)
- `issue_date`, `due_date` (`timestamp with tz`, indexed for performance)
- `notes`, `terms` (`text`)
- `created_by` (`uuid`, FK -> `users.id` RESTRICT, NOT NULL)

#### 20. `invoice_items`

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `invoice_id` (`uuid`, FK -> `invoices.id` CASCADE, NOT NULL)
- `description` (`text`, NOT NULL)
- `quantity` (`numeric(12,4)`, default `"1.0000"`, NOT NULL)
- `unit_price_cents` (`bigint`, NOT NULL)
- `amount_cents` (`bigint`, NOT NULL)
- `position` (`integer`, default `0`, NOT NULL)

#### 21. `payments`

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `invoice_id` (`uuid`, FK -> `invoices.id` RESTRICT, NOT NULL)
- `amount_cents` (`bigint`, NOT NULL)
- `currency` (`varchar(3)`, default `"USD"`, NOT NULL)
- `payment_method` (`varchar(50)`, NOT NULL)
- `transaction_reference` (`varchar(255)`, unique index where NOT NULL)
- `paid_at`, `created_by`, `created_at`

#### 22. `expenses`

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `category` (`varchar(100)`, NOT NULL)
- `amount_cents` (`bigint`, NOT NULL)
- `currency` (`varchar(3)`, default `"USD"`, NOT NULL)
- `expense_date` (`timestamp with tz`, NOT NULL)
- `vendor_name` (`varchar(255)`), `project_id` (`uuid`, FK -> `projects.id` SET NULL)
- `receipt_url` (`text`), `created_by`, `created_at`, `deleted_at`

#### 23. `subscriptions` (Stripe Billing)

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL, unique index)
- `stripe_customer_id` (`varchar(255)`, NOT NULL)
- `stripe_subscription_id` (`varchar(255)`, NOT NULL, unique index)
- `status` (`varchar(50)`, NOT NULL)
- `current_period_start`, `current_period_end` (`timestamp with tz`, NOT NULL)
- `cancel_at_period_end` (`boolean`, default `false`, NOT NULL)

---

### Module 6: Documents & Storage (`src/db/schema/documents.ts`)

#### 24. `folders` (Self-referencing parentFolderId)

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `parent_folder_id` (`uuid`, FK -> `folders.id` CASCADE)
- `name` (`varchar(255)`, NOT NULL)
- Unique index on (`workspace_id`, `parent_folder_id`, `name`).

#### 25. `documents`

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `folder_id` (`uuid`, FK -> `folders.id` SET NULL)
- `title` (`varchar(255)`, NOT NULL)
- `content_json` (`jsonb`, default `{}`)
- `is_template` (`boolean`, default `false`, NOT NULL)

#### 26. `attachments` (Polymorphic Attachments)

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `file_name` (`varchar(255)`, NOT NULL)
- `file_size_bytes` (`bigint`, NOT NULL)
- `mime_type` (`varchar(100)`, NOT NULL)
- `storage_path` (`text`, NOT NULL)
- `attached_to_type` (`varchar(50)`), `attached_to_id` (`uuid`)
- Polymorphic lookup index on (`workspace_id`, `attached_to_type`, `attached_to_id`).

---

### Module 7: AI Engine & Vectors (`src/db/schema/ai.ts`)

#### 27. `ai_conversations`

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `user_id` (`uuid`, FK -> `users.id` CASCADE, NOT NULL)
- `title` (`varchar(255)`, default `"New Conversation"`, NOT NULL)
- `model_name` (`varchar(100)`, default `"gemini-2.5-flash"`, NOT NULL)

#### 28. `ai_messages`

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `conversation_id` (`uuid`, FK -> `aiConversations.id` CASCADE, NOT NULL)
- `role` (`varchar(20)`, NOT NULL: `"user"` | `"assistant"` | `"system"`)
- `content` (`text`, NOT NULL)
- `tokens_used` (`integer`)

#### 29. `ai_memory` (pgvector 1536 RAG Store)

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `entity_type` (`varchar(50)`, NOT NULL: `"document"` | `"task"` | `"client_note"`)
- `entity_id` (`uuid`, NOT NULL)
- `chunk_content` (`text`, NOT NULL)
- `embedding` (`extensions.vector(1536)`, NOT NULL)
- `metadata` (`jsonb`, default `{}`)

#### 30. `ai_tool_calls`

- `id` (`uuid`, PK)
- `workspace_id` (`uuid`, FK -> `workspaces.id` CASCADE, NOT NULL)
- `message_id` (`uuid`, FK -> `aiMessages.id` CASCADE, NOT NULL)
- `tool_name` (`varchar(100)`, NOT NULL)
- `arguments` (`jsonb`, NOT NULL)
- `result` (`jsonb`), `status` (`varchar(20)`, default `"pending"`, NOT NULL)

---

### Module 8–12: Notifications, Analytics, Automation & System

- **31. `notifications`**: Unread alert feed per user.
- **32. `notification_preferences`**: Channel configuration per user.
- **33. `events`**: Append-only domain event stream logging workspace activities (`client.created`, `project.created`, `comment.created`, `invoice.created`, `payment.created`, `invoice.paid`).
- **34. `audit_logs`**: Compliance audit trail with `old_values` and `new_values` JSON diffs.
- **35. `outbox_events`**: Transactional outbox pattern table written atomically alongside business mutations with `status = 'pending'`, `retry_count`, and partial status index for asynchronous background worker processing.
- **36. `automation_rules`**: Trigger-condition-action workflow rules.
- **37. `automation_runs`**: Execution log history for automation rules.
- **38. `webhooks`**: Outbound HTTP webhook target configurations.
- **39. `webhook_deliveries`**: Webhook delivery records tracking status (`pending` | `processing` | `delivered` | `failed`), claimed_at timestamp (`claimed_at`), retry count (`retry_count`), next scheduled retry timestamp (`next_retry_at`), HTTP status code, response body, execution duration, and error message. Indexed on queue processing (`status, next_retry_at`) and stale processing claims (`status, claimed_at WHERE status = 'processing'`).
- **40. `api_keys`**: Workspace API keys with prefix, hashed token, and permission scopes.
- **41. `idempotency_keys`**: Request idempotency protection table with expiration index.
