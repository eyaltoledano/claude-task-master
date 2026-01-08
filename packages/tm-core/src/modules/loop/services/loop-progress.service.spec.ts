/**
 * @fileoverview Unit tests for LoopProgressService
 */

import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LoopProgressService, ProgressEntry } from './loop-progress.service.js';

describe('LoopProgressService', () => {
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
	});
});
