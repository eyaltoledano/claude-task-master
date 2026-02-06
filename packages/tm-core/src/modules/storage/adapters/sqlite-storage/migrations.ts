/**
 * @fileoverview Schema migration runner for SQLite storage
 * Provides a simple migration system that tracks version in schema_version table
 * and applies migrations in order.
 */

import type Database from 'libsql';
import {
	CURRENT_SCHEMA_VERSION,
	SCHEMA_VERSION_DESCRIPTIONS
} from './schema.js';

/**
 * Migration definition
 */
export interface Migration {
	/** Version number (must be sequential starting from 1) */
	version: number;
	/** Human-readable description */
	description: string;
	/** SQL statements to apply the migration */
	up: string[];
	/** SQL statements to revert the migration (optional) */
	down?: string[];
}

/**
 * Migration runner for SQLite schema updates
 * Tracks applied migrations in schema_version table and runs pending migrations.
 */
export class MigrationRunner {
	private db: Database.Database;

	constructor(db: Database.Database) {
		this.db = db;
	}

	/**
	 * Get the current schema version from the database
	 * @returns Current version number, or 0 if no migrations applied
	 */
	getCurrentVersion(): number {
		try {
			const stmt = this.db.prepare(
				'SELECT MAX(version) as version FROM schema_version'
			);
			const result = stmt.get() as { version: number | null } | undefined;
			return result?.version ?? 0;
		} catch {
			// Table might not exist yet
			return 0;
		}
	}

	/**
	 * Get all migrations that need to be applied
	 * @returns Array of pending migrations in order
	 */
	getPendingMigrations(): Migration[] {
		const currentVersion = this.getCurrentVersion();
		return ALL_MIGRATIONS.filter((m) => m.version > currentVersion);
	}

	/**
	 * Run all pending migrations
	 * @returns Number of migrations applied
	 */
	runMigrations(): number {
		const pending = this.getPendingMigrations();

		if (pending.length === 0) {
			return 0;
		}

		let applied = 0;

		for (const migration of pending) {
			this.applyMigration(migration);
			applied++;
		}

		return applied;
	}

	/**
	 * Apply a single migration
	 * @param migration - Migration to apply
	 */
	applyMigration(migration: Migration): void {
		// Run migration statements
		for (const sql of migration.up) {
			this.db.exec(sql);
		}

		// Record the migration in schema_version
		const stmt = this.db.prepare(
			"INSERT INTO schema_version (version, applied_at, description) VALUES (?, datetime('now'), ?)"
		);
		stmt.run(migration.version, migration.description);
	}

	/**
	 * Revert a single migration
	 * @param migration - Migration to revert
	 * @throws Error if migration doesn't have down statements
	 */
	revertMigration(migration: Migration): void {
		if (!migration.down || migration.down.length === 0) {
			throw new Error(
				`Migration ${migration.version} does not support rollback`
			);
		}

		// Run rollback statements
		for (const sql of migration.down) {
			this.db.exec(sql);
		}

		// Remove from schema_version
		const stmt = this.db.prepare(
			'DELETE FROM schema_version WHERE version = ?'
		);
		stmt.run(migration.version);
	}

	/**
	 * Migrate to a specific version
	 * @param targetVersion - Target schema version
	 * @returns Number of migrations applied or reverted
	 */
	migrateTo(targetVersion: number): number {
		const currentVersion = this.getCurrentVersion();

		if (targetVersion === currentVersion) {
			return 0;
		}

		if (targetVersion > currentVersion) {
			// Apply migrations up to target
			const migrations = ALL_MIGRATIONS.filter(
				(m) => m.version > currentVersion && m.version <= targetVersion
			);

			for (const migration of migrations) {
				this.applyMigration(migration);
			}

			return migrations.length;
		} else {
			// Revert migrations down to target
			const migrations = ALL_MIGRATIONS.filter(
				(m) => m.version <= currentVersion && m.version > targetVersion
			).reverse();

			for (const migration of migrations) {
				this.revertMigration(migration);
			}

			return migrations.length;
		}
	}

	/**
	 * Get migration history from the database
	 * @returns Array of applied migrations with timestamps
	 */
	getMigrationHistory(): Array<{
		version: number;
		applied_at: string;
		description: string | null;
	}> {
		try {
			const stmt = this.db.prepare(
				'SELECT version, applied_at, description FROM schema_version ORDER BY version'
			);
			return stmt.all() as Array<{
				version: number;
				applied_at: string;
				description: string | null;
			}>;
		} catch {
			return [];
		}
	}

	/**
	 * Check if the database schema is up to date
	 * @returns True if at the latest version
	 */
	isUpToDate(): boolean {
		return this.getCurrentVersion() >= CURRENT_SCHEMA_VERSION;
	}
}

// ============================================================================
// Migration Definitions
// ============================================================================

/**
 * Migration 1: Initial schema
 * This is applied by the initial schema creation, so it's a no-op
 * but we record it for version tracking.
 */
const MIGRATION_1: Migration = {
	version: 1,
	description: SCHEMA_VERSION_DESCRIPTIONS[1],
	up: [
		// Initial schema is created in database.ts, this just records the version
		// The schema_version entry is added automatically
	],
	down: [
		// Cannot revert initial schema - would drop all data
	]
};

// ============================================================================
// Future Migration Examples (commented out)
// ============================================================================

/*
 * Example migration for adding a new column:
 *
 * const MIGRATION_2: Migration = {
 *   version: 2,
 *   description: 'Add due_date column to tasks',
 *   up: [
 *     'ALTER TABLE tasks ADD COLUMN due_date TEXT;',
 *     'CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);'
 *   ],
 *   down: [
 *     'DROP INDEX IF EXISTS idx_tasks_due_date;',
 *     // Note: SQLite doesn't support DROP COLUMN, would need to recreate table
 *   ]
 * };
 */

/*
 * Example migration for adding a new table:
 *
 * const MIGRATION_3: Migration = {
 *   version: 3,
 *   description: 'Add task_comments table',
 *   up: [
 *     `CREATE TABLE IF NOT EXISTS task_comments (
 *       id INTEGER PRIMARY KEY AUTOINCREMENT,
 *       task_id TEXT NOT NULL,
 *       tag TEXT NOT NULL DEFAULT 'master',
 *       content TEXT NOT NULL,
 *       created_at TEXT NOT NULL DEFAULT (datetime('now')),
 *       FOREIGN KEY (task_id, tag) REFERENCES tasks(id, tag) ON DELETE CASCADE
 *     );`,
 *     'CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id, tag);'
 *   ],
 *   down: [
 *     'DROP TABLE IF EXISTS task_comments;'
 *   ]
 * };
 */

// ============================================================================
// All Migrations Registry
// ============================================================================

/**
 * All migrations in order
 * Add new migrations here as they are created
 */
export const ALL_MIGRATIONS: Migration[] = [
	MIGRATION_1
	// Add future migrations here in order:
	// MIGRATION_2,
	// MIGRATION_3,
];

/**
 * Validate that migrations are in correct order
 * Call this during development/testing
 */
export function validateMigrations(): boolean {
	for (let i = 0; i < ALL_MIGRATIONS.length; i++) {
		const migration = ALL_MIGRATIONS[i];
		if (migration.version !== i + 1) {
			throw new Error(
				`Migration at index ${i} has version ${migration.version}, expected ${i + 1}`
			);
		}
	}

	if (ALL_MIGRATIONS.length > 0) {
		const lastVersion = ALL_MIGRATIONS[ALL_MIGRATIONS.length - 1].version;
		if (lastVersion !== CURRENT_SCHEMA_VERSION) {
			throw new Error(
				`Last migration version ${lastVersion} does not match CURRENT_SCHEMA_VERSION ${CURRENT_SCHEMA_VERSION}`
			);
		}
	}

	return true;
}

/**
 * Create a new migration helper
 * @param version - Version number for the new migration
 * @param description - Human-readable description
 * @param up - SQL statements to apply
 * @param down - SQL statements to revert (optional)
 * @returns Migration object
 */
export function createMigration(
	version: number,
	description: string,
	up: string[],
	down?: string[]
): Migration {
	return {
		version,
		description,
		up,
		down
	};
}
