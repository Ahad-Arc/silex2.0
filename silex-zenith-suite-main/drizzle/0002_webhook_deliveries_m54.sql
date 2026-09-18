-- SILEX 2.0 Migration: 0002_webhook_deliveries_m54
-- Minimum required additive migration for M5.4 Webhook Dispatcher

-- 1. Add queue columns to webhook_deliveries
ALTER TABLE "webhook_deliveries" ADD COLUMN "claimed_at" timestamp with time zone;
ALTER TABLE "webhook_deliveries" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "webhook_deliveries" ADD COLUMN "next_retry_at" timestamp with time zone;
ALTER TABLE "webhook_deliveries" ADD COLUMN "error_message" text;

-- 2. Add queue indexes for delivery claims and stale claim recovery
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_queue" ON "webhook_deliveries" USING btree ("status","next_retry_at");
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_stale" ON "webhook_deliveries" USING btree ("status","claimed_at") WHERE status = 'processing';
