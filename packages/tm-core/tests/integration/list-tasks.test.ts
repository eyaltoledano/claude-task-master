/**
 * @fileoverview End-to-end integration test for listTasks functionality
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	type Task,
	type TaskMasterCore,
	type TaskStatus,
	createTaskMasterCore
} from '../../src/index';

describe('TaskMasterCore - listTasks E2E', () => {
	let tmpDir: string;
	let tmCore: TaskMasterCore;

	// Sample tasks data
	const sampleTasks: Task[] = [
		{
			id: '1',
			title: 'Setup project',
			description: 'Initialize the project structure',
			status: 'done',
			priority: 'high',
			dependencies: [],
			details: 'Create all necessary directories and config files',
			testStrategy: 'Manual verification',
			subtasks: [
				{
					id: 1,
					parentId: '1',
					title: 'Create directories',
					description: 'Create project directories',
					status: 'done',
					priority: 'high',
					dependencies: [],
					details: 'Create src, tests, docs directories',
					testStrategy: 'Check directories exist'
				},
				{
					id: 2,
					parentId: '1',
					title: 'Initialize package.json',
					description: 'Create package.json file',
					status: 'done',
					priority: 'high',
					dependencies: [],
					details: 'Run npm init',
					testStrategy: 'Verify package.json exists'
				}
			],
			tags: ['setup', 'infrastructure']
		},
		{
			id: '2',
			title: 'Implement core features',
			description: 'Build the main functionality',
			status: 'in-progress',
			priority: 'high',
			dependencies: ['1'],
			details: 'Implement all core business logic',
			testStrategy: 'Unit tests for all features',
			subtasks: [],
			tags: ['feature', 'core'],
			assignee: 'developer1'
		},
		{
			id: '3',
			title: 'Write documentation',
			description: 'Create user and developer docs',
			status: 'pending',
			priority: 'medium',
			dependencies: ['2'],
			details: 'Write comprehensive documentation',
			testStrategy: 'Review by team',
			subtasks: [],
			tags: ['documentation'],
			complexity: 'simple'
		},
		{
			id: '4',
			title: 'Performance optimization',
			description: 'Optimize for speed and efficiency',
			status: 'blocked',
			priority: 'low',
			dependencies: ['2'],
			details: 'Profile and optimize bottlenecks',
			testStrategy: 'Performance benchmarks',
			subtasks: [],
			assignee: 'developer2',
			complexity: 'complex'
		},
		{
			id: '5',
			title: 'Security audit',
			description: 'Review security vulnerabilities',
			status: 'deferred',
			priority: 'critical',
			dependencies: [],
			details: 'Complete security assessment',
			testStrategy: 'Security scanning tools',
			subtasks: [],
			tags: ['security', 'audit']
		}
	];

	beforeEach(async () => {
		// Create temp directory for testing
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tm-core-test-'));

		// Create .taskmaster/tasks directory
		const tasksDir = path.join(tmpDir, '.taskmaster', 'tasks');
		await fs.mkdir(tasksDir, { recursive: true });

		// Write sample tasks.json
		const tasksFile = path.join(tasksDir, 'tasks.json');
		const tasksData = {
			tasks: sampleTasks,
			metadata: {
				version: '1.0.0',
				lastModified: new Date().toISOString(),
				taskCount: sampleTasks.length,
				completedCount: 1
			}
		};
		await fs.writeFile(tasksFile, JSON.stringify(tasksData, null, 2));

		// Create TaskMasterCore instance
		tmCore = createTaskMasterCore(tmpDir);
		await tmCore.initialize();
	});

	afterEach(async () => {
		// Cleanup
		if (tmCore) {
			await tmCore.close();
		}

		// Remove temp directory
		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	describe('Basic listing', () => {
		it('should list all tasks', async () => {
			const result = await tmCore.listTasks();

			expect(result.tasks).toHaveLength(5);
			expect(result.total).toBe(5);
			expect(result.filtered).toBe(5);
			expect(result.tag).toBeUndefined();
		});

		it('should include subtasks by default', async () => {
			const result = await tmCore.listTasks();
			const setupTask = result.tasks.find((t) => t.id === '1');

			expect(setupTask?.subtasks).toHaveLength(2);
			expect(setupTask?.subtasks[0].title).toBe('Create directories');
		});

		it('should exclude subtasks when requested', async () => {
			const result = await tmCore.listTasks({ includeSubtasks: false });
			const setupTask = result.tasks.find((t) => t.id === '1');

			expect(setupTask?.subtasks).toHaveLength(0);
		});
	});

	describe('Filtering', () => {
		it('should filter by status', async () => {
			const result = await tmCore.listTasks({
				filter: { status: 'done' }
			});

			expect(result.filtered).toBe(1);
			expect(result.tasks[0].id).toBe('1');
		});

		it('should filter by multiple statuses', async () => {
			const result = await tmCore.listTasks({
				filter: { status: ['done', 'in-progress'] }
			});

			expect(result.filtered).toBe(2);
			const ids = result.tasks.map((t) => t.id);
			expect(ids).toContain('1');
			expect(ids).toContain('2');
		});

		it('should filter by priority', async () => {
			const result = await tmCore.listTasks({
				filter: { priority: 'high' }
			});

			expect(result.filtered).toBe(2);
		});

		it('should filter by tags', async () => {
			const result = await tmCore.listTasks({
				filter: { tags: ['setup'] }
			});

			expect(result.filtered).toBe(1);
			expect(result.tasks[0].id).toBe('1');
		});

		it('should filter by assignee', async () => {
			const result = await tmCore.listTasks({
				filter: { assignee: 'developer1' }
			});

			expect(result.filtered).toBe(1);
			expect(result.tasks[0].id).toBe('2');
		});

		it('should filter by complexity', async () => {
			const result = await tmCore.listTasks({
				filter: { complexity: 'complex' }
			});

			expect(result.filtered).toBe(1);
			expect(result.tasks[0].id).toBe('4');
		});

		it('should filter by search term', async () => {
			const result = await tmCore.listTasks({
				filter: { search: 'documentation' }
			});

			expect(result.filtered).toBe(1);
			expect(result.tasks[0].id).toBe('3');
		});

		it('should filter by hasSubtasks', async () => {
			const withSubtasks = await tmCore.listTasks({
				filter: { hasSubtasks: true }
			});

			expect(withSubtasks.filtered).toBe(1);
			expect(withSubtasks.tasks[0].id).toBe('1');

			const withoutSubtasks = await tmCore.listTasks({
				filter: { hasSubtasks: false }
			});

			expect(withoutSubtasks.filtered).toBe(4);
		});

		it('should handle combined filters', async () => {
			const result = await tmCore.listTasks({
				filter: {
					priority: ['high', 'critical'],
					status: ['pending', 'deferred']
				}
			});

			expect(result.filtered).toBe(1);
			expect(result.tasks[0].id).toBe('5'); // Critical priority, deferred status
		});
	});

	describe('Helper methods', () => {
		it('should get task by ID', async () => {
			const task = await tmCore.getTask('2');

			expect(task).not.toBeNull();
			expect(task?.title).toBe('Implement core features');
		});

		it('should return null for non-existent task', async () => {
			const task = await tmCore.getTask('999');

			expect(task).toBeNull();
		});

		it('should get tasks by status', async () => {
			const pendingTasks = await tmCore.getTasksByStatus('pending');

			expect(pendingTasks).toHaveLength(1);
			expect(pendingTasks[0].id).toBe('3');

			const multipleTasks = await tmCore.getTasksByStatus(['done', 'blocked']);

			expect(multipleTasks).toHaveLength(2);
		});

		it('should get task statistics', async () => {
			const stats = await tmCore.getTaskStats();

			expect(stats.total).toBe(5);
			expect(stats.byStatus.done).toBe(1);
			expect(stats.byStatus['in-progress']).toBe(1);
			expect(stats.byStatus.pending).toBe(1);
			expect(stats.byStatus.blocked).toBe(1);
			expect(stats.byStatus.deferred).toBe(1);
			expect(stats.byStatus.cancelled).toBe(0);
			expect(stats.byStatus.review).toBe(0);
			expect(stats.withSubtasks).toBe(1);
			expect(stats.blocked).toBe(1);
		});
	});

	describe('Error handling', () => {
		it('should handle missing tasks file gracefully', async () => {
			// Create new instance with empty directory
			const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tm-empty-'));
			const emptyCore = createTaskMasterCore(emptyDir);

			try {
				const result = await emptyCore.listTasks();

				expect(result.tasks).toHaveLength(0);
				expect(result.total).toBe(0);
				expect(result.filtered).toBe(0);
			} finally {
				await emptyCore.close();
				await fs.rm(emptyDir, { recursive: true, force: true });
			}
		});

		it('should validate task entities', async () => {
			// Write invalid task data
			const invalidDir = await fs.mkdtemp(
				path.join(os.tmpdir(), 'tm-invalid-')
			);
			const tasksDir = path.join(invalidDir, '.taskmaster', 'tasks');
			await fs.mkdir(tasksDir, { recursive: true });

			const invalidData = {
				tasks: [
					{
						id: '', // Invalid: empty ID
						title: 'Test',
						description: 'Test',
						status: 'done',
						priority: 'high',
						dependencies: [],
						details: 'Test',
						testStrategy: 'Test',
						subtasks: []
					}
				],
				metadata: {
					version: '1.0.0',
					lastModified: new Date().toISOString(),
					taskCount: 1,
					completedCount: 0
				}
			};

			await fs.writeFile(
				path.join(tasksDir, 'tasks.json'),
				JSON.stringify(invalidData)
			);

			const invalidCore = createTaskMasterCore(invalidDir);

			try {
				await expect(invalidCore.listTasks()).rejects.toThrow();
			} finally {
				await invalidCore.close();
				await fs.rm(invalidDir, { recursive: true, force: true });
			}
		});
	});

	describe('Tags support', () => {
		beforeEach(async () => {
			// Create tasks for a different tag
			const taggedTasks = [
				{
					id: 'tag-1',
					title: 'Tagged task',
					description: 'Task with tag',
					status: 'pending' as TaskStatus,
					priority: 'medium' as const,
					dependencies: [],
					details: 'Tagged task details',
					testStrategy: 'Test',
					subtasks: []
				}
			];

			const tagFile = path.join(
				tmpDir,
				'.taskmaster',
				'tasks',
				'feature-branch.json'
			);
			await fs.writeFile(
				tagFile,
				JSON.stringify({
					tasks: taggedTasks,
					metadata: {
						version: '1.0.0',
						lastModified: new Date().toISOString(),
						taskCount: 1,
						completedCount: 0
					}
				})
			);
		});

		it('should list tasks for specific tag', async () => {
			const result = await tmCore.listTasks({ tag: 'feature-branch' });

			expect(result.tasks).toHaveLength(1);
			expect(result.tasks[0].id).toBe('tag-1');
			expect(result.tag).toBe('feature-branch');
		});

		it('should list default tasks when no tag specified', async () => {
			const result = await tmCore.listTasks();

			expect(result.tasks).toHaveLength(5);
			expect(result.tasks[0].id).toBe('1');
		});
	});
});
