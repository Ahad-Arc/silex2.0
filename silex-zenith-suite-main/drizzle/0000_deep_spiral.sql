-- ============================================================================
-- SILEX 2.0 INITIAL DATABASE MIGRATION
-- Migration Tag: 0000_deep_spiral
-- Target Engine: PostgreSQL 15+ / Supabase PostgreSQL
-- ============================================================================

-- STAGE 1: EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
SET search_path TO public, extensions;

-- STAGE 2: PRE-TABLE FUNCTIONS (Required for DEFAULT gen_uuidv7() expressions)
CREATE OR REPLACE FUNCTION public.gen_uuidv7()
RETURNS uuid AS $$
DECLARE
  v_time timestamp with time zone := clock_timestamp();
  v_unix_ms bigint;
  v_rand bytea;
  v_hex text;
BEGIN
  v_unix_ms := floor(extract(epoch from v_time) * 1000);
  v_rand := gen_random_bytes(10);
  v_hex := encode(v_rand, 'hex');
  RETURN (
    lpad(to_hex(v_unix_ms), 12, '0') ||
    '7' ||
    substring(v_hex from 1 for 3) ||
    'a' ||
    substring(v_hex from 4 for 15)
  )::uuid;
END;
$$ LANGUAGE plpgsql VOLATILE SET search_path = public, pg_temp;

-- STAGE 3 & 4: BASE AND DEPENDENT TABLES
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"active_workspace_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"theme" varchar(20) DEFAULT 'dark' NOT NULL,
	"timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"locale" varchar(10) DEFAULT 'en-US' NOT NULL,
	"keyboard_shortcuts_enabled" boolean DEFAULT true NOT NULL,
	"ui_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"full_name" varchar(255) NOT NULL,
	"avatar_url" text,
	"email_verified_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workspace_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"custom_role_id" uuid,
	"job_title" varchar(100),
	"hourly_rate_cents" bigint,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"default_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"fiscal_year_start_month" smallint DEFAULT 1 NOT NULL,
	"invoice_prefix" varchar(20) DEFAULT 'INV-' NOT NULL,
	"invoice_next_number" integer DEFAULT 1001 NOT NULL,
	"tax_id" varchar(100),
	"branding_colors" jsonb DEFAULT '{"primary":"#0F172A"}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"logo_url" text,
	"owner_id" uuid NOT NULL,
	"plan_tier" varchar(50) DEFAULT 'free' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "client_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50),
	"job_title" varchar(100),
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "client_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"website" text,
	"status" varchar(50) DEFAULT 'lead' NOT NULL,
	"billing_address" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"shipping_address" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"project_role" varchar(50) DEFAULT 'contributor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid,
	"name" varchar(255) NOT NULL,
	"code" varchar(50),
	"description" text,
	"status" varchar(50) DEFAULT 'planning' NOT NULL,
	"budget_cents" bigint,
	"start_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "task_assignees" (
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_assignees_task_id_user_id_pk" PRIMARY KEY("task_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "task_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"color_hex" varchar(7) DEFAULT '#64748B' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"parent_task_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'todo' NOT NULL,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"estimated_hours" numeric(6, 2),
	"due_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"category" varchar(100) NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"expense_date" timestamp with time zone NOT NULL,
	"vendor_name" varchar(255),
	"project_id" uuid,
	"receipt_url" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 4) DEFAULT '1.0000' NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"amount_cents" bigint NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"project_id" uuid,
	"invoice_number" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"subtotal_cents" bigint DEFAULT 0 NOT NULL,
	"tax_cents" bigint DEFAULT 0 NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"amount_paid_cents" bigint DEFAULT 0 NOT NULL,
	"issue_date" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"notes" text,
	"terms" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"transaction_reference" varchar(255),
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"stripe_customer_id" varchar(255) NOT NULL,
	"stripe_subscription_id" varchar(255) NOT NULL,
	"status" varchar(50) NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size_bytes" bigint NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"storage_path" text NOT NULL,
	"attached_to_type" varchar(50),
	"attached_to_id" uuid,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"folder_id" uuid,
	"title" varchar(255) NOT NULL,
	"content_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"parent_folder_id" uuid,
	"name" varchar(255) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) DEFAULT 'New Conversation' NOT NULL,
	"model_name" varchar(100) DEFAULT 'gemini-1.5-pro' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"chunk_content" text NOT NULL,
	"embedding" extensions.vector(1536) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"tokens_used" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"tool_name" varchar(100) NOT NULL,
	"arguments" jsonb NOT NULL,
	"result" jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"executed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"push_notifications" boolean DEFAULT true NOT NULL,
	"slack_notifications" boolean DEFAULT false NOT NULL,
	"event_types" jsonb DEFAULT '{"task_assigned":true,"invoice_paid":true}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"action_url" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"actor_id" uuid,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"aggregate_type" varchar(50) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "automation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"trigger_event" varchar(100) NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"logs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"response_status_code" integer,
	"response_body" text,
	"execution_duration_ms" integer,
	"status" varchar(20) NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"target_url" text NOT NULL,
	"secret" varchar(255) NOT NULL,
	"subscribed_events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"key_prefix" varchar(10) NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"scopes" jsonb DEFAULT '["*"]'::jsonb NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"key" varchar(255) NOT NULL,
	"request_path" text NOT NULL,
	"response_code" integer,
	"response_body" jsonb,
	"status" varchar(20) DEFAULT 'processing' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);

-- STAGE 5: FOREIGN KEY CONSTRAINTS
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_custom_role_id_workspace_roles_id_fk" FOREIGN KEY ("custom_role_id") REFERENCES "public"."workspace_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_roles" ADD CONSTRAINT "workspace_roles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_folder_id_fkey" FOREIGN KEY ("parent_folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_memory" ADD CONSTRAINT "ai_memory_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_tool_calls" ADD CONSTRAINT "ai_tool_calls_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_tool_calls" ADD CONSTRAINT "ai_tool_calls_message_id_ai_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ai_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_rule_id_automation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

-- STAGE 6: INDEXES AND PARTIAL UNIQUE INDEXES
CREATE UNIQUE INDEX "idx_accounts_provider_account" ON "accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "idx_accounts_user_id" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sessions_token_hash" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_preferences_user_id" ON "user_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email_active" ON "users" USING btree ("email") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_users_active" ON "users" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ws_invites_token_hash" ON "workspace_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_ws_invites_lookup" ON "workspace_invitations" USING btree ("workspace_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ws_members_unique" ON "workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_ws_members_lookup" ON "workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_ws_members_user" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ws_roles_name" ON "workspace_roles" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ws_settings_workspace_id" ON "workspace_settings" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_workspaces_slug_active" ON "workspaces" USING btree ("slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_workspaces_owner" ON "workspaces" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_client" ON "client_contacts" USING btree ("workspace_id","client_id");--> statement-breakpoint
CREATE INDEX "idx_notes_client" ON "client_notes" USING btree ("workspace_id","client_id");--> statement-breakpoint
CREATE INDEX "idx_clients_ws_status" ON "clients" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "idx_clients_deleted" ON "clients" USING btree ("workspace_id","id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_project_members_unique" ON "project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_projects_ws_client" ON "projects" USING btree ("workspace_id","client_id");--> statement-breakpoint
CREATE INDEX "idx_projects_ws_status" ON "projects" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "idx_task_assignees_user" ON "task_assignees" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_task_comments_task" ON "task_comments" USING btree ("workspace_id","task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_task_tags_unique" ON "task_tags" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "idx_tasks_ws_proj" ON "tasks" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_ws_status" ON "tasks" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "idx_tasks_ws_due_date" ON "tasks" USING btree ("workspace_id","due_date");--> statement-breakpoint
CREATE INDEX "idx_tasks_parent" ON "tasks" USING btree ("parent_task_id");--> statement-breakpoint
CREATE INDEX "idx_expenses_ws_cat" ON "expenses" USING btree ("workspace_id","category");--> statement-breakpoint
CREATE INDEX "idx_invoice_items_invoice" ON "invoice_items" USING btree ("workspace_id","invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invoices_number_unique" ON "invoices" USING btree ("workspace_id","invoice_number") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_invoices_ws_status" ON "invoices" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "idx_invoices_ws_due_date" ON "invoices" USING btree ("workspace_id","due_date");--> statement-breakpoint
CREATE INDEX "idx_invoices_client" ON "invoices" USING btree ("workspace_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payments_ws_trans_ref" ON "payments" USING btree ("workspace_id","transaction_reference") WHERE transaction_reference IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_payments_invoice" ON "payments" USING btree ("workspace_id","invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_subscriptions_workspace" ON "subscriptions" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_subscriptions_stripe" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "idx_attachments_lookup" ON "attachments" USING btree ("workspace_id","attached_to_type","attached_to_id");--> statement-breakpoint
CREATE INDEX "idx_documents_ws_folder" ON "documents" USING btree ("workspace_id","folder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_folders_parent_name" ON "folders" USING btree ("workspace_id","parent_folder_id","name") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_folders_ws_parent" ON "folders" USING btree ("workspace_id","parent_folder_id");--> statement-breakpoint
CREATE INDEX "idx_ai_conversations_user" ON "ai_conversations" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_memory_ws_entity" ON "ai_memory" USING btree ("workspace_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_ai_messages_conv" ON "ai_messages" USING btree ("workspace_id","conversation_id");--> statement-breakpoint
CREATE INDEX "idx_ai_tool_calls_msg" ON "ai_tool_calls" USING btree ("workspace_id","message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notif_prefs_user" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifs_user_unread" ON "notifications" USING btree ("recipient_user_id","is_read") WHERE is_read IS FALSE;--> statement-breakpoint
CREATE INDEX "idx_notifs_ws_user" ON "notifications" USING btree ("workspace_id","recipient_user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_ws_entity" ON "audit_logs" USING btree ("workspace_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor" ON "audit_logs" USING btree ("workspace_id","actor_id");--> statement-breakpoint
CREATE INDEX "idx_events_ws_type" ON "events" USING btree ("workspace_id","event_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_outbox_pending" ON "outbox_events" USING btree ("status","created_at") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "idx_automation_rules_ws" ON "automation_rules" USING btree ("workspace_id","trigger_event");--> statement-breakpoint
CREATE INDEX "idx_automation_runs_rule" ON "automation_runs" USING btree ("workspace_id","rule_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_hook" ON "webhook_deliveries" USING btree ("workspace_id","webhook_id");--> statement-breakpoint
CREATE INDEX "idx_webhooks_ws" ON "webhooks" USING btree ("workspace_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_api_keys_hash" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "idx_api_keys_ws" ON "api_keys" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_idempotency_unique" ON "idempotency_keys" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "idx_idempotency_expires" ON "idempotency_keys" USING btree ("expires_at");

-- STAGE 7: POST-TABLE FUNCTIONS (Table-dependent authorization helpers)
CREATE OR REPLACE FUNCTION public.get_user_workspace_ids(p_user_id uuid)
RETURNS SETOF uuid AS $$
BEGIN
  RETURN QUERY
  SELECT workspace_id 
  FROM public.workspace_members 
  WHERE user_id = p_user_id 
    AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp STABLE;

GRANT EXECUTE ON FUNCTION public.get_user_workspace_ids(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_user_workspace_ids(uuid) FROM anon, public;

-- STAGE 8: ROW LEVEL SECURITY ENABLEMENT & POLICIES
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_members_select ON workspace_members FOR SELECT USING (
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

CREATE POLICY clients_tenant_isolation ON clients FOR ALL USING (
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

CREATE POLICY projects_tenant_isolation ON projects FOR ALL USING (
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

CREATE POLICY tasks_tenant_isolation ON tasks FOR ALL USING (
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

CREATE POLICY task_comments_tenant_isolation ON task_comments FOR ALL USING (
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

CREATE POLICY invoices_tenant_isolation ON invoices FOR ALL USING (
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

CREATE POLICY invoice_items_tenant_isolation ON invoice_items FOR ALL USING (
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

CREATE POLICY payments_tenant_isolation ON payments FOR ALL USING (
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

CREATE POLICY documents_tenant_isolation ON documents FOR ALL USING (
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

CREATE POLICY ai_conversations_tenant_isolation ON ai_conversations FOR ALL USING (
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

CREATE POLICY ai_memory_tenant_isolation ON ai_memory FOR ALL USING (
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

CREATE POLICY notifications_user_isolation ON notifications FOR ALL USING (
  recipient_user_id = auth.uid()
  AND workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

CREATE POLICY audit_logs_select ON audit_logs FOR SELECT USING (
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

-- STAGE 9: REALTIME PUBLICATION & GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON task_comments TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications, task_comments;
  ELSE
    CREATE PUBLICATION supabase_realtime FOR TABLE notifications, task_comments;
  END IF;
END $$;