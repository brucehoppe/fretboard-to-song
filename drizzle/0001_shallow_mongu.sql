-- Restored: this migration was listed in drizzle/meta/_journal.json but the SQL file
-- was missing, so fresh databases had no `licks` table and every lick save failed.
-- IF NOT EXISTS keeps it safe for databases where the table was created by hand.
CREATE TABLE IF NOT EXISTS `licks` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
