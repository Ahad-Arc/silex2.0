-- SILEX 2.0 Migration: 0003_webhook_deliveries_fk_fix
-- Minimum required additive migration correcting webhook_deliveries.event_id foreign key reference

-- 1. Drop incorrect foreign key constraint if exists (referencing events.id)
ALTER TABLE "webhook_deliveries" DROP CONSTRAINT IF EXISTS "webhook_deliveries_event_id_events_id_fk";

-- 2. Add corrected foreign key constraint referencing outbox_events.id
DO $$ BEGIN
 ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_event_id_outbox_events_id_fk"
   FOREIGN KEY ("event_id") REFERENCES "public"."outbox_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
