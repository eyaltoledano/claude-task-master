/**
 * @fileoverview Integration tests for FileStorage metadata preservation
 *
 * Tests that user-defined metadata survives all FileStorage CRUD operations
 * including load, save, update, and append.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileStorage } from '../../../src/modules/storage/adapters/file-storage/file-storage.js';
import type { Task } from '../../../src/common/types/index.js';

/**
 * Creates a minimal valid task for testing
 */
function createTask(id: string, overrides: Partial<Task> = {}): Task {
	return {
		id,
		title: `Task ${id}`,
		description: `Description for task ${id}`,
		status: 'pending',
		priority: 'medium',
		dependencies: [],
		details: '',
		testStrategy: '',
		subtasks: [],
		...overrides
	};
}

describe('FileStorage Metadata Preservation - Integration Tests', () => {
	let tempDir: string;
	let storage: FileStorage;

	beforeEach(() => {
		// Create a temp directory for each test
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmaster-test-'));
		// Create .taskmaster/tasks directory structure
		const taskmasterDir = path.join(tempDir, '.taskmaster', 'tasks');
		fs.mkdirSync(taskmasterDir, { recursive: true });
		storage = new FileStorage(tempDir);
	});

	afterEach(() => {
		// Clean up temp directory
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	describe('saveTasks() and loadTasks() round-trip', () => {
		it('should preserve metadata through save and load cycle', async () => {
			const tasks: Task[] = [
				createTask('1', {
					metadata: {
						externalId: 'JIRA-123',
						source: 'import',
						customField: { nested: 'value' }
					}
				}),
				createTask('2', {
					metadata: {
						score: 85,
						isUrgent: true
					}
				})
			];

			await storage.saveTasks(tasks);
			const loadedTasks = await storage.loadTasks();

			expect(loadedTasks).toHaveLength(2);
			expect(loadedTasks[0].metadata).toEqual({
				externalId: 'JIRA-123',
				source: 'import',
				customField: { nested: 'value' }
			});
			expect(loadedTasks[1].metadata).toEqual({
				score: 85,
				isUrgent: true
			});
		});

		it('should preserve empty metadata object', async () => {
			const tasks: Task[] = [createTask('1', { metadata: {} })];

			await storage.saveTasks(tasks);
			const loadedTasks = await storage.loadTasks();

			expect(loadedTasks[0].metadata).toEqual({});
		});

		it('should handle tasks without metadata', async () => {
			const tasks: Task[] = [createTask('1')]; // No metadata

			await storage.saveTasks(tasks);
			const loadedTasks = await storage.loadTasks();

			expect(loadedTasks[0].metadata).toBeUndefined();
		});

		it('should preserve complex metadata with various types', async () => {
			const complexMetadata = {
				string: 'value',
				number: 42,
				float: 3.14,
				boolean: true,
				nullValue: null,
				array: [1, 'two', { three: 3 }],
				nested: {
					deep: {
						deeper: {
							value: 'found'
						}
					}
				}
			};

			const tasks: Task[] = [createTask('1', { metadata: complexMetadata })];

			await storage.saveTasks(tasks);
			const loadedTasks = await storage.loadTasks();

			expect(loadedTasks[0].metadata).toEqual(complexMetadata);
		});

		it('should preserve metadata on subtasks', async () => {
			const tasks: Task[] = [
				createTask('1', {
					metadata: { parentMeta: 'value' },
					subtasks: [
						{
							id: 1,
							parentId: '1',
							title: 'Subtask 1',
							description: 'Description',
							status: 'pending',
							priority: 'medium',
							dependencies: [],
							details: '',
							testStrategy: '',
							metadata: { subtaskMeta: 'subtask-value' }
						}
					]
				})
			];

			await storage.saveTasks(tasks);
			const loadedTasks = await storage.loadTasks();

			expect(loadedTasks[0].metadata).toEqual({ parentMeta: 'value' });
			expect(loadedTasks[0].subtasks[0].metadata).toEqual({
				subtaskMeta: 'subtask-value'
			});
		});
	});

	describe('updateTask() metadata preservation', () => {
		it('should preserve existing metadata when updating other fields', async () => {
			const originalMetadata = { externalId: 'EXT-123', version: 1 };
			const tasks: Task[] = [createTask('1', { metadata: originalMetadata })];

			await storage.saveTasks(tasks);

			// Update title only, not metadata
			await storage.updateTask('1', { title: 'Updated Title' });

			const loadedTasks = await storage.loadTasks();
			expect(loadedTasks[0].title).toBe('Updated Title');
			expect(loadedTasks[0].metadata).toEqual(originalMetadata);
		});

		it('should allow updating metadata field directly', async () => {
			const tasks: Task[] = [createTask('1', { metadata: { original: true } })];

			await storage.saveTasks(tasks);

			// Update metadata
			await storage.updateTask('1', {
				metadata: { original: true, updated: true, newField: 'value' }
			});

			const loadedTasks = await storage.loadTasks();
			expect(loadedTasks[0].metadata).toEqual({
				original: true,
				updated: true,
				newField: 'value'
			});
		});

		it('should allow replacing metadata entirely', async () => {
			const tasks: Task[] = [
				createTask('1', { metadata: { oldField: 'old' } })
			];

			await storage.saveTasks(tasks);

			// Replace metadata entirely
			await storage.updateTask('1', { metadata: { newField: 'new' } });

			const loadedTasks = await storage.loadTasks();
			expect(loadedTasks[0].metadata).toEqual({ newField: 'new' });
		});

		it('should preserve metadata when updating status', async () => {
			const tasks: Task[] = [createTask('1', { metadata: { tracked: true } })];

			await storage.saveTasks(tasks);
			await storage.updateTask('1', { status: 'in-progress' });

			const loadedTasks = await storage.loadTasks();
			expect(loadedTasks[0].status).toBe('in-progress');
			expect(loadedTasks[0].metadata).toEqual({ tracked: true });
		});
	});

	describe('appendTasks() metadata preservation', () => {
		it('should preserve metadata on existing tasks when appending', async () => {
			const existingTasks: Task[] = [
				createTask('1', { metadata: { existing: true } })
			];

			await storage.saveTasks(existingTasks);

			// Append new tasks
			const newTasks: Task[] = [
				createTask('2', { metadata: { newTask: true } })
			];

			await storage.appendTasks(newTasks);

			const loadedTasks = await storage.loadTasks();
			expect(loadedTasks).toHaveLength(2);
			expect(loadedTasks.find((t) => t.id === '1')?.metadata).toEqual({
				existing: true
			});
			expect(loadedTasks.find((t) => t.id === '2')?.metadata).toEqual({
				newTask: true
			});
		});
	});

	describe('loadTask() single task metadata', () => {
		it('should preserve metadata when loading single task', async () => {
			const tasks: Task[] = [
				createTask('1', { metadata: { specific: 'metadata' } }),
				createTask('2', { metadata: { other: 'data' } })
			];

			await storage.saveTasks(tasks);
			const task = await storage.loadTask('1');

			expect(task).toBeDefined();
			expect(task?.metadata).toEqual({ specific: 'metadata' });
		});
	});

	describe('metadata alongside AI implementation metadata', () => {
		it('should preserve both user metadata and AI metadata', async () => {
			const tasks: Task[] = [
				createTask('1', {
					// AI implementation metadata
					relevantFiles: [
						{
							path: 'src/test.ts',
							description: 'Test file',
							action: 'modify'
						}
					],
					category: 'development',
					skills: ['TypeScript'],
					acceptanceCriteria: ['Tests pass'],
					// User-defined metadata
					metadata: {
						externalId: 'JIRA-456',
						importedAt: '2024-01-15T10:00:00Z'
					}
				})
			];

			await storage.saveTasks(tasks);
			const loadedTasks = await storage.loadTasks();

			// AI metadata preserved
			expect(loadedTasks[0].relevantFiles).toHaveLength(1);
			expect(loadedTasks[0].category).toBe('development');
			expect(loadedTasks[0].skills).toEqual(['TypeScript']);

			// User metadata preserved
			expect(loadedTasks[0].metadata).toEqual({
				externalId: 'JIRA-456',
				importedAt: '2024-01-15T10:00:00Z'
			});
		});
	});

	describe('AI operation metadata preservation', () => {
		it('should preserve metadata when updating task with AI-like partial update', async () => {
			// Simulate existing task with user metadata
			const tasks: Task[] = [
				createTask('1', {
					title: 'Original Title',
					metadata: { externalId: 'JIRA-123', version: 1 }
				})
			];

			await storage.saveTasks(tasks);

			// Simulate AI update - only updates specific fields, no metadata field
			// This mimics what happens when AI processes update-task
			const aiUpdate: Partial<Task> = {
				title: 'AI Updated Title',
				description: 'AI generated description',
				details: 'AI generated details'
				// Note: no metadata field - AI schemas don't include it
			};

			await storage.updateTask('1', aiUpdate);

			const loadedTasks = await storage.loadTasks();
			expect(loadedTasks[0].title).toBe('AI Updated Title');
			expect(loadedTasks[0].description).toBe('AI generated description');
			// User metadata must be preserved
			expect(loadedTasks[0].metadata).toEqual({
				externalId: 'JIRA-123',
				version: 1
			});
		});

		it('should preserve metadata when adding AI-generated subtasks', async () => {
			const tasks: Task[] = [
				createTask('1', {
					metadata: { tracked: true, source: 'import' },
					subtasks: []
				})
			];

			await storage.saveTasks(tasks);

			// Simulate expand-task adding subtasks
			// Subtasks from AI don't have metadata field
			const updatedTask: Partial<Task> = {
				subtasks: [
					{
						id: 1,
						parentId: '1',
						title: 'AI Generated Subtask',
						description: 'Description',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						details: 'Details',
						testStrategy: 'Tests'
						// No metadata - AI doesn't generate it
					}
				]
			};

			await storage.updateTask('1', updatedTask);

			const loadedTasks = await storage.loadTasks();
			// Parent task metadata preserved
			expect(loadedTasks[0].metadata).toEqual({
				tracked: true,
				source: 'import'
			});
			// Subtask has no metadata (as expected from AI)
			expect(loadedTasks[0].subtasks[0].metadata).toBeUndefined();
		});

		it('should handle multiple sequential AI updates preserving metadata', async () => {
			const tasks: Task[] = [
				createTask('1', {
					metadata: { originalField: 'preserved' }
				})
			];

			await storage.saveTasks(tasks);

			// First AI update
			await storage.updateTask('1', { title: 'First Update' });
			// Second AI update
			await storage.updateTask('1', { description: 'Second Update' });
			// Third AI update
			await storage.updateTask('1', { priority: 'high' });

			const loadedTasks = await storage.loadTasks();
			expect(loadedTasks[0].title).toBe('First Update');
			expect(loadedTasks[0].description).toBe('Second Update');
			expect(loadedTasks[0].priority).toBe('high');
			// Metadata preserved through all updates
			expect(loadedTasks[0].metadata).toEqual({ originalField: 'preserved' });
		});

		it('should preserve metadata when update object omits metadata field entirely', async () => {
			// This is how AI operations work - they simply don't include metadata
			const tasks: Task[] = [
				createTask('1', {
					metadata: { important: 'data' }
				})
			];

			await storage.saveTasks(tasks);

			// Update WITHOUT metadata field (AI schemas don't include it)
			const updateWithoutMetadata: Partial<Task> = { title: 'Updated' };
			await storage.updateTask('1', updateWithoutMetadata);

			const loadedTasks = await storage.loadTasks();
			// When metadata field is absent from updates, existing metadata is preserved
			expect(loadedTasks[0].metadata).toEqual({ important: 'data' });
		});
	});

	describe('file format verification', () => {
		it('should write metadata to JSON file correctly', async () => {
			const tasks: Task[] = [createTask('1', { metadata: { written: true } })];

			await storage.saveTasks(tasks);

			// Read raw file to verify format
			const filePath = path.join(tempDir, '.taskmaster', 'tasks', 'tasks.json');
			const rawContent = fs.readFileSync(filePath, 'utf-8');
			const parsed = JSON.parse(rawContent);

			expect(parsed.tasks[0].metadata).toEqual({ written: true });
		});

		it('should load metadata from pre-existing JSON file', async () => {
			// Write a tasks.json file manually
			const tasksDir = path.join(tempDir, '.taskmaster', 'tasks');
			const filePath = path.join(tasksDir, 'tasks.json');

			const fileContent = {
				tasks: [
					{
						id: '1',
						title: 'Pre-existing task',
						description: 'Description',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						details: '',
						testStrategy: '',
						subtasks: [],
						metadata: {
							preExisting: true,
							importedFrom: 'external-system'
						}
					}
				],
				metadata: {
					version: '1.0.0',
					lastModified: new Date().toISOString(),
					taskCount: 1,
					completedCount: 0
				}
			};

			fs.writeFileSync(filePath, JSON.stringify(fileContent, null, 2));

			// Load through FileStorage
			const loadedTasks = await storage.loadTasks();

			expect(loadedTasks).toHaveLength(1);
			expect(loadedTasks[0].metadata).toEqual({
				preExisting: true,
				importedFrom: 'external-system'
			});
		});
	});
});
