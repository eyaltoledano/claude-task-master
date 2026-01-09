/**
 * @fileoverview Unit tests for LoopProgressService
 */

import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LoopProgressService, ProgressEntry } from './loop-progress.service.js';
import {
	LoopProgressService as BarrelLoopProgressService,
	type ProgressEntry as BarrelProgressEntry
} from '../index.js';

describe('LoopProgressService', () => {
	describe('barrel exports', () => {
		it('should export LoopProgressService from loop module index', () => {
			expect(BarrelLoopProgressService).toBe(LoopProgressService);
		});

		it('should export ProgressEntry type from loop module index', () => {
			// Type check - if this compiles, the type is correctly exported
			const entry: BarrelProgressEntry = {
				timestamp: '2026-01-08T10:00:00Z',
				iteration: 1,
				note: 'Test entry'
			};
			expect(entry.timestamp).toBe('2026-01-08T10:00:00Z');
		});
	});

	describe('constructor', () => {
		it('should accept a project root path', () => {
			const service = new LoopProgressService('/my/project');
			expect(service).toBeInstanceOf(LoopProgressService);
		});
	});

	describe('getDefaultProgressPath', () => {
		it('should return correct path for absolute project root', () => {
			const service = new LoopProgressService('/my/project');
			const result = service.getDefaultProgressPath();
			expect(result).toBe(
				path.join('/my/project', '.taskmaster', 'loop-progress.txt')
			);
		});

		it('should return correct path for relative project root', () => {
			const service = new LoopProgressService('./my-project');
			const result = service.getDefaultProgressPath();
			expect(result).toBe(
				path.join('./my-project', '.taskmaster', 'loop-progress.txt')
			);
		});

		it('should return correct path for project root with spaces', () => {
			const service = new LoopProgressService('/my project/with spaces');
			const result = service.getDefaultProgressPath();
			expect(result).toBe(
				path.join('/my project/with spaces', '.taskmaster', 'loop-progress.txt')
			);
		});

		it('should return correct path for nested project root', () => {
			const service = new LoopProgressService('/home/user/projects/app');
			const result = service.getDefaultProgressPath();
			expect(result).toBe(
				path.join(
					'/home/user/projects/app',
					'.taskmaster',
					'loop-progress.txt'
				)
			);
		});
	});

	describe('ProgressEntry type', () => {
		it('should allow entry with taskId', () => {
			const entry: ProgressEntry = {
				timestamp: '2026-01-08T10:00:00Z',
				iteration: 1,
				taskId: '4.1',
				note: 'Started working on task'
			};
			expect(entry.taskId).toBe('4.1');
		});

		it('should allow entry without taskId', () => {
			const entry: ProgressEntry = {
				timestamp: '2026-01-08T10:00:00Z',
				iteration: 2,
				note: 'Initialization complete'
			};
			expect(entry.taskId).toBeUndefined();
		});
	});

	describe('initializeProgressFile', () => {
		let tempDir: string;

		beforeEach(() => {
			tempDir = mkdtempSync(path.join(tmpdir(), 'loop-progress-test-'));
		});

		afterEach(async () => {
			await rm(tempDir, { recursive: true, force: true });
		});

		it('should create progress file with header containing all config values', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, '.taskmaster', 'loop-progress.txt');

			await service.initializeProgressFile(progressFile, {
				preset: 'default',
				iterations: 10
			});

			const content = await readFile(progressFile, 'utf-8');
			expect(content).toContain('# Task Master Loop Progress');
			expect(content).toContain('# Preset: default');
			expect(content).toContain('# Max Iterations: 10');
			expect(content).toContain('---');
		});

		it('should include tag line only when tag is provided', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'progress-with-tag.txt');

			await service.initializeProgressFile(progressFile, {
				preset: 'test-coverage',
				iterations: 5,
				tag: 'feature-branch'
			});

			const content = await readFile(progressFile, 'utf-8');
			expect(content).toContain('# Tag: feature-branch');
		});

		it('should not include tag line when tag is not provided', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'progress-no-tag.txt');

			await service.initializeProgressFile(progressFile, {
				preset: 'linting',
				iterations: 3
			});

			const content = await readFile(progressFile, 'utf-8');
			expect(content).not.toContain('# Tag:');
		});

		it('should include valid ISO timestamp in Started field', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'progress-timestamp.txt');

			const beforeTime = new Date();
			await service.initializeProgressFile(progressFile, {
				preset: 'default',
				iterations: 1
			});
			const afterTime = new Date();

			const content = await readFile(progressFile, 'utf-8');
			const match = content.match(/# Started: (.+)/);
			expect(match).not.toBeNull();

			const timestamp = new Date(match![1]);
			expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
			expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
		});

		it('should create parent directories if they do not exist', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'nested', 'dir', 'progress.txt');

			await service.initializeProgressFile(progressFile, {
				preset: 'default',
				iterations: 1
			});

			const content = await readFile(progressFile, 'utf-8');
			expect(content).toContain('# Task Master Loop Progress');
		});

		it('should overwrite existing progress file', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'existing-progress.txt');

			// Create existing file
			await mkdir(path.dirname(progressFile), { recursive: true });
			await writeFile(progressFile, 'Old content', 'utf-8');

			await service.initializeProgressFile(progressFile, {
				preset: 'new-preset',
				iterations: 20
			});

			const content = await readFile(progressFile, 'utf-8');
			expect(content).not.toContain('Old content');
			expect(content).toContain('# Preset: new-preset');
			expect(content).toContain('# Max Iterations: 20');
		});
	});

	describe('appendProgress', () => {
		let tempDir: string;

		beforeEach(() => {
			tempDir = mkdtempSync(path.join(tmpdir(), 'loop-progress-append-'));
		});

		afterEach(async () => {
			await rm(tempDir, { recursive: true, force: true });
		});

		it('should format line correctly with taskId', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'progress.txt');
			await writeFile(progressFile, '', 'utf-8');

			const entry: ProgressEntry = {
				timestamp: '2026-01-08T10:30:00Z',
				iteration: 3,
				taskId: '4.1',
				note: 'Completed implementation'
			};

			await service.appendProgress(progressFile, entry);

			const content = await readFile(progressFile, 'utf-8');
			expect(content).toBe(
				'[2026-01-08T10:30:00Z] Iteration 3 (Task 4.1): Completed implementation\n'
			);
		});

		it('should format line correctly without taskId', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'progress.txt');
			await writeFile(progressFile, '', 'utf-8');

			const entry: ProgressEntry = {
				timestamp: '2026-01-08T11:00:00Z',
				iteration: 1,
				note: 'Loop initialization complete'
			};

			await service.appendProgress(progressFile, entry);

			const content = await readFile(progressFile, 'utf-8');
			expect(content).toBe(
				'[2026-01-08T11:00:00Z] Iteration 1: Loop initialization complete\n'
			);
		});

		it('should accumulate multiple appends correctly', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'progress.txt');
			await writeFile(progressFile, '# Header\n', 'utf-8');

			await service.appendProgress(progressFile, {
				timestamp: '2026-01-08T10:00:00Z',
				iteration: 1,
				note: 'First entry'
			});

			await service.appendProgress(progressFile, {
				timestamp: '2026-01-08T10:05:00Z',
				iteration: 2,
				taskId: '1.2',
				note: 'Second entry with task'
			});

			await service.appendProgress(progressFile, {
				timestamp: '2026-01-08T10:10:00Z',
				iteration: 3,
				note: 'Third entry'
			});

			const content = await readFile(progressFile, 'utf-8');
			const lines = content.split('\n');

			expect(lines[0]).toBe('# Header');
			expect(lines[1]).toBe('[2026-01-08T10:00:00Z] Iteration 1: First entry');
			expect(lines[2]).toBe(
				'[2026-01-08T10:05:00Z] Iteration 2 (Task 1.2): Second entry with task'
			);
			expect(lines[3]).toBe('[2026-01-08T10:10:00Z] Iteration 3: Third entry');
			expect(lines[4]).toBe(''); // trailing newline
		});

		it('should include newline at end of each entry', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'progress.txt');
			await writeFile(progressFile, '', 'utf-8');

			await service.appendProgress(progressFile, {
				timestamp: '2026-01-08T12:00:00Z',
				iteration: 5,
				note: 'Testing newline'
			});

			const content = await readFile(progressFile, 'utf-8');
			expect(content.endsWith('\n')).toBe(true);
		});

		it('should handle special characters in notes', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'progress.txt');
			await writeFile(progressFile, '', 'utf-8');

			const entry: ProgressEntry = {
				timestamp: '2026-01-08T14:00:00Z',
				iteration: 1,
				note: 'Fixed bug with <loop-complete> marker & special chars: "quotes", \'apostrophes\', $vars, `backticks`'
			};

			await service.appendProgress(progressFile, entry);

			const content = await readFile(progressFile, 'utf-8');
			expect(content).toContain('<loop-complete>');
			expect(content).toContain('&');
			expect(content).toContain('"quotes"');
			expect(content).toContain("'apostrophes'");
			expect(content).toContain('$vars');
			expect(content).toContain('`backticks`');
		});

		it('should handle unicode characters in notes', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'progress.txt');
			await writeFile(progressFile, '', 'utf-8');

			const entry: ProgressEntry = {
				timestamp: '2026-01-08T15:00:00Z',
				iteration: 2,
				taskId: '日本語',
				note: 'Unicode: 你好世界 🚀 émojis — fancy–dashes'
			};

			await service.appendProgress(progressFile, entry);

			const content = await readFile(progressFile, 'utf-8');
			expect(content).toContain('你好世界');
			expect(content).toContain('🚀');
			expect(content).toContain('émojis');
			expect(content).toContain('日本語');
		});

		it('should handle multiline notes by preserving them as-is', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'progress.txt');
			await writeFile(progressFile, '', 'utf-8');

			const multilineNote = 'First line\nSecond line\nThird line';
			const entry: ProgressEntry = {
				timestamp: '2026-01-08T16:00:00Z',
				iteration: 3,
				note: multilineNote
			};

			await service.appendProgress(progressFile, entry);

			const content = await readFile(progressFile, 'utf-8');
			expect(content).toContain('First line\nSecond line\nThird line');
		});
	});

	describe('readProgress', () => {
		let tempDir: string;

		beforeEach(() => {
			tempDir = mkdtempSync(path.join(tmpdir(), 'loop-progress-read-'));
		});

		afterEach(async () => {
			await rm(tempDir, { recursive: true, force: true });
		});

		it('should return content for existing file', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'progress.txt');
			const expectedContent = '# Header\nSome progress content\n';
			await writeFile(progressFile, expectedContent, 'utf-8');

			const result = await service.readProgress(progressFile);

			expect(result).toBe(expectedContent);
		});

		it('should return empty string for missing file', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'nonexistent.txt');

			const result = await service.readProgress(progressFile);

			expect(result).toBe('');
		});

		it('should return empty string for missing directory', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'missing', 'dir', 'progress.txt');

			const result = await service.readProgress(progressFile);

			expect(result).toBe('');
		});

		it('should handle empty file gracefully', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'empty.txt');
			await writeFile(progressFile, '', 'utf-8');

			const result = await service.readProgress(progressFile);

			expect(result).toBe('');
		});

		it('should handle file with only whitespace', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'whitespace.txt');
			await writeFile(progressFile, '   \n\t\n   ', 'utf-8');

			const result = await service.readProgress(progressFile);

			expect(result).toBe('   \n\t\n   ');
		});
	});

	describe('exists', () => {
		let tempDir: string;

		beforeEach(() => {
			tempDir = mkdtempSync(path.join(tmpdir(), 'loop-progress-exists-'));
		});

		afterEach(async () => {
			await rm(tempDir, { recursive: true, force: true });
		});

		it('should return true for existing file', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'progress.txt');
			await writeFile(progressFile, 'content', 'utf-8');

			const result = await service.exists(progressFile);

			expect(result).toBe(true);
		});

		it('should return false for missing file', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'nonexistent.txt');

			const result = await service.exists(progressFile);

			expect(result).toBe(false);
		});

		it('should return false for missing directory', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'missing', 'dir', 'progress.txt');

			const result = await service.exists(progressFile);

			expect(result).toBe(false);
		});

		it('should return true for empty file', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'empty.txt');
			await writeFile(progressFile, '', 'utf-8');

			const result = await service.exists(progressFile);

			expect(result).toBe(true);
		});
	});

	describe('integration: full workflow', () => {
		let tempDir: string;

		beforeEach(() => {
			tempDir = mkdtempSync(path.join(tmpdir(), 'loop-progress-integration-'));
		});

		afterEach(async () => {
			await rm(tempDir, { recursive: true, force: true });
		});

		it('should complete full workflow: initialize, append entries, read back', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = service.getDefaultProgressPath();

			// Step 1: File should not exist initially
			expect(await service.exists(progressFile)).toBe(false);

			// Step 2: Initialize progress file
			await service.initializeProgressFile(progressFile, {
				preset: 'default',
				iterations: 5,
				tag: 'feature-test'
			});

			// Step 3: Verify file exists
			expect(await service.exists(progressFile)).toBe(true);

			// Step 4: Append multiple progress entries
			await service.appendProgress(progressFile, {
				timestamp: '2026-01-08T10:00:00Z',
				iteration: 1,
				taskId: '4.1',
				note: 'Started implementation of progress service'
			});

			await service.appendProgress(progressFile, {
				timestamp: '2026-01-08T10:15:00Z',
				iteration: 2,
				note: 'Completed unit tests'
			});

			await service.appendProgress(progressFile, {
				timestamp: '2026-01-08T10:30:00Z',
				iteration: 3,
				taskId: '4.2',
				note: 'Added integration tests'
			});

			await service.appendProgress(progressFile, {
				timestamp: '2026-01-08T10:45:00Z',
				iteration: 4,
				taskId: '4.3',
				note: 'Refactored error handling'
			});

			await service.appendProgress(progressFile, {
				timestamp: '2026-01-08T11:00:00Z',
				iteration: 5,
				note: 'All tasks complete'
			});

			// Step 5: Read back and verify full content structure
			const content = await service.readProgress(progressFile);

			// Verify header
			expect(content).toContain('# Task Master Loop Progress');
			expect(content).toContain('# Preset: default');
			expect(content).toContain('# Max Iterations: 5');
			expect(content).toContain('# Tag: feature-test');
			expect(content).toContain('---');

			// Verify all entries are present
			expect(content).toContain(
				'[2026-01-08T10:00:00Z] Iteration 1 (Task 4.1): Started implementation of progress service'
			);
			expect(content).toContain(
				'[2026-01-08T10:15:00Z] Iteration 2: Completed unit tests'
			);
			expect(content).toContain(
				'[2026-01-08T10:30:00Z] Iteration 3 (Task 4.2): Added integration tests'
			);
			expect(content).toContain(
				'[2026-01-08T10:45:00Z] Iteration 4 (Task 4.3): Refactored error handling'
			);
			expect(content).toContain(
				'[2026-01-08T11:00:00Z] Iteration 5: All tasks complete'
			);

			// Verify entries are in correct order (line-by-line check)
			const lines = content.split('\n');
			const entryLines = lines.filter((line) => line.startsWith('['));
			expect(entryLines).toHaveLength(5);
			expect(entryLines[0]).toContain('Iteration 1');
			expect(entryLines[1]).toContain('Iteration 2');
			expect(entryLines[2]).toContain('Iteration 3');
			expect(entryLines[3]).toContain('Iteration 4');
			expect(entryLines[4]).toContain('Iteration 5');
		});

		it('should work with default path from projectRoot', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = service.getDefaultProgressPath();

			// Verify path is correctly constructed
			expect(progressFile).toBe(
				path.join(tempDir, '.taskmaster', 'loop-progress.txt')
			);

			// Initialize and verify it creates nested directories
			await service.initializeProgressFile(progressFile, {
				preset: 'test-coverage',
				iterations: 3
			});

			expect(await service.exists(progressFile)).toBe(true);

			// Verify the .taskmaster directory was created
			const taskmasterDir = path.join(tempDir, '.taskmaster');
			const { access: accessCheck } = await import('node:fs/promises');
			await expect(accessCheck(taskmasterDir)).resolves.toBeUndefined();
		});

		it('should handle re-initialization (overwrite existing)', async () => {
			const service = new LoopProgressService(tempDir);
			const progressFile = path.join(tempDir, 'progress.txt');

			// Initialize first time
			await service.initializeProgressFile(progressFile, {
				preset: 'linting',
				iterations: 10
			});

			// Append some entries
			await service.appendProgress(progressFile, {
				timestamp: '2026-01-08T09:00:00Z',
				iteration: 1,
				note: 'First run entry'
			});

			// Re-initialize (simulating new loop run)
			await service.initializeProgressFile(progressFile, {
				preset: 'duplication',
				iterations: 20,
				tag: 'new-run'
			});

			// Verify old content is gone
			const content = await service.readProgress(progressFile);
			expect(content).not.toContain('First run entry');
			expect(content).not.toContain('# Preset: linting');
			expect(content).toContain('# Preset: duplication');
			expect(content).toContain('# Max Iterations: 20');
			expect(content).toContain('# Tag: new-run');
		});
	});
});
