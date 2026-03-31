/**
 * @fileoverview Tests for StorageMigration service
 *
 * Tests verify fixes for issues identified in CodeRabbit code review:
 * - Unsafe cast of storage type in getCurrentStorageType
 * - patterns.some vs patterns.every in updateGitignore
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorageMigration } from './storage-migration.js';

describe('StorageMigration', () => {
	let tempDir: string;
	let migration: StorageMigration;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-migration-test-'));
		migration = new StorageMigration(tempDir);
	});

	afterEach(() => {
		// Clean up temp directory
		try {
			const files = fs.readdirSync(tempDir);
			for (const file of files) {
				fs.unlinkSync(path.join(tempDir, file));
			}
			fs.rmdirSync(tempDir);
		} catch {
			// Ignore cleanup errors
		}
	});

	// ========================================================================
	// Fix 3: Validate storage type before casting
	// ========================================================================

	describe('getCurrentStorageType validation', () => {
		it('should return "auto" for missing config file', async () => {
			const result = await migration.getCurrentStorageType();
			expect(result).toBe('auto');
		});

		it('should return "auto" for invalid storage type in config', async () => {
			// Create config with invalid storage type
			const configPath = path.join(tempDir, '.taskmaster', 'config.json');
			fs.mkdirSync(path.join(tempDir, '.taskmaster'), { recursive: true });
			fs.writeFileSync(
				configPath,
				JSON.stringify({
					storage: {
						type: 'postgres' // Invalid type - should not be accepted
					}
				})
			);

			const result = await migration.getCurrentStorageType();
			expect(result).toBe('auto');
		});

		it('should return valid storage type from config', async () => {
			const configPath = path.join(tempDir, '.taskmaster', 'config.json');
			fs.mkdirSync(path.join(tempDir, '.taskmaster'), { recursive: true });

			// Test each valid storage type
			const validTypes = ['auto', 'file', 'sqlite', 'api'] as const;

			for (const storageType of validTypes) {
				fs.writeFileSync(
					configPath,
					JSON.stringify({
						storage: {
							type: storageType
						}
					})
				);

				const result = await migration.getCurrentStorageType();
				expect(result).toBe(storageType);
			}
		});

		it('should return "auto" for empty storage config', async () => {
			const configPath = path.join(tempDir, '.taskmaster', 'config.json');
			fs.mkdirSync(path.join(tempDir, '.taskmaster'), { recursive: true });
			fs.writeFileSync(
				configPath,
				JSON.stringify({
					// No storage key
				})
			);

			const result = await migration.getCurrentStorageType();
			expect(result).toBe('auto');
		});

		it('should return "auto" for malformed JSON', async () => {
			const configPath = path.join(tempDir, '.taskmaster', 'config.json');
			fs.mkdirSync(path.join(tempDir, '.taskmaster'), { recursive: true });
			fs.writeFileSync(configPath, 'not valid json {{{');

			const result = await migration.getCurrentStorageType();
			expect(result).toBe('auto');
		});
	});

	// ========================================================================
	// Fix 4: patterns.some vs patterns.every in updateGitignore
	// ========================================================================

	describe('updateGitignore patterns logic', () => {
		// This is a private method, so we test it indirectly through migrateToSqlite
		// For now, we test the logic by creating the .gitignore file scenarios

		it('should add all patterns when none exist', async () => {
			const gitignorePath = path.join(tempDir, '.gitignore');
			fs.writeFileSync(gitignorePath, '# Existing content\nnode_modules/\n');

			// Access private method for testing
			// @ts-expect-error - accessing private method for testing
			await migration.updateGitignore();

			const content = fs.readFileSync(gitignorePath, 'utf-8');

			// Should have all SQLite patterns
			expect(content).toContain('.taskmaster/tasks/tasks.db');
			expect(content).toContain('.taskmaster/tasks/tasks.db-shm');
			expect(content).toContain('.taskmaster/tasks/tasks.db-wal');
		});

		it('should add missing patterns when only some exist', async () => {
			const gitignorePath = path.join(tempDir, '.gitignore');
			// Only has the main db pattern, missing -shm and -wal
			fs.writeFileSync(
				gitignorePath,
				'node_modules/\n.taskmaster/tasks/tasks.db\n'
			);

			// @ts-expect-error - accessing private method for testing
			await migration.updateGitignore();

			const content = fs.readFileSync(gitignorePath, 'utf-8');

			// Bug was: patterns.some() returned true if ANY pattern existed,
			// causing early return and missing patterns
			// Fix: patterns.every() ensures ALL patterns must exist to skip

			// Should have added the missing patterns
			expect(content).toContain('.taskmaster/tasks/tasks.db-shm');
			expect(content).toContain('.taskmaster/tasks/tasks.db-wal');
		});

		it('should not add duplicate patterns when all exist', async () => {
			const gitignorePath = path.join(tempDir, '.gitignore');
			const existingContent = [
				'node_modules/',
				'# TaskMaster SQLite database (use JSONL for git sync)',
				'.taskmaster/tasks/tasks.db',
				'.taskmaster/tasks/tasks.db-shm',
				'.taskmaster/tasks/tasks.db-wal',
				''
			].join('\n');
			fs.writeFileSync(gitignorePath, existingContent);

			// @ts-expect-error - accessing private method for testing
			await migration.updateGitignore();

			const content = fs.readFileSync(gitignorePath, 'utf-8');

			// Count occurrences - should not duplicate
			const dbCount = (
				content.match(/\.taskmaster\/tasks\/tasks\.db(?!-)/g) || []
			).length;
			expect(dbCount).toBe(1);
		});

		it('should create .gitignore if it does not exist', async () => {
			const gitignorePath = path.join(tempDir, '.gitignore');
			expect(fs.existsSync(gitignorePath)).toBe(false);

			// @ts-expect-error - accessing private method for testing
			await migration.updateGitignore();

			expect(fs.existsSync(gitignorePath)).toBe(true);
			const content = fs.readFileSync(gitignorePath, 'utf-8');
			expect(content).toContain('.taskmaster/tasks/tasks.db');
		});
	});
});
