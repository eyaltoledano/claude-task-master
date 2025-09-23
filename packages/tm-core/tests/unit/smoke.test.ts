/**
 * Smoke tests to verify basic package functionality and imports
 */

import {
	PlaceholderParser,
	PlaceholderStorage,
	StorageError,
	TaskNotFoundError,
	TmCoreError,
	ValidationError,
	formatDate,
	generateTaskId,
	isValidTaskId,
	name,
	version
} from '@tm/core';

import type {
	PlaceholderTask,
	TaskId,
	TaskPriority,
	TaskStatus
} from '@tm/core';

describe('tm-core smoke tests', () => {
	describe('package metadata', () => {
		it('should export correct package name and version', () => {
			expect(name).toBe('@task-master/tm-core');
			expect(version).toBe('1.0.0');
		});
	});

	describe('utility functions', () => {
		it('should generate valid task IDs', () => {
			const id1 = generateTaskId();
			const id2 = generateTaskId();

			expect(typeof id1).toBe('string');
			expect(typeof id2).toBe('string');
			expect(id1).not.toBe(id2); // Should be unique
			expect(isValidTaskId(id1)).toBe(true);
			expect(isValidTaskId('')).toBe(false);
		});

		it('should format dates', () => {
			const date = new Date('2023-01-01T00:00:00.000Z');
			const formatted = formatDate(date);
			expect(formatted).toBe('2023-01-01T00:00:00.000Z');
		});
	});

	describe('placeholder storage', () => {
		it('should perform basic storage operations', async () => {
			const storage = new PlaceholderStorage();
			const testPath = 'test/path';
			const testData = 'test data';

			// Initially should not exist
			expect(await storage.exists(testPath)).toBe(false);
			expect(await storage.read(testPath)).toBe(null);

			// Write and verify
			await storage.write(testPath, testData);
			expect(await storage.exists(testPath)).toBe(true);
			expect(await storage.read(testPath)).toBe(testData);

			// Delete and verify
			await storage.delete(testPath);
			expect(await storage.exists(testPath)).toBe(false);
		});
	});

	describe('placeholder parser', () => {
		it('should parse simple task lists', async () => {
			const parser = new PlaceholderParser();
			const content = `
        - Task 1
        - Task 2
        - Task 3
      `;

			const isValid = await parser.validate(content);
			expect(isValid).toBe(true);

			const tasks = await parser.parse(content);
			expect(tasks).toHaveLength(3);
			expect(tasks[0]?.title).toBe('Task 1');
			expect(tasks[1]?.title).toBe('Task 2');
			expect(tasks[2]?.title).toBe('Task 3');

			tasks.forEach((task) => {
				expect(task.status).toBe('pending');
				expect(task.priority).toBe('medium');
			});
		});
	});

	describe('error classes', () => {
		it('should create and throw custom errors', () => {
			const baseError = new TmCoreError('Base error');
			expect(baseError.name).toBe('TmCoreError');
			expect(baseError.message).toBe('Base error');

			const taskNotFound = new TaskNotFoundError('task-123');
			expect(taskNotFound.name).toBe('TaskNotFoundError');
			expect(taskNotFound.code).toBe('TASK_NOT_FOUND');
			expect(taskNotFound.message).toContain('task-123');

			const validationError = new ValidationError('Invalid data');
			expect(validationError.name).toBe('ValidationError');
			expect(validationError.code).toBe('VALIDATION_ERROR');

			const storageError = new StorageError('Storage failed');
			expect(storageError.name).toBe('StorageError');
			expect(storageError.code).toBe('STORAGE_ERROR');
		});
	});

	describe('type definitions', () => {
		it('should have correct types available', () => {
			// These are compile-time checks that verify types exist
			const taskId: TaskId = 'test-id';
			const status: TaskStatus = 'pending';
			const priority: TaskPriority = 'high';

			const task: PlaceholderTask = {
				id: taskId,
				title: 'Test Task',
				status: status,
				priority: priority
			};

			expect(task.id).toBe('test-id');
			expect(task.status).toBe('pending');
			expect(task.priority).toBe('high');
		});
	});
});
