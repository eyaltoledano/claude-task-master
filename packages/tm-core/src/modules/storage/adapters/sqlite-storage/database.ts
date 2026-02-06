/**
 * @fileoverview Database connection and setup for SQLite storage
 * Handles database initialization, connection management, and configuration.
 */

import * as path from 'node:path';
import { MigrationRunner } from './migrations.js';
import { COMPLETE_SCHEMA } from './schema.js';
import type { SqliteStorageConfig } from './types.js';
import { DEFAULT_SQLITE_CONFIG } from './types.js';

// Type alias for the libsql Database - imported dynamically
type LibsqlDatabase = import('libsql').Database;

/**
 * SQLite database wrapper for TaskMaster storage
 * Provides connection management, initialization, and configuration.
 */
export class SqliteDatabase {
	private db: LibsqlDatabase | null = null;
	private config: Required<SqliteStorageConfig>;
	private initialized: boolean = false;

	/**
	 * Create a new SqliteDatabase instance
	 * Note: Call open() to establish the database connection
	 * @param dbPath - Path to the SQLite database file (or ':memory:' for in-memory)
	 * @param options - Optional configuration overrides
	 */
	constructor(
		dbPath: string,
		options?: Partial<Omit<SqliteStorageConfig, 'dbPath'>>
	) {
		// Filter out undefined values from options so they don't shadow defaults
		// (e.g., { walMode: undefined } would overwrite DEFAULT_SQLITE_CONFIG.walMode)
		const definedOptions = options
			? Object.fromEntries(
					Object.entries(options).filter(([, v]) => v !== undefined)
				)
			: {};

		this.config = {
			dbPath,
			...DEFAULT_SQLITE_CONFIG,
			...definedOptions
		};
	}

	/**
	 * Open the database connection
	 * Uses dynamic import to load libsql, allowing graceful degradation
	 * when the optional dependency is not available.
	 * @throws Error if libsql is not installed or cannot be loaded
	 */
	async open(): Promise<void> {
		if (this.db) {
			return; // Already open
		}

		try {
			// Dynamic import to handle optional dependency
			const libsql = await import('libsql');
			const Database = libsql.default;

			// Create the database connection
			this.db = new Database(this.config.dbPath);

			// Apply initial pragmas
			this.applyPragmas();
		} catch (error) {
			const err = error as Error & { code?: string };
			if (
				err.code === 'ERR_MODULE_NOT_FOUND' ||
				err.message?.includes('Cannot find module')
			) {
				throw new Error(
					'SQLite storage requires the libsql package. ' +
						'Install it with: npm install libsql'
				);
			}
			throw error;
		}
	}

	/**
	 * Ensure the database connection is open
	 * @throws Error if database is not connected
	 */
	private ensureOpen(): LibsqlDatabase {
		if (!this.db) {
			throw new Error(
				'Database not connected. Call open() before using the database.'
			);
		}
		return this.db;
	}

	/**
	 * Apply SQLite pragmas for performance and safety
	 */
	private applyPragmas(): void {
		const db = this.ensureOpen();

		// Enable WAL mode for better concurrent access
		if (this.config.walMode) {
			db.pragma('journal_mode = WAL');
		}

		// Enable foreign key constraints
		if (this.config.foreignKeys) {
			db.pragma('foreign_keys = ON');
		}

		// Set busy timeout
		db.pragma(`busy_timeout = ${this.config.busyTimeout}`);

		// Additional performance pragmas
		db.pragma('synchronous = NORMAL');
		db.pragma('cache_size = -64000'); // 64MB cache
		db.pragma('temp_store = MEMORY');
	}

	/**
	 * Initialize the database schema
	 * Creates all tables and runs any pending migrations
	 */
	initialize(): void {
		const db = this.ensureOpen();

		if (this.initialized) {
			return;
		}

		// Create all tables within a transaction
		db.exec('BEGIN TRANSACTION');

		try {
			// Apply complete schema
			for (const statement of COMPLETE_SCHEMA) {
				db.exec(statement);
			}

			// Run migrations if auto-migrate is enabled
			if (this.config.autoMigrate) {
				const migrationRunner = new MigrationRunner(db);
				migrationRunner.runMigrations();
			}

			db.exec('COMMIT');
			this.initialized = true;
		} catch (error) {
			db.exec('ROLLBACK');
			throw error;
		}
	}

	/**
	 * Get the underlying libsql Database instance
	 * @returns The database instance for direct queries
	 */
	getDb(): LibsqlDatabase {
		return this.ensureOpen();
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
		return this.ensureOpen().transaction(callback)();
	}

	/**
	 * Run a SELECT query and return all results
	 * @param sql - SQL query string
	 * @param params - Query parameters
	 * @returns Array of result rows
	 */
	query<T = unknown>(sql: string, params?: unknown[]): T[] {
		const stmt = this.ensureOpen().prepare(sql);
		return (params ? stmt.all(...params) : stmt.all()) as T[];
	}

	/**
	 * Run a SELECT query and return the first result
	 * @param sql - SQL query string
	 * @param params - Query parameters
	 * @returns First result row or undefined
	 */
	queryOne<T = unknown>(sql: string, params?: unknown[]): T | undefined {
		const stmt = this.ensureOpen().prepare(sql);
		return (params ? stmt.get(...params) : stmt.get()) as T | undefined;
	}

	/**
	 * Run an INSERT, UPDATE, or DELETE statement
	 * @param sql - SQL statement string
	 * @param params - Statement parameters
	 * @returns Database run result with changes and lastInsertRowid
	 */
	run(sql: string, params?: unknown[]): import('libsql').RunResult {
		const stmt = this.ensureOpen().prepare(sql);
		return params ? stmt.run(...params) : stmt.run();
	}

	/**
	 * Execute raw SQL (for schema changes, multi-statement execution)
	 * @param sql - SQL to execute
	 */
	exec(sql: string): void {
		this.ensureOpen().exec(sql);
	}

	/**
	 * Prepare a SQL statement for repeated execution
	 * @param sql - SQL statement string
	 * @returns Prepared statement
	 */
	prepare(sql: string): import('libsql').Statement {
		return this.ensureOpen().prepare(sql);
	}

	/**
	 * Close the database connection
	 * Should be called when the storage is no longer needed
	 */
	close(): void {
		if (!this.db) {
			return; // Already closed or never opened
		}

		// Checkpoint WAL before closing for durability
		if (this.config.walMode) {
			try {
				this.db.pragma('wal_checkpoint(TRUNCATE)');
			} catch {
				// Ignore checkpoint errors on close
			}
		}
		this.db.close();
		this.db = null;
		this.initialized = false;
	}

	/**
	 * Vacuum the database to reclaim space
	 */
	vacuum(): void {
		this.ensureOpen().exec('VACUUM');
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
	 * @throws Error if destPath contains invalid characters or is outside allowed directory
	 */
	backup(destPath: string): void {
		// Resolve the path first since that's what gets used in SQL
		const normalizedPath = path.resolve(destPath);

		// Validate normalized path to prevent SQL injection
		// Only allow alphanumeric, path separators, dots, underscores, hyphens, spaces, and drive letters (Windows)
		const validPathPattern = /^[a-zA-Z0-9_\-./\\ :]+$/;
		if (!validPathPattern.test(normalizedPath)) {
			throw new Error(
				`Invalid backup path: "${destPath}". Resolved path contains disallowed characters.`
			);
		}

		// Check for quotes which could break SQL
		if (normalizedPath.includes("'") || normalizedPath.includes('"')) {
			throw new Error(
				`Invalid backup path: "${destPath}". Path cannot contain quotes.`
			);
		}

		// Containment check: backup must be in same directory as database
		// This prevents path traversal attacks (e.g., ../../etc/backup.db)
		const dbDir = path.resolve(path.dirname(this.config.dbPath));
		const backupDir = path.dirname(normalizedPath);
		if (!backupDir.startsWith(dbDir)) {
			throw new Error(
				`Invalid backup path: "${destPath}". Backup must be in the database directory or subdirectory.`
			);
		}

		this.ensureOpen().exec(`VACUUM INTO '${normalizedPath}'`);
	}
}

/**
 * Create a new SQLite database connection with default settings
 * @param dbPath - Path to the database file
 * @returns Initialized SqliteDatabase instance
 */
export async function createDatabase(dbPath: string): Promise<SqliteDatabase> {
	const db = new SqliteDatabase(dbPath);
	await db.open();
	db.initialize();
	return db;
}

/**
 * Create an in-memory SQLite database (useful for testing)
 * @returns Initialized in-memory SqliteDatabase instance
 */
export async function createInMemoryDatabase(): Promise<SqliteDatabase> {
	const db = new SqliteDatabase(':memory:');
	await db.open();
	db.initialize();
	return db;
}
