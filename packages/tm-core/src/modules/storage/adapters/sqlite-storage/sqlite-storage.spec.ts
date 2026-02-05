/**
 * Tests for SqliteStorage adapter
 *
 * Tests the SQLite storage implementation that uses JSONL for git-friendly persistence.
 * SQLite is the local working database, JSONL is the git-synced source of truth.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SqliteStorage } from './sqlite-storage.js';
import type { Task, TaskMetadata } from '../../../../common/types/index.js';

/**
 * Create a test task with required fields
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

/**
 * Create test metadata
 */
function createTestMetadata(overrides: Partial<TaskMetadata> = {}): TaskMetadata {
	return {
		version: '1.0.0',
		lastModified: new Date().toISOString(),
		taskCount: 1,
		completedCount: 0,
		...overrides
	};
}

describe('SqliteStorage', () => {
	let tempDir: string;
	let storage: SqliteStorage;

	beforeEach(async () => {
		// Create a temp directory for each test
		tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'sqlite-storage-test-'));
		storage = new SqliteStorage(tempDir);
	});

	afterEach(async () => {
		// Clean up
		if (storage) {
			await storage.close();
		}
		if (tempDir && fsSync.existsSync(tempDir)) {
			fsSync.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('initialize', () => {
		it('should create database and directory structure', async () => {
			await storage.initialize();

			const tasksDir = path.join(tempDir, '.taskmaster', 'tasks');
			expect(fsSync.existsSync(tasksDir)).toBe(true);

			// Database file should exist
			const dbPath = path.join(tasksDir, 'tasks.db');
			expect(fsSync.existsSync(dbPath)).toBe(true);
		});

		it('should be idempotent', async () => {
			await storage.initialize();
			await storage.initialize(); // Should not throw

			const tasksDir = path.join(tempDir, '.taskmaster', 'tasks');
			expect(fsSync.existsSync(tasksDir)).toBe(true);
		});

		it('should rebuild from JSONL if database is missing', async () => {
			// First initialize and save some tasks
			await storage.initialize();
			const task = createTestTask();
			await storage.saveTasks([task], 'master');
			await storage.close();

			// Delete the database
			const dbPath = path.join(tempDir, '.taskmaster', 'tasks', 'tasks.db');
			await fs.unlink(dbPath);
			expect(fsSync.existsSync(dbPath)).toBe(false);

			// Reinitialize - should rebuild from JSONL
			storage = new SqliteStorage(tempDir);
			await storage.initialize();

			// Verify data was restored
			const loadedTasks = await storage.loadTasks('master');
			expect(loadedTasks).toHaveLength(1);
			expect(loadedTasks[0].id).toBe('1');
			expect(loadedTasks[0].title).toBe('Test Task');
		});
	});

	describe('saveTasks and loadTasks', () => {
		beforeEach(async () => {
			await storage.initialize();
		});

		it('should save and load tasks', async () => {
			const task = createTestTask();

			await storage.saveTasks([task], 'master');
			const loaded = await storage.loadTasks('master');

			expect(loaded).toHaveLength(1);
			expect(loaded[0].id).toBe('1');
			expect(loaded[0].title).toBe('Test Task');
			expect(loaded[0].status).toBe('pending');
		});

		it('should handle multiple tasks', async () => {
			const tasks = [
				createTestTask({ id: '1', title: 'Task 1' }),
				createTestTask({ id: '2', title: 'Task 2' }),
				createTestTask({ id: '3', title: 'Task 3' })
			];

			await storage.saveTasks(tasks, 'master');
			const loaded = await storage.loadTasks('master');

			expect(loaded).toHaveLength(3);
			const ids = loaded.map((t) => t.id).sort();
			expect(ids).toEqual(['1', '2', '3']);
		});

		it('should handle tasks with subtasks', async () => {
			const task = createTestTask({
				id: '1',
				subtasks: [
					{
						id: 1,
						parentId: '1',
						title: 'Subtask 1',
						description: 'Subtask description',
						status: 'pending',
						priority: 'low',
						dependencies: [],
						details: '',
						testStrategy: ''
					},
					{
						id: 2,
						parentId: '1',
						title: 'Subtask 2',
						description: 'Another subtask',
						status: 'done',
						priority: 'high',
						dependencies: [],
						details: '',
						testStrategy: ''
					}
				]
			});

			await storage.saveTasks([task], 'master');
			const loaded = await storage.loadTasks('master');

			expect(loaded).toHaveLength(1);
			expect(loaded[0].subtasks).toHaveLength(2);
			expect(loaded[0].subtasks[0].title).toBe('Subtask 1');
			expect(loaded[0].subtasks[1].status).toBe('done');
		});

		it('should handle tasks with dependencies', async () => {
			const tasks = [
				createTestTask({ id: '1', title: 'Task 1', dependencies: [] }),
				createTestTask({ id: '2', title: 'Task 2', dependencies: ['1'] }),
				createTestTask({ id: '3', title: 'Task 3', dependencies: ['1', '2'] })
			];

			await storage.saveTasks(tasks, 'master');
			const loaded = await storage.loadTasks('master');

			const task2 = loaded.find((t) => t.id === '2');
			const task3 = loaded.find((t) => t.id === '3');

			expect(task2?.dependencies).toEqual(['1']);
			expect(task3?.dependencies.sort()).toEqual(['1', '2']);
		});

		it('should handle multiple tags', async () => {
			const masterTasks = [createTestTask({ id: '1', title: 'Master Task' })];
			const featureTasks = [createTestTask({ id: '2', title: 'Feature Task' })];

			await storage.saveTasks(masterTasks, 'master');
			await storage.saveTasks(featureTasks, 'feature-branch');

			const masterLoaded = await storage.loadTasks('master');
			const featureLoaded = await storage.loadTasks('feature-branch');

			expect(masterLoaded).toHaveLength(1);
			expect(masterLoaded[0].title).toBe('Master Task');
			expect(featureLoaded).toHaveLength(1);
			expect(featureLoaded[0].title).toBe('Feature Task');
		});

		it('should return empty array for non-existent tag', async () => {
			const loaded = await storage.loadTasks('non-existent-tag');
			expect(loaded).toEqual([]);
		});

		it('should update JSONL on every save', async () => {
			const task = createTestTask();
			await storage.saveTasks([task], 'master');

			// Check JSONL file exists
			const jsonlPath = path.join(tempDir, '.taskmaster', 'tasks', 'tasks.jsonl');
			expect(fsSync.existsSync(jsonlPath)).toBe(true);

			// Read JSONL content
			const content = await fs.readFile(jsonlPath, 'utf-8');
			const lines = content.trim().split('\n');
			expect(lines.length).toBeGreaterThan(0);

			// Parse first task line
			const parsed = JSON.parse(lines[0]);
			expect(parsed.id).toBe('1');
			expect(parsed.title).toBe('Test Task');
		});
	});

	describe('updateTask', () => {
		beforeEach(async () => {
			await storage.initialize();
		});

		it('should update a single task', async () => {
			const task = createTestTask({ id: '1', title: 'Original Title' });
			await storage.saveTasks([task], 'master');

			await storage.updateTask(
				'1',
				{ title: 'Updated Title', status: 'in-progress' },
				'master'
			);

			const loaded = await storage.loadTasks('master');
			expect(loaded[0].title).toBe('Updated Title');
			expect(loaded[0].status).toBe('in-progress');
		});

		it('should preserve fields not being updated', async () => {
			const task = createTestTask({
				id: '1',
				title: 'Original',
				description: 'Original description',
				priority: 'high'
			});
			await storage.saveTasks([task], 'master');

			await storage.updateTask('1', { title: 'Updated' }, 'master');

			const loaded = await storage.loadTasks('master');
			expect(loaded[0].title).toBe('Updated');
			expect(loaded[0].description).toBe('Original description');
			expect(loaded[0].priority).toBe('high');
		});

		it('should throw for non-existent task', async () => {
			await expect(
				storage.updateTask('999', { title: 'test' }, 'master')
			).rejects.toThrow();
		});
	});

	describe('deleteTask', () => {
		beforeEach(async () => {
			await storage.initialize();
		});

		it('should delete a task', async () => {
			const tasks = [
				createTestTask({ id: '1', title: 'Task 1' }),
				createTestTask({ id: '2', title: 'Task 2' })
			];
			await storage.saveTasks(tasks, 'master');

			await storage.deleteTask('1', 'master');

			const loaded = await storage.loadTasks('master');
			expect(loaded).toHaveLength(1);
			expect(loaded[0].id).toBe('2');
		});

		it('should throw for non-existent task', async () => {
			await expect(storage.deleteTask('999', 'master')).rejects.toThrow();
		});
	});

	describe('loadTask', () => {
		beforeEach(async () => {
			await storage.initialize();
		});

		it('should get a single task by ID', async () => {
			const task = createTestTask({ id: '1', title: 'Test Task' });
			await storage.saveTasks([task], 'master');

			const loaded = await storage.loadTask('1', 'master');
			expect(loaded).not.toBeNull();
			expect(loaded?.title).toBe('Test Task');
		});

		it('should return null for non-existent task', async () => {
			const loaded = await storage.loadTask('999', 'master');
			expect(loaded).toBeNull();
		});
	});

	describe('metadata', () => {
		beforeEach(async () => {
			await storage.initialize();
		});

		it('should save and load metadata with project name', async () => {
			const metadata = createTestMetadata({
				projectName: 'Test Project'
			});

			await storage.saveMetadata(metadata, 'master');
			const loaded = await storage.loadMetadata('master');

			expect(loaded).not.toBeNull();
			expect(loaded?.projectName).toBe('Test Project');
		});

		it('should compute task count from actual tasks', async () => {
			// Save some tasks first
			const tasks = [
				createTestTask({ id: '1', status: 'pending' }),
				createTestTask({ id: '2', status: 'done' }),
				createTestTask({ id: '3', status: 'done' })
			];
			await storage.saveTasks(tasks, 'master');

			const loaded = await storage.loadMetadata('master');

			expect(loaded).not.toBeNull();
			expect(loaded?.taskCount).toBe(3);
			expect(loaded?.completedCount).toBe(2);
		});

		it('should return default metadata for tags without explicit metadata', async () => {
			// loadMetadata returns default values even for tags without tasks
			const loaded = await storage.loadMetadata('non-existent');

			// Implementation returns default metadata, not null
			expect(loaded).not.toBeNull();
			expect(loaded?.taskCount).toBe(0);
			expect(loaded?.version).toBeDefined();
		});
	});

	describe('getAllTags', () => {
		beforeEach(async () => {
			await storage.initialize();
		});

		it('should return all tags', async () => {
			await storage.saveTasks([createTestTask()], 'master');
			await storage.saveTasks([createTestTask({ id: '2' })], 'feature-1');
			await storage.saveTasks([createTestTask({ id: '3' })], 'feature-2');

			const tags = await storage.getAllTags();
			expect(tags.sort()).toEqual(['feature-1', 'feature-2', 'master']);
		});

		it('should return empty array when no tasks exist', async () => {
			const tags = await storage.getAllTags();
			expect(tags).toEqual([]);
		});
	});

	describe('close', () => {
		it('should close database connection gracefully', async () => {
			await storage.initialize();
			const task = createTestTask();
			await storage.saveTasks([task], 'master');

			await storage.close();

			// Re-opening should work
			storage = new SqliteStorage(tempDir);
			await storage.initialize();
			const loaded = await storage.loadTasks('master');
			expect(loaded).toHaveLength(1);
		});
	});

	describe('JSONL sync', () => {
		beforeEach(async () => {
			await storage.initialize();
		});

		it('should sync JSONL after every write operation', async () => {
			const jsonlPath = path.join(tempDir, '.taskmaster', 'tasks', 'tasks.jsonl');

			// Save first task
			await storage.saveTasks([createTestTask({ id: '1' })], 'master');
			let content = await fs.readFile(jsonlPath, 'utf-8');
			expect(content.includes('"id":"1"')).toBe(true);

			// Update task
			await storage.updateTask('1', { title: 'Updated' }, 'master');
			content = await fs.readFile(jsonlPath, 'utf-8');
			expect(content.includes('Updated')).toBe(true);

			// Add another task
			await storage.saveTasks(
				[createTestTask({ id: '1' }), createTestTask({ id: '2' })],
				'master'
			);
			content = await fs.readFile(jsonlPath, 'utf-8');
			expect(content.includes('"id":"2"')).toBe(true);
		});

		it('should handle metadata in JSONL', async () => {
			const jsonlPath = path.join(tempDir, '.taskmaster', 'tasks', 'tasks.jsonl');

			// Save tasks with metadata
			await storage.saveTasks([createTestTask()], 'master');
			await storage.saveMetadata(createTestMetadata({ projectName: 'Test' }), 'master');

			const content = await fs.readFile(jsonlPath, 'utf-8');
			// JSONL should include both task and metadata info
			expect(content.length).toBeGreaterThan(0);
		});
	});

	describe('error handling', () => {
		it('should handle operations before initialization', async () => {
			// Storage not initialized
			await expect(storage.loadTasks('master')).rejects.toThrow();
		});

		it('should handle invalid task data gracefully', async () => {
			await storage.initialize();

			// Task with missing required fields should be handled
			const invalidTask = {
				id: '1',
				title: 'Test'
				// Missing other required fields
			} as Task;

			// Should throw or handle gracefully
			await expect(storage.saveTasks([invalidTask], 'master')).rejects.toThrow();
		});
	});
});
