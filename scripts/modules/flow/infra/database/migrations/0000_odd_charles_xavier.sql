CREATE TABLE `sync_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`operation` text NOT NULL,
	`table_name` text,
	`record_key` text,
	`details_json` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `sync_metadata` (
	`table_name` text NOT NULL,
	`record_key` text NOT NULL,
	`last_json_hash` text,
	`last_db_hash` text,
	`last_sync_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`conflict_status` text DEFAULT 'none',
	PRIMARY KEY(`table_name`, `record_key`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`metadata_json` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `task_dependencies` (
	`task_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	`depends_on_task_id` integer NOT NULL,
	`depends_on_tag_id` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	PRIMARY KEY(`task_id`, `tag_id`, `depends_on_task_id`, `depends_on_tag_id`),
	FOREIGN KEY (`task_id`,`tag_id`) REFERENCES `tasks`(`id`,`tag_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`depends_on_task_id`,`depends_on_tag_id`) REFERENCES `tasks`(`id`,`tag_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	`parent_task_id` integer,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`priority` text DEFAULT 'medium',
	`details` text,
	`test_strategy` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	PRIMARY KEY(`id`, `tag_id`),
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_task_id`,`tag_id`) REFERENCES `tasks`(`id`,`tag_id`) ON UPDATE no action ON DELETE no action
);
