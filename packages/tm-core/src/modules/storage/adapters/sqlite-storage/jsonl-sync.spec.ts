/**
 * Tests for JSONL sync module
 *
 * Tests the JSONL synchronization layer that provides git-friendly persistence
 * for the SQLite storage backend.
 */

import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Task } from '../../../../common/types/index.js';
import { JsonlSync } from './jsonl-sync.js';

/**
 * Create a test task
 */
function createTestTask(overrides: Partial<Task> = {}): Task {
	return {
		id: '1',
		title: 'Test Task',
		description: 'Test description',
		status: 'pending',
		priority: 'medium',
		dependencies: [],
		details: 'Test details',
		testStrategy: 'Test strategy',
		subtasks: [],
		...overrides
	};
}

describe('JsonlSync', () => {
	let tempDir: string;
	let jsonlPath: string;
	let sync: JsonlSync;

	beforeEach(async () => {
		// Create a temp directory for each test
		tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'jsonl-sync-test-'));
		jsonlPath = path.join(tempDir, 'tasks.jsonl');
		sync = new JsonlSync(jsonlPath);
	});

	afterEach(async () => {
		if (tempDir && fsSync.existsSync(tempDir)) {
			fsSync.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('exportAll', () => {
		it('should write tasks to JSONL file', async () => {
			const tasks = [
				createTestTask({ id: '1', title: 'Task 1' }),
				createTestTask({ id: '2', title: 'Task 2' })
			];

			await sync.exportAll(tasks);

			expect(fsSync.existsSync(jsonlPath)).toBe(true);
			const content = await fs.readFile(jsonlPath, 'utf-8');
			const lines = content.trim().split('\n');

			expect(lines).toHaveLength(2);
			expect(JSON.parse(lines[0]).id).toBe('1');
			expect(JSON.parse(lines[1]).id).toBe('2');
		});

		it('should include metadata fields', async () => {
			const task = createTestTask({ id: '1' });
			await sync.exportAll([task]);

			const content = await fs.readFile(jsonlPath, 'utf-8');
			const parsed = JSON.parse(content.trim());

			// Should have version and timestamp metadata
			expect(parsed._v).toBeDefined();
			expect(parsed._ts).toBeDefined();
		});

		it('should create parent directories', async () => {
			const nestedPath = path.join(tempDir, 'nested', 'dir', 'tasks.jsonl');
			const nestedSync = new JsonlSync(nestedPath);

			await nestedSync.exportAll([createTestTask()]);

			expect(fsSync.existsSync(nestedPath)).toBe(true);
		});

		it('should handle empty task list', async () => {
			await sync.exportAll([]);

			const content = await fs.readFile(jsonlPath, 'utf-8');
			expect(content.trim()).toBe('');
		});

		it('should handle tasks with subtasks', async () => {
			const task = createTestTask({
				id: '1',
				subtasks: [
					{
						id: 1,
						parentId: '1',
						title: 'Subtask 1',
						description: 'desc',
						status: 'pending',
						priority: 'low',
						dependencies: [],
						details: '',
						testStrategy: ''
					}
				]
			});

			await sync.exportAll([task]);

			const content = await fs.readFile(jsonlPath, 'utf-8');
			const parsed = JSON.parse(content.trim());

			expect(parsed.subtasks).toHaveLength(1);
			expect(parsed.subtasks[0].title).toBe('Subtask 1');
		});

		it('should overwrite existing content', async () => {
			// Write initial content
			await sync.exportAll([createTestTask({ id: '1' })]);

			// Write new content
			await sync.exportAll([createTestTask({ id: '2' })]);

			const content = await fs.readFile(jsonlPath, 'utf-8');
			const lines = content.trim().split('\n');

			expect(lines).toHaveLength(1);
			expect(JSON.parse(lines[0]).id).toBe('2');
		});
	});

	describe('readAll', () => {
		it('should read tasks from JSONL file', async () => {
			const tasks = [
				createTestTask({ id: '1', title: 'Task 1' }),
				createTestTask({ id: '2', title: 'Task 2' })
			];
			await sync.exportAll(tasks);

			const loaded = await sync.readAll();

			expect(loaded).toHaveLength(2);
			expect(loaded[0].id).toBe('1');
			expect(loaded[1].id).toBe('2');
		});

		it('should return empty when file does not exist', async () => {
			const loaded = await sync.readAll();
			expect(loaded).toEqual([]);
		});

		it('should handle malformed lines gracefully', async () => {
			// Write a file with some invalid JSON
			await fs.writeFile(
				jsonlPath,
				'{"id":"1","title":"Valid","status":"pending","priority":"medium","dependencies":[],"description":"","details":"","testStrategy":"","subtasks":[],"_v":1,"_ts":"2024-01-01"}\n' +
					'invalid json line\n' +
					'{"id":"2","title":"Also Valid","status":"pending","priority":"medium","dependencies":[],"description":"","details":"","testStrategy":"","subtasks":[],"_v":1,"_ts":"2024-01-01"}\n'
			);

			const loaded = await sync.readAll();

			// Should skip invalid lines and load valid ones
			expect(loaded).toHaveLength(2);
			expect(loaded[0].id).toBe('1');
			expect(loaded[1].id).toBe('2');
		});

		it('should filter out deleted tasks by default', async () => {
			// Write tasks, one marked as deleted
			await fs.writeFile(
				jsonlPath,
				'{"id":"1","title":"Task 1","status":"pending","priority":"medium","dependencies":[],"description":"","details":"","testStrategy":"","subtasks":[],"_v":1,"_ts":"2024-01-01"}\n' +
					'{"id":"2","title":"Deleted","status":"pending","priority":"medium","dependencies":[],"description":"","details":"","testStrategy":"","subtasks":[],"_v":1,"_ts":"2024-01-01","_deleted":true}\n'
			);

			const loaded = await sync.readAll();
			expect(loaded).toHaveLength(1);
			expect(loaded[0].id).toBe('1');
		});

		it('should include deleted tasks when requested', async () => {
			await fs.writeFile(
				jsonlPath,
				'{"id":"1","title":"Task 1","status":"pending","priority":"medium","dependencies":[],"description":"","details":"","testStrategy":"","subtasks":[],"_v":1,"_ts":"2024-01-01"}\n' +
					'{"id":"2","title":"Deleted","status":"pending","priority":"medium","dependencies":[],"description":"","details":"","testStrategy":"","subtasks":[],"_v":1,"_ts":"2024-01-01","_deleted":true}\n'
			);

			const loaded = await sync.readAll({ includeDeleted: true });
			expect(loaded).toHaveLength(2);
		});
	});

	describe('exists', () => {
		it('should return true when file exists', async () => {
			await sync.exportAll([createTestTask()]);
			expect(sync.exists()).toBe(true);
		});

		it('should return false when file does not exist', () => {
			expect(sync.exists()).toBe(false);
		});
	});

	describe('writeTasks', () => {
		it('should update existing tasks', async () => {
			await sync.exportAll([createTestTask({ id: '1', title: 'Original' })]);

			await sync.writeTasks([createTestTask({ id: '1', title: 'Updated' })]);

			const loaded = await sync.readAll();
			expect(loaded).toHaveLength(1);
			expect(loaded[0].title).toBe('Updated');
		});

		it('should append new tasks', async () => {
			await sync.exportAll([createTestTask({ id: '1' })]);

			await sync.writeTasks([createTestTask({ id: '2', title: 'New Task' })]);

			const loaded = await sync.readAll();
			expect(loaded).toHaveLength(2);
			const ids = loaded.map((t) => t.id);
			expect(ids).toContain('1');
			expect(ids).toContain('2');
		});
	});

	describe('deleteTask', () => {
		it('should remove task from file', async () => {
			await sync.exportAll([
				createTestTask({ id: '1' }),
				createTestTask({ id: '2' })
			]);

			await sync.deleteTask('1');

			const loaded = await sync.readAll();
			expect(loaded).toHaveLength(1);
			expect(loaded[0].id).toBe('2');
		});
	});

	describe('JSONL format', () => {
		it('should produce valid JSON on each line', async () => {
			const tasks = [
				createTestTask({ id: '1', title: 'Task with "quotes"' }),
				createTestTask({ id: '2', title: 'Task with\nnewline' })
			];

			await sync.exportAll(tasks);

			const content = await fs.readFile(jsonlPath, 'utf-8');
			const lines = content.trim().split('\n');

			// Each line should be valid JSON
			for (const line of lines) {
				expect(() => JSON.parse(line)).not.toThrow();
			}
		});

		it('should handle special characters', async () => {
			const task = createTestTask({
				id: '1',
				title: 'Task with special: "quotes", \\backslash, \ttab',
				description: 'Unicode: 日本語 emoji: 🎉'
			});

			await sync.exportAll([task]);
			const loaded = await sync.readAll();

			expect(loaded[0].title).toBe(
				'Task with special: "quotes", \\backslash, \ttab'
			);
			expect(loaded[0].description).toBe('Unicode: 日本語 emoji: 🎉');
		});

		it('should preserve task structure through round-trip', async () => {
			const task = createTestTask({
				id: '1',
				title: 'Complex Task',
				status: 'in-progress',
				priority: 'high',
				dependencies: ['2', '3'],
				subtasks: [
					{
						id: 1,
						parentId: '1',
						title: 'Subtask',
						description: 'desc',
						status: 'done',
						priority: 'medium',
						dependencies: [],
						details: 'details',
						testStrategy: 'strategy'
					}
				],
				tags: ['frontend', 'urgent'],
				effort: 5,
				assignee: 'user@example.com'
			});

			await sync.exportAll([task]);
			const loaded = await sync.readAll();

			const loadedTask = loaded[0];
			expect(loadedTask.id).toBe(task.id);
			expect(loadedTask.title).toBe(task.title);
			expect(loadedTask.status).toBe(task.status);
			expect(loadedTask.priority).toBe(task.priority);
			expect(loadedTask.dependencies).toEqual(task.dependencies);
			expect(loadedTask.subtasks).toHaveLength(1);
			expect(loadedTask.tags).toEqual(task.tags);
			expect(loadedTask.effort).toBe(task.effort);
			expect(loadedTask.assignee).toBe(task.assignee);
		});
	});

	describe('getStats', () => {
		it('should return file statistics', async () => {
			await sync.exportAll([
				createTestTask({ id: '1' }),
				createTestTask({ id: '2' })
			]);

			const stats = sync.getStats();

			expect(stats).not.toBeNull();
			expect(stats?.lineCount).toBe(2);
			expect(stats?.size).toBeGreaterThan(0);
		});

		it('should return null when file does not exist', () => {
			const stats = sync.getStats();
			expect(stats).toBeNull();
		});
	});

	describe('writeTaskWithTag', () => {
		it('should update task matching both id and tag', async () => {
			// Write tasks with different tags
			await sync.exportAllWithTags([
				{
					task: createTestTask({ id: '1', title: 'Master Task' }),
					tag: 'master'
				},
				{
					task: createTestTask({ id: '1', title: 'Feature Task' }),
					tag: 'feature'
				}
			]);

			// Update only the master tag version
			await sync.writeTaskWithTag(
				createTestTask({ id: '1', title: 'Updated Master' }),
				'master'
			);

			const loaded = await sync.readAll();
			expect(loaded).toHaveLength(2);

			const masterTask = loaded.find((t) => t._tag === 'master');
			const featureTask = loaded.find((t) => t._tag === 'feature');

			expect(masterTask?.title).toBe('Updated Master');
			expect(featureTask?.title).toBe('Feature Task'); // Unchanged
		});

		it('should append task if not found', async () => {
			await sync.exportAllWithTags([
				{ task: createTestTask({ id: '1' }), tag: 'master' }
			]);

			await sync.writeTaskWithTag(
				createTestTask({ id: '2', title: 'New Task' }),
				'feature'
			);

			const loaded = await sync.readAll();
			expect(loaded).toHaveLength(2);
		});
	});

	describe('deleteTaskWithTag', () => {
		it('should delete task matching both id and tag', async () => {
			await sync.exportAllWithTags([
				{ task: createTestTask({ id: '1', title: 'Master' }), tag: 'master' },
				{ task: createTestTask({ id: '1', title: 'Feature' }), tag: 'feature' }
			]);

			await sync.deleteTaskWithTag('1', 'master');

			const loaded = await sync.readAll();
			expect(loaded).toHaveLength(1);
			expect(loaded[0]._tag).toBe('feature');
		});

		it('should not delete task with different tag', async () => {
			await sync.exportAllWithTags([
				{ task: createTestTask({ id: '1' }), tag: 'master' }
			]);

			await sync.deleteTaskWithTag('1', 'feature');

			const loaded = await sync.readAll();
			expect(loaded).toHaveLength(1);
		});
	});

	describe('syncTagTasks', () => {
		it('should replace all tasks for a specific tag', async () => {
			await sync.exportAllWithTags([
				{
					task: createTestTask({ id: '1', title: 'Old Master 1' }),
					tag: 'master'
				},
				{
					task: createTestTask({ id: '2', title: 'Old Master 2' }),
					tag: 'master'
				},
				{
					task: createTestTask({ id: '1', title: 'Feature Task' }),
					tag: 'feature'
				}
			]);

			// Replace master tag tasks
			await sync.syncTagTasks(
				[createTestTask({ id: '3', title: 'New Master' })],
				'master'
			);

			const loaded = await sync.readAll();
			expect(loaded).toHaveLength(2);

			const masterTasks = loaded.filter((t) => t._tag === 'master');
			const featureTasks = loaded.filter((t) => t._tag === 'feature');

			expect(masterTasks).toHaveLength(1);
			expect(masterTasks[0].id).toBe('3');
			expect(featureTasks).toHaveLength(1); // Unchanged
		});

		it('should handle empty task list (delete all for tag)', async () => {
			await sync.exportAllWithTags([
				{ task: createTestTask({ id: '1' }), tag: 'master' },
				{ task: createTestTask({ id: '2' }), tag: 'feature' }
			]);

			await sync.syncTagTasks([], 'master');

			const loaded = await sync.readAll();
			expect(loaded).toHaveLength(1);
			expect(loaded[0]._tag).toBe('feature');
		});
	});
});
