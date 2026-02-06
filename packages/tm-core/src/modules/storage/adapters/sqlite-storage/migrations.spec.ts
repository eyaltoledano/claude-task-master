/**
 * @fileoverview Tests for MigrationRunner
 *
 * Tests verify:
 * - Transactions wrap migrations to prevent partial application
 * - migrateTo validates target version bounds
 * - Migration history tracking
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SqliteDatabase } from './database.js';
import {
	ALL_MIGRATIONS,
	MigrationRunner,
	type Migration,
	validateMigrations
} from './migrations.js';
import { CURRENT_SCHEMA_VERSION } from './schema.js';

describe('MigrationRunner', () => {
	let tempDir: string;
	let dbPath: string;
	let db: SqliteDatabase;
	let runner: MigrationRunner;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-test-'));
		dbPath = path.join(tempDir, 'test.db');
		db = new SqliteDatabase(dbPath);
		db.initialize();
		runner = new MigrationRunner(db.getDb());
	});

	afterEach(() => {
		db.close();
		// Clean up temp files
		const files = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];
		for (const file of files) {
			try {
				if (fs.existsSync(file)) fs.unlinkSync(file);
			} catch {
				// Ignore
			}
		}
		try {
			fs.rmdirSync(tempDir);
		} catch {
			// Ignore
		}
	});

	describe('getCurrentVersion', () => {
		it('should return current schema version after initialization', () => {
			const version = runner.getCurrentVersion();
			expect(version).toBe(CURRENT_SCHEMA_VERSION);
		});
	});

	describe('migrateTo validation', () => {
		it('should throw error for negative target version', () => {
			expect(() => runner.migrateTo(-1)).toThrow(
				`Invalid target version -1. Must be between 0 and ${CURRENT_SCHEMA_VERSION}.`
			);
		});

		it('should throw error for target version above CURRENT_SCHEMA_VERSION', () => {
			const invalidVersion = CURRENT_SCHEMA_VERSION + 1;
			expect(() => runner.migrateTo(invalidVersion)).toThrow(
				`Invalid target version ${invalidVersion}. Must be between 0 and ${CURRENT_SCHEMA_VERSION}.`
			);
		});

		it('should accept target version of 0', () => {
			// This might fail if migration 1 doesn't support rollback,
			// but the validation should pass
			if (ALL_MIGRATIONS[0]?.down && ALL_MIGRATIONS[0].down.length > 0) {
				expect(() => runner.migrateTo(0)).not.toThrow(/Invalid target version/);
			}
		});

		it('should accept target version equal to CURRENT_SCHEMA_VERSION', () => {
			// Should return 0 (no migrations needed) since we're already at current
			const result = runner.migrateTo(CURRENT_SCHEMA_VERSION);
			expect(result).toBe(0);
		});

		it('should return 0 when already at target version', () => {
			const currentVersion = runner.getCurrentVersion();
			const result = runner.migrateTo(currentVersion);
			expect(result).toBe(0);
		});
	});

	describe('applyMigration transaction safety', () => {
		it('should apply migration in a transaction', () => {
			// Create a test migration
			const testMigration: Migration = {
				version: CURRENT_SCHEMA_VERSION + 1,
				description: 'Test migration',
				up: ['CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)'],
				down: ['DROP TABLE test_table']
			};

			// Apply the migration
			runner.applyMigration(testMigration);

			// Verify table was created
			const tables = db.query<{ name: string }>(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'"
			);
			expect(tables).toHaveLength(1);

			// Verify version was recorded
			const version = runner.getCurrentVersion();
			expect(version).toBe(CURRENT_SCHEMA_VERSION + 1);
		});

		it('should rollback on migration failure', () => {
			const initialVersion = runner.getCurrentVersion();

			// Create a migration that will fail partway through
			const failingMigration: Migration = {
				version: CURRENT_SCHEMA_VERSION + 1,
				description: 'Failing migration',
				up: [
					'CREATE TABLE partial_table (id INTEGER PRIMARY KEY)',
					'INVALID SQL SYNTAX HERE' // This will fail
				]
			};

			// Apply should throw
			expect(() => runner.applyMigration(failingMigration)).toThrow();

			// Verify table was NOT created (rolled back)
			const tables = db.query<{ name: string }>(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='partial_table'"
			);
			expect(tables).toHaveLength(0);

			// Verify version was NOT updated
			const version = runner.getCurrentVersion();
			expect(version).toBe(initialVersion);
		});
	});

	describe('revertMigration', () => {
		it('should throw error for migration without down statements', () => {
			const migrationWithoutDown: Migration = {
				version: 99,
				description: 'No rollback support',
				up: ['SELECT 1']
				// No down property
			};

			expect(() => runner.revertMigration(migrationWithoutDown)).toThrow(
				'Migration 99 does not support rollback'
			);
		});

		it('should throw error for migration with empty down statements', () => {
			const migrationWithEmptyDown: Migration = {
				version: 99,
				description: 'Empty rollback',
				up: ['SELECT 1'],
				down: []
			};

			expect(() => runner.revertMigration(migrationWithEmptyDown)).toThrow(
				'Migration 99 does not support rollback'
			);
		});

		it('should revert migration in a transaction', () => {
			// First apply a test migration
			const testMigration: Migration = {
				version: CURRENT_SCHEMA_VERSION + 1,
				description: 'Test migration for revert',
				up: ['CREATE TABLE revert_test (id INTEGER PRIMARY KEY)'],
				down: ['DROP TABLE revert_test']
			};

			runner.applyMigration(testMigration);

			// Verify table exists
			let tables = db.query<{ name: string }>(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='revert_test'"
			);
			expect(tables).toHaveLength(1);

			// Revert the migration
			runner.revertMigration(testMigration);

			// Verify table was dropped
			tables = db.query<{ name: string }>(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='revert_test'"
			);
			expect(tables).toHaveLength(0);

			// Verify version was reverted
			const version = runner.getCurrentVersion();
			expect(version).toBe(CURRENT_SCHEMA_VERSION);
		});
	});

	describe('validateMigrations', () => {
		it('should validate built-in migrations are in correct order', () => {
			expect(() => validateMigrations()).not.toThrow();
		});
	});

	describe('getMigrationHistory', () => {
		it('should return migration history', () => {
			const history = runner.getMigrationHistory();
			expect(Array.isArray(history)).toBe(true);
			expect(history.length).toBeGreaterThanOrEqual(1);
			expect(history[0]).toHaveProperty('version');
			expect(history[0]).toHaveProperty('applied_at');
		});
	});

	describe('isUpToDate', () => {
		it('should return true when at current schema version', () => {
			expect(runner.isUpToDate()).toBe(true);
		});
	});
});
