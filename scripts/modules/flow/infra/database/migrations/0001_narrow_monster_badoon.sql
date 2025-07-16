PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sync_metadata` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`table_name` text NOT NULL,
	`record_key` text NOT NULL,
	`last_json_hash` text,
	`last_db_hash` text,
	`last_sync_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`conflict_status` text DEFAULT 'none'
);
--> statement-breakpoint
INSERT INTO `__new_sync_metadata`("table_name", "record_key", "last_json_hash", "last_db_hash", "last_sync_at", "conflict_status") SELECT "table_name", "record_key", "last_json_hash", "last_db_hash", "last_sync_at", "conflict_status" FROM `sync_metadata`;--> statement-breakpoint
DROP TABLE `sync_metadata`;--> statement-breakpoint
ALTER TABLE `__new_sync_metadata` RENAME TO `sync_metadata`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `sync_metadata_table_name_record_key_unique` ON `sync_metadata` (`table_name`,`record_key`);