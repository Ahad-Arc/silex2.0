-- SILEX 2.0 Migration: 0001_outbox_m53_hardening
-- Minimum required additive migration for M5.3 Workflow Execution Engine & Outbox Processor

-- 1. Add claim timestamp and actor tracking to outbox_events
ALTER TABLE "outbox_events" ADD COLUMN "claimed_at" timestamp with time zone;
ALTER TABLE "outbox_events" ADD COLUMN "actor_id" uuid;

DO $$ BEGIN
 ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- 2. Add outbox_event_id to automation_runs
ALTER TABLE "automation_runs" ADD COLUMN "outbox_event_id" uuid;

DO $$ BEGIN
 ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_outbox_event_id_outbox_events_id_fk" FOREIGN KEY ("outbox_event_id") REFERENCES "public"."outbox_events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- 3. Add composite indexes for stale processing claims and automation run lookup
CREATE INDEX IF NOT EXISTS "idx_outbox_events_stale_claim" ON "outbox_events" USING btree ("status","claimed_at") WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS "idx_automation_runs_outbox_event_id" ON "automation_runs" USING btree ("workspace_id","outbox_event_id");
