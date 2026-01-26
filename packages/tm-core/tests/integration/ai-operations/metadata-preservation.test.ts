/**
 * @fileoverview Integration tests for metadata preservation across AI operations
 *
 * Tests that user-defined metadata survives all AI operations including:
 * - update-task: AI updates task fields but doesn't include metadata in response
 * - expand-task: AI generates subtasks but parent task metadata is preserved
 * - parse-prd: AI generates new tasks without metadata field
 *
 * Key insight: AI schemas (base-schemas.js) intentionally EXCLUDE the metadata field.
 * This means AI responses never include metadata, and the spread operator in
 * storage/service layers preserves existing metadata during updates.
 *
 * These tests simulate what happens when AI operations update tasks - the AI
 * returns a task object without a metadata field, and we verify that the
 * existing metadata is preserved through the storage layer.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileStorage } from '../../../src/modules/storage/adapters/file-storage/file-storage.js';
import type { Task, Subtask } from '../../../src/common/types/index.js';

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

/**
 * Creates a realistic metadata object like external integrations would produce
 */
function createRealisticMetadata(): Record<string, unknown> {
	return {
		uuid: '550e8400-e29b-41d4-a716-446655440000',
		githubIssue: 42,
		sprint: 'Q1-S3',
		jira: {
			key: 'PROJ-123',
			type: 'story',
			epic: 'EPIC-45'
		},
		importedAt: '2024-01-15T10:30:00Z',
		source: 'github-sync',
		labels: ['frontend', 'refactor', 'high-priority']
	};
}

describe('AI Operation Metadata Preservation - Integration Tests', () => {
	let tempDir: string;
	let storage: FileStorage;

	beforeEach(() => {
		// Create a temp directory for each test
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmaster-ai-test-'));
		// Create .taskmaster/tasks directory structure
		const taskmasterDir = path.join(tempDir, '.taskmaster', 'tasks');
		fs.mkdirSync(taskmasterDir, { recursive: true });
		storage = new FileStorage(tempDir);
	});

	afterEach(() => {
		// Clean up temp directory
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	describe('update-task operation simulation', () => {
		it('should preserve metadata when AI returns task without metadata field', async () => {
			// Setup: Task with user metadata
			const originalMetadata = createRealisticMetadata();
			const tasks: Task[] = [
				createTask('1', {
					title: 'Original Title',
					description: 'Original description',
					metadata: originalMetadata
				})
			];
			await storage.saveTasks(tasks);

			// Simulate AI response: AI updates title/description but doesn't include metadata
			// This is the exact pattern from update-task-by-id.js
			const aiGeneratedUpdate: Partial<Task> = {
				title: 'AI Updated Title',
				description: 'AI refined description with more detail',
				details: 'AI generated implementation details',
				testStrategy: 'AI suggested test approach'
				// Note: NO metadata field - AI schemas don't include it
			};

			// Apply update through FileStorage (simulating what AI operations do)
			await storage.updateTask('1', aiGeneratedUpdate);

			// Verify: AI fields updated, metadata preserved
			const loadedTasks = await storage.loadTasks();
			expect(loadedTasks[0].title).toBe('AI Updated Title');
			expect(loadedTasks[0].description).toBe(
				'AI refined description with more detail'
			);
			expect(loadedTasks[0].details).toBe(
				'AI generated implementation details'
			);
			expect(loadedTasks[0].testStrategy).toBe('AI suggested test approach');
			// Critical: metadata must be preserved
			expect(loadedTasks[0].metadata).toEqual(originalMetadata);
		});

		it('should preserve metadata through multiple sequential AI updates', async () => {
			const metadata = { externalId: 'EXT-999', version: 1 };
			const tasks: Task[] = [createTask('1', { metadata })];
			await storage.saveTasks(tasks);

			// First AI update
			await storage.updateTask('1', { title: 'First AI Update' });

			// Second AI update
			await storage.updateTask('1', {
				description: 'Second AI Update adds details'
			});

			// Third AI update
			await storage.updateTask('1', { priority: 'high' });

			// Verify metadata survived all updates
			const loadedTasks = await storage.loadTasks();
			expect(loadedTasks[0].title).toBe('First AI Update');
			expect(loadedTasks[0].description).toBe('Second AI Update adds details');
			expect(loadedTasks[0].priority).toBe('high');
			expect(loadedTasks[0].metadata).toEqual(metadata);
		});

		it('should preserve realistic integration metadata during AI operations', async () => {
			const realisticMetadata = createRealisticMetadata();
			const tasks: Task[] = [
				createTask('1', {
					title: 'Sync from GitHub',
					metadata: realisticMetadata
				})
			];
			await storage.saveTasks(tasks);

			// AI enriches the task
			await storage.updateTask('1', {
				title: 'Implement user authentication',
				description: 'Set up JWT-based authentication system',
				details: `
## Implementation Plan
1. Create auth middleware
2. Implement JWT token generation
3. Add refresh token logic
4. Set up protected routes
				`.trim(),
				testStrategy:
					'Unit tests for JWT functions, integration tests for auth flow'
			});

			const loadedTasks = await storage.loadTasks();
			// All AI updates applied
			expect(loadedTasks[0].title).toBe('Implement user authentication');
			expect(loadedTasks[0].details).toContain('Implementation Plan');
			// Realistic metadata preserved with all its nested structure
			expect(loadedTasks[0].metadata).toEqual(realisticMetadata);
			expect(
				(loadedTasks[0].metadata as Record<string, unknown>).githubIssue
			).toBe(42);
			expect(
				(
					(loadedTasks[0].metadata as Record<string, unknown>).jira as Record<
						string,
						unknown
					>
				).key
			).toBe('PROJ-123');
		});
	});

	describe('expand-task operation simulation', () => {
		it('should preserve parent task metadata when adding AI-generated subtasks', async () => {
			const parentMetadata = { tracked: true, source: 'import' };
			const tasks: Task[] = [
				createTask('1', {
					metadata: parentMetadata,
					subtasks: []
				})
			];
			await storage.saveTasks(tasks);

			// Simulate expand-task: AI generates subtasks (without metadata)
			const aiGeneratedSubtasks: Subtask[] = [
				{
					id: 1,
					parentId: '1',
					title: 'AI Subtask 1',
					description: 'First step generated by AI',
					status: 'pending',
					priority: 'medium',
					dependencies: [],
					details: 'Implementation details',
					testStrategy: 'Test approach'
					// No metadata - AI doesn't generate it
				},
				{
					id: 2,
					parentId: '1',
					title: 'AI Subtask 2',
					description: 'Second step generated by AI',
					status: 'pending',
					priority: 'medium',
					dependencies: ['1'],
					details: 'More details',
					testStrategy: 'More tests'
				}
			];

			// Apply subtasks update
			await storage.updateTask('1', { subtasks: aiGeneratedSubtasks });

			// Verify parent metadata preserved
			const loadedTasks = await storage.loadTasks();
			expect(loadedTasks[0].metadata).toEqual(parentMetadata);
			expect(loadedTasks[0].subtasks).toHaveLength(2);
			// Subtasks don't inherit parent metadata
			expect(loadedTasks[0].subtasks[0].metadata).toBeUndefined();
			expect(loadedTasks[0].subtasks[1].metadata).toBeUndefined();
		});

		it('should preserve subtask metadata when parent is updated', async () => {
			const tasks: Task[] = [
				createTask('1', {
					metadata: { parentMeta: 'parent-value' },
					subtasks: [
						{
							id: 1,
							parentId: '1',
							title: 'Subtask with metadata',
							description: 'Has its own metadata',
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

			// AI updates parent task (not subtasks)
			await storage.updateTask('1', {
				title: 'Parent Updated by AI',
				description: 'New description'
			});

			const loadedTasks = await storage.loadTasks();
			// Parent metadata preserved
			expect(loadedTasks[0].metadata).toEqual({ parentMeta: 'parent-value' });
			// Subtask and its metadata preserved
			expect(loadedTasks[0].subtasks[0].metadata).toEqual({
				subtaskMeta: 'subtask-value'
			});
		});
	});

	describe('parse-prd operation simulation', () => {
		it('should generate tasks without metadata field (as AI would)', async () => {
			// Simulate parse-prd output: AI generates tasks without metadata
			const aiGeneratedTasks: Task[] = [
				{
					id: '1',
					title: 'Set up project structure',
					description: 'Initialize the project with proper folder structure',
					status: 'pending',
					priority: 'high',
					dependencies: [],
					details: 'Create src/, tests/, docs/ directories',
					testStrategy: 'Verify directories exist',
					subtasks: []
					// No metadata - AI doesn't generate it
				},
				{
					id: '2',
					title: 'Implement core functionality',
					description: 'Build the main features',
					status: 'pending',
					priority: 'high',
					dependencies: ['1'],
					details: 'Implement main modules',
					testStrategy: 'Unit tests for each module',
					subtasks: []
				}
			];

			await storage.saveTasks(aiGeneratedTasks);

			// Verify tasks saved correctly without metadata
			const loadedTasks = await storage.loadTasks();
			expect(loadedTasks).toHaveLength(2);
			expect(loadedTasks[0].metadata).toBeUndefined();
			expect(loadedTasks[1].metadata).toBeUndefined();
			// Later, user can add metadata
			await storage.updateTask('1', {
				metadata: { externalId: 'USER-ADDED-123' }
			});
			const updatedTasks = await storage.loadTasks();
			expect(updatedTasks[0].metadata).toEqual({
				externalId: 'USER-ADDED-123'
			});
		});
	});

	describe('update-subtask operation simulation', () => {
		it('should preserve subtask metadata when appending info', async () => {
			const tasks: Task[] = [
				createTask('1', {
					subtasks: [
						{
							id: 1,
							parentId: '1',
							title: 'Tracked subtask',
							description: 'Has metadata from import',
							status: 'pending',
							priority: 'medium',
							dependencies: [],
							details: 'Initial details',
							testStrategy: '',
							metadata: { importedFrom: 'jira', ticketId: 'JIRA-456' }
						}
					]
				})
			];
			await storage.saveTasks(tasks);

			// Update subtask details (like update-subtask command does)
			const updatedSubtask: Subtask = {
				id: 1,
				parentId: '1',
				title: 'Tracked subtask',
				description: 'Has metadata from import',
				status: 'in-progress',
				priority: 'medium',
				dependencies: [],
				details:
					'Initial details\n\n<info added on 2024-01-20T10:00:00Z>\nImplementation notes from AI\n</info added on 2024-01-20T10:00:00Z>',
				testStrategy: 'AI suggested tests',
				metadata: { importedFrom: 'jira', ticketId: 'JIRA-456' }
			};

			await storage.updateTask('1', { subtasks: [updatedSubtask] });

			const loadedTasks = await storage.loadTasks();
			expect(loadedTasks[0].subtasks[0].metadata).toEqual({
				importedFrom: 'jira',
				ticketId: 'JIRA-456'
			});
			expect(loadedTasks[0].subtasks[0].details).toContain(
				'Implementation notes from AI'
			);
		});
	});

	describe('mixed AI and storage metadata coexistence', () => {
		it('should preserve user metadata alongside AI-generated task fields', async () => {
			const tasks: Task[] = [
				createTask('1', {
					// AI-generated fields
					relevantFiles: [
						{
							path: 'src/auth.ts',
							description: 'Auth module',
							action: 'modify'
						}
					],
					category: 'development',
					skills: ['TypeScript', 'Security'],
					acceptanceCriteria: ['Tests pass', 'Code reviewed'],
					// User-defined metadata (from import)
					metadata: {
						externalId: 'JIRA-789',
						storyPoints: 5,
						sprint: 'Sprint 10'
					}
				})
			];
			await storage.saveTasks(tasks);

			// AI updates the task (doesn't touch metadata)
			await storage.updateTask('1', {
				relevantFiles: [
					{ path: 'src/auth.ts', description: 'Auth module', action: 'modify' },
					{
						path: 'src/middleware.ts',
						description: 'Added middleware',
						action: 'create'
					}
				],
				skills: ['TypeScript', 'Security', 'JWT']
			});

			const loadedTasks = await storage.loadTasks();
			// AI fields updated
			expect(loadedTasks[0].relevantFiles).toHaveLength(2);
			expect(loadedTasks[0].skills).toContain('JWT');
			// User metadata preserved
			expect(loadedTasks[0].metadata).toEqual({
				externalId: 'JIRA-789',
				storyPoints: 5,
				sprint: 'Sprint 10'
			});
		});
	});

	describe('edge cases for AI operations', () => {
		it('should handle task with only metadata being updated by AI', async () => {
			// Task has ONLY metadata set (sparse task)
			const tasks: Task[] = [
				createTask('1', {
					metadata: { sparse: true, tracking: 'minimal' }
				})
			];
			await storage.saveTasks(tasks);

			// AI fills in all the other fields
			await storage.updateTask('1', {
				title: 'AI Generated Title',
				description: 'AI Generated Description',
				details: 'AI Generated Details',
				testStrategy: 'AI Generated Test Strategy',
				priority: 'high'
			});

			const loadedTasks = await storage.loadTasks();
			expect(loadedTasks[0].title).toBe('AI Generated Title');
			expect(loadedTasks[0].priority).toBe('high');
			expect(loadedTasks[0].metadata).toEqual({
				sparse: true,
				tracking: 'minimal'
			});
		});

		it('should preserve deeply nested metadata through AI operations', async () => {
			const deepMetadata = {
				integration: {
					source: {
						type: 'github',
						repo: {
							owner: 'org',
							name: 'repo',
							issue: {
								number: 123,
								labels: ['bug', 'priority-1']
							}
						}
					}
				}
			};
			const tasks: Task[] = [createTask('1', { metadata: deepMetadata })];
			await storage.saveTasks(tasks);

			// Multiple AI operations
			await storage.updateTask('1', { title: 'Update 1' });
			await storage.updateTask('1', { description: 'Update 2' });
			await storage.updateTask('1', { status: 'in-progress' });

			const loadedTasks = await storage.loadTasks();
			expect(loadedTasks[0].metadata).toEqual(deepMetadata);
		});
	});
});
