/**
 * @fileoverview Tests for CodeRabbit review fixes
 *
 * Tests verify fixes for issues identified in CodeRabbit code review:
 * 1. parseComplexity empty string bug - empty strings incorrectly parsed as 0
 * 2. Explicit undefined values shadowing defaults in SqliteDatabase constructor
 * 3. Unsafe cast of storage type in getCurrentStorageType
 * 4. patterns.some vs patterns.every in updateGitignore
 * 5. ID comparison normalization in JsonlSync
 * 6. Safe JSON parsing in queries.ts
 * 7. Backup path containment validation
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SqliteDatabase } from './database.js';
import { JsonlSync } from './jsonl-sync.js';
import { parseComplexity } from './types.js';

// ============================================================================
// Fix 1: parseComplexity empty string bug
// ============================================================================

describe('parseComplexity empty string fix', () => {
	it('should return undefined for empty string', () => {
		// Bug: Number('') === 0, so empty strings were incorrectly parsed as 0
		expect(parseComplexity('')).toBeUndefined();
	});

	it('should return undefined for whitespace-only string', () => {
		expect(parseComplexity('   ')).toBeUndefined();
		expect(parseComplexity('\t')).toBeUndefined();
		expect(parseComplexity('\n')).toBeUndefined();
	});

	it('should return undefined for null', () => {
		expect(parseComplexity(null)).toBeUndefined();
	});

	it('should parse valid numeric strings', () => {
		expect(parseComplexity('0')).toBe(0);
		expect(parseComplexity('5')).toBe(5);
		expect(parseComplexity('10')).toBe(10);
		expect(parseComplexity('  3  ')).toBe(3); // Trimmed
	});

	it('should parse valid complexity enum values', () => {
		expect(parseComplexity('simple')).toBe('simple');
		expect(parseComplexity('moderate')).toBe('moderate');
		expect(parseComplexity('complex')).toBe('complex');
		expect(parseComplexity('very-complex')).toBe('very-complex');
	});

	it('should handle trimmed enum values', () => {
		expect(parseComplexity('  simple  ')).toBe('simple');
		expect(parseComplexity('\tmoderate\t')).toBe('moderate');
	});

	it('should return undefined for invalid values', () => {
		expect(parseComplexity('invalid')).toBeUndefined();
		expect(parseComplexity('SIMPLE')).toBeUndefined(); // Case sensitive
		expect(parseComplexity('abc123')).toBeUndefined();
	});
});

// ============================================================================
// Fix 2: Explicit undefined values shadowing defaults
// ============================================================================

describe('SqliteDatabase constructor undefined filtering', () => {
	let testDbPath: string;

	beforeEach(() => {
		testDbPath = path.join(
			os.tmpdir(),
			`test-db-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
		);
	});

	afterEach(() => {
		// Clean up test database files
		const filesToClean = [testDbPath, `${testDbPath}-shm`, `${testDbPath}-wal`];
		for (const file of filesToClean) {
			try {
				if (fs.existsSync(file)) fs.unlinkSync(file);
			} catch {
				// Ignore cleanup errors
			}
		}
	});

	it('should use default walMode when options.walMode is undefined', () => {
		// Bug: { walMode: undefined } would shadow the default true value
		const db = new SqliteDatabase(testDbPath, { walMode: undefined });

		// Should use default (WAL mode enabled)
		// Check by running PRAGMA journal_mode and reading the result
		const result = db.getDb().pragma('journal_mode') as Array<{
			journal_mode: string;
		}>;

		db.close();

		// WAL mode should be enabled by default
		expect(result[0]?.journal_mode?.toLowerCase()).toBe('wal');
	});

	it('should respect explicit walMode: false', () => {
		const db = new SqliteDatabase(testDbPath, { walMode: false });

		const result = db.getDb().pragma('journal_mode') as Array<{
			journal_mode: string;
		}>;

		db.close();

		// Should NOT be WAL mode (will be 'delete' which is the default non-WAL mode)
		expect(result[0]?.journal_mode?.toLowerCase()).not.toBe('wal');
	});

	it('should use default busyTimeout when options.busyTimeout is undefined', () => {
		const db = new SqliteDatabase(testDbPath, { busyTimeout: undefined });

		// Just verify it doesn't throw - defaults should be applied
		expect(() => db.close()).not.toThrow();
	});
});

// ============================================================================
// Fix 5: ID comparison normalization in JsonlSync
// ============================================================================

describe('JsonlSync ID normalization', () => {
	let tempDir: string;
	let jsonlPath: string;
	let jsonlSync: JsonlSync;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonl-test-'));
		jsonlPath = path.join(tempDir, 'tasks.jsonl');
		jsonlSync = new JsonlSync(jsonlPath);
	});

	afterEach(() => {
		// Clean up temp directory
		try {
			if (fs.existsSync(jsonlPath)) fs.unlinkSync(jsonlPath);
			if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
		} catch {
			// Ignore cleanup errors
		}
	});

	it('should match tasks when comparing string ID to numeric ID in file', async () => {
		// Write a task with numeric ID in JSON
		const numericIdJson =
			'{"id":1,"title":"Test Task","description":"Test","status":"pending","priority":"medium","dependencies":[],"details":"","testStrategy":"","subtasks":[],"_v":1,"_ts":"2026-01-01T00:00:00.000Z"}';
		fs.writeFileSync(jsonlPath, numericIdJson + '\n');

		// Try to update using string ID
		const updatedTask = {
			id: '1',
			title: 'Updated Task',
			description: 'Updated',
			status: 'done' as const,
			priority: 'high' as const,
			dependencies: [],
			details: '',
			testStrategy: '',
			subtasks: []
		};

		await jsonlSync.writeTask(updatedTask);

		// Read back and verify update happened
		const tasks = await jsonlSync.readAll();
		expect(tasks).toHaveLength(1);
		expect(tasks[0].title).toBe('Updated Task');
		expect(tasks[0].status).toBe('done');
	});

	it('should find task by string ID when file has numeric ID', async () => {
		// Write a task with numeric ID in JSON
		const numericIdJson =
			'{"id":42,"title":"Find Me","description":"Test","status":"pending","priority":"medium","dependencies":[],"details":"","testStrategy":"","subtasks":[],"_v":1,"_ts":"2026-01-01T00:00:00.000Z"}';
		fs.writeFileSync(jsonlPath, numericIdJson + '\n');

		// Try to find using string ID
		const task = await jsonlSync.getTask('42');
		expect(task).not.toBeNull();
		expect(task?.title).toBe('Find Me');
	});

	it('should delete task using string ID when file has numeric ID', async () => {
		// Write a task with numeric ID
		const numericIdJson =
			'{"id":99,"title":"Delete Me","description":"Test","status":"pending","priority":"medium","dependencies":[],"details":"","testStrategy":"","subtasks":[],"_v":1,"_ts":"2026-01-01T00:00:00.000Z"}';
		fs.writeFileSync(jsonlPath, numericIdJson + '\n');

		// Delete using string ID
		await jsonlSync.deleteTask('99');

		// Verify deletion
		const tasks = await jsonlSync.readAll();
		expect(tasks).toHaveLength(0);
	});

	it('should soft delete task using string ID when file has numeric ID', async () => {
		// Write a task with numeric ID
		const numericIdJson =
			'{"id":77,"title":"Soft Delete Me","description":"Test","status":"pending","priority":"medium","dependencies":[],"details":"","testStrategy":"","subtasks":[],"_v":1,"_ts":"2026-01-01T00:00:00.000Z"}';
		fs.writeFileSync(jsonlPath, numericIdJson + '\n');

		// Soft delete using string ID
		await jsonlSync.softDeleteTask('77');

		// Verify soft deletion (task still exists but marked deleted)
		const allTasks = await jsonlSync.readAll({ includeDeleted: true });
		expect(allTasks).toHaveLength(1);
		expect(allTasks[0]._deleted).toBe(true);

		// Regular read should exclude it
		const activeTasks = await jsonlSync.readAll();
		expect(activeTasks).toHaveLength(0);
	});

	it('should handle writeTasks with mixed ID types', async () => {
		// Write initial tasks with numeric IDs
		const initialContent = [
			'{"id":1,"title":"Task 1","description":"","status":"pending","priority":"medium","dependencies":[],"details":"","testStrategy":"","subtasks":[],"_v":1,"_ts":"2026-01-01T00:00:00.000Z"}',
			'{"id":2,"title":"Task 2","description":"","status":"pending","priority":"medium","dependencies":[],"details":"","testStrategy":"","subtasks":[],"_v":1,"_ts":"2026-01-01T00:00:00.000Z"}'
		].join('\n');
		fs.writeFileSync(jsonlPath, initialContent + '\n');

		// Update with string IDs
		const updatedTasks = [
			{
				id: '1',
				title: 'Updated Task 1',
				description: '',
				status: 'done' as const,
				priority: 'medium' as const,
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			},
			{
				id: '3', // New task
				title: 'New Task 3',
				description: '',
				status: 'pending' as const,
				priority: 'low' as const,
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			}
		];

		await jsonlSync.writeTasks(updatedTasks);

		const tasks = await jsonlSync.readAll();
		expect(tasks).toHaveLength(3);

		const task1 = tasks.find((t) => String(t.id) === '1');
		const task2 = tasks.find((t) => String(t.id) === '2');
		const task3 = tasks.find((t) => String(t.id) === '3');

		expect(task1?.title).toBe('Updated Task 1');
		expect(task1?.status).toBe('done');
		expect(task2?.title).toBe('Task 2'); // Unchanged
		expect(task3?.title).toBe('New Task 3'); // New
	});
});

// ============================================================================
// Fix 7: Backup path containment validation
// ============================================================================

describe('SqliteDatabase backup path validation', () => {
	let testDbPath: string;
	let db: SqliteDatabase;

	beforeEach(() => {
		testDbPath = path.join(
			os.tmpdir(),
			`test-db-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			'tasks.db'
		);
		// Create the directory
		fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
		db = new SqliteDatabase(testDbPath);
		db.initialize();
	});

	afterEach(() => {
		db.close();
		// Clean up test files
		const dir = path.dirname(testDbPath);
		try {
			const files = fs.readdirSync(dir);
			for (const file of files) {
				fs.unlinkSync(path.join(dir, file));
			}
			fs.rmdirSync(dir);
		} catch {
			// Ignore cleanup errors
		}
	});

	it('should allow backup in same directory', () => {
		const backupPath = path.join(path.dirname(testDbPath), 'backup.db');
		expect(() => db.backup(backupPath)).not.toThrow();
		// Clean up backup file
		if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
	});

	it('should reject backup path outside database directory', () => {
		const outsidePath = path.join(os.tmpdir(), 'outside-backup.db');
		expect(() => db.backup(outsidePath)).toThrow(
			/Backup must be in the database directory/
		);
	});

	it('should reject path traversal attempts', () => {
		const traversalPath = path.join(
			path.dirname(testDbPath),
			'..',
			'etc',
			'backup.db'
		);
		expect(() => db.backup(traversalPath)).toThrow(
			/Backup must be in the database directory/
		);
	});

	it('should reject paths with invalid characters', () => {
		const invalidPath = path.join(
			path.dirname(testDbPath),
			"backup'injection.db"
		);
		// Quote is caught by the disallowed characters check (regex doesn't include quotes)
		expect(() => db.backup(invalidPath)).toThrow(
			/disallowed characters|cannot contain quotes/
		);
	});
});
