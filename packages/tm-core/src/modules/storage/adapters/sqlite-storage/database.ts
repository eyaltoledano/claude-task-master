/**
 * @fileoverview Database connection and setup for SQLite storage
 * Handles database initialization, connection management, and configuration.
 */

import * as path from 'node:path';
import Database from 'libsql';
import { MigrationRunner } from './migrations.js';
import { COMPLETE_SCHEMA } from './schema.js';
import type { SqliteStorageConfig } from './types.js';
import { DEFAULT_SQLITE_CONFIG } from './types.js';

/**
 * SQLite database wrapper for TaskMaster storage
 * Provides connection management, initialization, and configuration.
 */
export class SqliteDatabase {
	private db: Database.Database;
	private config: Required<SqliteStorageConfig>;
	private initialized: boolean = false;

	/**
	 * Create a new SqliteDatabase instance
	 * @param dbPath - Path to the SQLite database file (or ':memory:' for in-memory)
	 * @param options - Optional configuration overrides
	 */
	constructor(
		dbPath: string,
		options?: Partial<Omit<SqliteStorageConfig, 'dbPath'>>
	) {
		this.config = {
			dbPath,
			...DEFAULT_SQLITE_CONFIG,
			...options
		};

		// Create the database connection
		this.db = new Database(this.config.dbPath);

		// Apply initial pragmas
		this.applyPragmas();
	}

	/**
	 * Apply SQLite pragmas for performance and safety
	 */
	private applyPragmas(): void {
		// Enable WAL mode for better concurrent access
		if (this.config.walMode) {
			this.db.pragma('journal_mode = WAL');
		}

		// Enable foreign key constraints
		if (this.config.foreignKeys) {
			this.db.pragma('foreign_keys = ON');
		}

		// Set busy timeout
		this.db.pragma(`busy_timeout = ${this.config.busyTimeout}`);

		// Additional performance pragmas
		this.db.pragma('synchronous = NORMAL');
		this.db.pragma('cache_size = -64000'); // 64MB cache
		this.db.pragma('temp_store = MEMORY');
	}

	/**
	 * Initialize the database schema
	 * Creates all tables and runs any pending migrations
	 */
	initialize(): void {
		if (this.initialized) {
			return;
		}

		// Create all tables within a transaction
		this.db.exec('BEGIN TRANSACTION');

		try {
			// Apply complete schema
			for (const statement of COMPLETE_SCHEMA) {
				this.db.exec(statement);
			}

			// Run migrations if auto-migrate is enabled
			if (this.config.autoMigrate) {
				const migrationRunner = new MigrationRunner(this.db);
				migrationRunner.runMigrations();
			}

			this.db.exec('COMMIT');
			this.initialized = true;
		} catch (error) {
			this.db.exec('ROLLBACK');
			throw error;
		}
	}

	/**
	 * Get the underlying libsql Database instance
	 * @returns The database instance for direct queries
	 */
	getDb(): Database.Database {
		return this.db;
	}

	/**
	 * Check if the database has been initialized
	 * @returns True if initialize() has been called successfully
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Execute a SQL statement within a transaction
	 * @param callback - Function containing database operations
	 * @returns The result of the callback
	 */
	transaction<T>(callback: () => T): T {
		return this.db.transaction(callback)();
	}

	/**
	 * Run a SELECT query and return all results
	 * @param sql - SQL query string
	 * @param params - Query parameters
	 * @returns Array of result rows
	 */
	query<T = unknown>(sql: string, params?: unknown[]): T[] {
		const stmt = this.db.prepare(sql);
		return (params ? stmt.all(...params) : stmt.all()) as T[];
	}

	/**
	 * Run a SELECT query and return the first result
	 * @param sql - SQL query string
	 * @param params - Query parameters
	 * @returns First result row or undefined
	 */
	queryOne<T = unknown>(sql: string, params?: unknown[]): T | undefined {
		const stmt = this.db.prepare(sql);
		return (params ? stmt.get(...params) : stmt.get()) as T | undefined;
	}

	/**
	 * Run an INSERT, UPDATE, or DELETE statement
	 * @param sql - SQL statement string
	 * @param params - Statement parameters
	 * @returns Database run result with changes and lastInsertRowid
	 */
	run(sql: string, params?: unknown[]): Database.RunResult {
		const stmt = this.db.prepare(sql);
		return params ? stmt.run(...params) : stmt.run();
	}

	/**
	 * Execute raw SQL (for schema changes, multi-statement execution)
	 * @param sql - SQL to execute
	 */
	exec(sql: string): void {
		this.db.exec(sql);
	}

	/**
	 * Prepare a SQL statement for repeated execution
	 * @param sql - SQL statement string
	 * @returns Prepared statement
	 */
	prepare(sql: string): Database.Statement {
		return this.db.prepare(sql);
	}

	/**
	 * Close the database connection
	 * Should be called when the storage is no longer needed
	 */
	close(): void {
		// Checkpoint WAL before closing for durability
		if (this.config.walMode) {
			try {
				this.db.pragma('wal_checkpoint(TRUNCATE)');
			} catch {
				// Ignore checkpoint errors on close
			}
		}
		this.db.close();
		this.initialized = false;
	}

	/**
	 * Vacuum the database to reclaim space
	 */
	vacuum(): void {
		this.db.exec('VACUUM');
	}

	/**
	 * Get database file size in bytes
	 * @returns Size in bytes, or 0 for in-memory databases
	 */
	getSize(): number {
		if (this.config.dbPath === ':memory:') {
			return 0;
		}

		const result = this.queryOne<{ size: number }>(
			'SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()'
		);

		return result?.size ?? 0;
	}

	/**
	 * Check database integrity
	 * @returns True if database passes integrity check
	 */
	checkIntegrity(): boolean {
		const result = this.queryOne<{ integrity_check: string }>(
			'SELECT integrity_check FROM pragma_integrity_check()'
		);
		return result?.integrity_check === 'ok';
	}

	/**
	 * Get the current schema version
	 * @returns Current schema version number, or 0 if not initialized
	 */
	getSchemaVersion(): number {
		try {
			const result = this.queryOne<{ version: number }>(
				'SELECT MAX(version) as version FROM schema_version'
			);
			return result?.version ?? 0;
		} catch {
			return 0;
		}
	}

	/**
	 * Backup the database to a file
	 * @param destPath - Destination path for the backup
	 * @throws Error if destPath contains invalid characters
	 */
	backup(destPath: string): void {
		// Validate path to prevent SQL injection
		// Only allow alphanumeric, path separators, dots, underscores, hyphens, and spaces
		const validPathPattern = /^[a-zA-Z0-9_\-./\\ ]+$/;
		if (!validPathPattern.test(destPath)) {
			throw new Error(
				`Invalid backup path: "${destPath}". Path contains disallowed characters.`
			);
		}

		// Additional check: prevent path traversal attacks
		const normalizedPath = path.resolve(destPath);
		if (normalizedPath.includes("'") || normalizedPath.includes('"')) {
			throw new Error(
				`Invalid backup path: "${destPath}". Path cannot contain quotes.`
			);
		}

		this.db.exec(`VACUUM INTO '${normalizedPath}'`);
	}
}

/**
 * Create a new SQLite database connection with default settings
 * @param dbPath - Path to the database file
 * @returns Initialized SqliteDatabase instance
 */
export function createDatabase(dbPath: string): SqliteDatabase {
	const db = new SqliteDatabase(dbPath);
	db.initialize();
	return db;
}

/**
 * Create an in-memory SQLite database (useful for testing)
 * @returns Initialized in-memory SqliteDatabase instance
 */
export function createInMemoryDatabase(): SqliteDatabase {
	const db = new SqliteDatabase(':memory:');
	db.initialize();
	return db;
}
