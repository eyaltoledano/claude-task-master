/**
 * Unit Tests for TaskMaster Integration Tools
 * Target: 90%+ coverage for src/tools/taskmaster.ts
 */

import {
	describe,
	it,
	expect,
	jest,
	beforeEach,
	afterEach
} from '@jest/globals';
import {
	listTasksInputSchema,
	getTaskInputSchema,
	getNextTaskInputSchema,
	getCurrentContextInputSchema,
	listTasksTool,
	getTaskTool,
	getNextTaskTool,
	getCurrentContextTool
} from '../../../src/tools/taskmaster.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

// Helper to create test directory structure
async function createTestDir(): Promise<string> {
	const testDir = path.join(tmpdir(), `taskmaster-test-${Date.now()}`);
	await fs.mkdir(path.join(testDir, '.taskmaster', 'tasks'), { recursive: true });
	return testDir;
}

// Helper to clean up
async function cleanupTestDir(dir: string): Promise<void> {
	try {
		await fs.rm(dir, { recursive: true, force: true });
	} catch {
		// Ignore cleanup errors
	}
}

// Sample task data
const sampleTasks = {
	tasks: [
		{
			id: 1,
			title: 'Setup project',
			status: 'done',
			priority: 'high',
			dependencies: [],
			description: 'Initial setup',
			subtasks: []
		},
		{
			id: 2,
			title: 'Implement feature A',
			status: 'in-progress',
			priority: 'high',
			dependencies: [1],
			description: 'Feature implementation',
			subtasks: [
				{ id: 1, title: 'Subtask 1', status: 'done', description: 'Sub 1' },
				{ id: 2, title: 'Subtask 2', status: 'pending', description: 'Sub 2' }
			]
		},
		{
			id: 3,
			title: 'Write tests',
			status: 'pending',
			priority: 'medium',
			dependencies: [2],
			description: 'Test coverage'
		},
		{
			id: 4,
			title: 'Deploy',
			status: 'pending',
			priority: 'low',
			dependencies: [1],
			description: 'Deployment'
		},
		{
			id: 5,
			title: 'Documentation',
			status: 'blocked',
			priority: 'medium',
			dependencies: [3]
		}
	]
};

// Tagged tasks format
const taggedTasks = {
	currentTag: 'feature-x',
	tags: {
		master: {
			tasks: sampleTasks.tasks
		},
		'feature-x': {
			tasks: [
				{
					id: 1,
					title: 'Feature X setup',
					status: 'done',
					priority: 'high',
					dependencies: []
				},
				{
					id: 2,
					title: 'Feature X implementation',
					status: 'pending',
					priority: 'high',
					dependencies: [1]
				}
			]
		}
	}
};

describe('TaskMaster Integration Tools', () => {
	const originalEnv = process.env;
	let testDir: string;

	beforeEach(async () => {
		process.env = { ...originalEnv };
		testDir = await createTestDir();
	});

	afterEach(async () => {
		process.env = originalEnv;
		await cleanupTestDir(testDir);
	});

	describe('Input Schemas', () => {
		describe('listTasksInputSchema', () => {
			it('should use default values', () => {
				const result = listTasksInputSchema.parse({});
				expect(result.status).toBe('all');
				expect(result.tag).toBeUndefined();
				expect(result.withSubtasks).toBe(false);
			});

			it('should accept valid status values', () => {
				const validStatuses = [
					'all',
					'pending',
					'in-progress',
					'done',
					'blocked',
					'cancelled'
				];
				for (const status of validStatuses) {
					expect(() => listTasksInputSchema.parse({ status })).not.toThrow();
				}
			});

			it('should reject invalid status values', () => {
				expect(() =>
					listTasksInputSchema.parse({ status: 'invalid' })
				).toThrow();
			});

			it('should accept custom values', () => {
				const result = listTasksInputSchema.parse({
					status: 'pending',
					tag: 'feature-x',
					withSubtasks: true
				});
				expect(result.status).toBe('pending');
				expect(result.tag).toBe('feature-x');
				expect(result.withSubtasks).toBe(true);
			});
		});

		describe('getTaskInputSchema', () => {
			it('should require id', () => {
				expect(() => getTaskInputSchema.parse({})).toThrow();
				expect(() => getTaskInputSchema.parse({ id: '5' })).not.toThrow();
			});

			it('should accept task IDs', () => {
				expect(getTaskInputSchema.parse({ id: '1' }).id).toBe('1');
				expect(getTaskInputSchema.parse({ id: '15' }).id).toBe('15');
			});

			it('should accept subtask IDs', () => {
				expect(getTaskInputSchema.parse({ id: '1.2' }).id).toBe('1.2');
				expect(getTaskInputSchema.parse({ id: '15.3' }).id).toBe('15.3');
			});
		});

		describe('getNextTaskInputSchema', () => {
			it('should accept empty input', () => {
				expect(() => getNextTaskInputSchema.parse({})).not.toThrow();
			});

			it('should accept optional tag', () => {
				const result = getNextTaskInputSchema.parse({ tag: 'feature-x' });
				expect(result.tag).toBe('feature-x');
			});
		});

		describe('getCurrentContextInputSchema', () => {
			it('should accept empty input', () => {
				expect(() => getCurrentContextInputSchema.parse({})).not.toThrow();
			});

			it('should be an empty object schema', () => {
				const result = getCurrentContextInputSchema.parse({});
				expect(result).toEqual({});
			});
		});
	});

	describe('Tool Definitions', () => {
		describe('listTasksTool', () => {
			it('should have correct description', () => {
				expect(listTasksTool.description).toContain('task');
				expect(listTasksTool.description).toContain('status');
			});

			it('should have execute function', () => {
				expect(typeof listTasksTool.execute).toBe('function');
			});
		});

		describe('getTaskTool', () => {
			it('should have correct description', () => {
				expect(getTaskTool.description).toContain('task');
				expect(getTaskTool.description).toContain('ID');
			});

			it('should have execute function', () => {
				expect(typeof getTaskTool.execute).toBe('function');
			});
		});

		describe('getNextTaskTool', () => {
			it('should have correct description', () => {
				expect(getNextTaskTool.description).toContain('next');
				expect(getNextTaskTool.description).toContain('dependencies');
			});

			it('should have execute function', () => {
				expect(typeof getNextTaskTool.execute).toBe('function');
			});
		});

		describe('getCurrentContextTool', () => {
			it('should have correct description', () => {
				expect(getCurrentContextTool.description).toContain('context');
				expect(getCurrentContextTool.description).toContain('in-progress');
			});

			it('should have execute function', () => {
				expect(typeof getCurrentContextTool.execute).toBe('function');
			});
		});
	});

	describe('Tool Execution', () => {
		describe('listTasksTool.execute', () => {
			it('should return empty array when no tasks file exists', async () => {
				process.env.PROJECT_ROOT = testDir;

				const result = await listTasksTool.execute({
					status: 'all',
					withSubtasks: false
				});

				expect(result.tasks).toEqual([]);
				expect(result.totalTasks).toBe(0);
			});

			it('should list all tasks', async () => {
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(sampleTasks));
				process.env.PROJECT_ROOT = testDir;

				const result = await listTasksTool.execute({
					status: 'all',
					withSubtasks: false
				});

				expect(result.totalTasks).toBe(5);
				expect(result.tasks.length).toBe(5);
			});

			it('should filter by status', async () => {
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(sampleTasks));
				process.env.PROJECT_ROOT = testDir;

				const result = await listTasksTool.execute({
					status: 'pending',
					withSubtasks: false
				});

				expect(result.totalTasks).toBe(2);
				result.tasks.forEach((t) => expect(t.status).toBe('pending'));
			});

			it('should include subtask info when withSubtasks is true', async () => {
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(sampleTasks));
				process.env.PROJECT_ROOT = testDir;

				const result = await listTasksTool.execute({
					status: 'in-progress',
					withSubtasks: true
				});

				expect(result.totalTasks).toBe(1);
				expect(result.tasks[0].title).toContain('subtasks');
			});

			it('should handle tagged tasks format', async () => {
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(taggedTasks));
				process.env.PROJECT_ROOT = testDir;

				const result = await listTasksTool.execute({
					status: 'all',
					tag: 'feature-x',
					withSubtasks: false
				});

				expect(result.tag).toBe('feature-x');
				expect(result.totalTasks).toBe(2);
			});

			it('should default to master tag when no currentTag in tagged format', async () => {
				const dataWithoutCurrentTag = {
					tags: {
						master: { tasks: sampleTasks.tasks },
						other: { tasks: [] }
					}
					// No currentTag specified
				};
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(dataWithoutCurrentTag));
				process.env.PROJECT_ROOT = testDir;

				const result = await listTasksTool.execute({ status: 'all' });

				expect(result.tag).toBe('master');
				expect(result.tasks.length).toBeGreaterThan(0);
			});

			it('should handle invalid JSON gracefully', async () => {
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, '{ invalid json }');
				process.env.PROJECT_ROOT = testDir;

				const result = await listTasksTool.execute({ status: 'all' });

				expect(result.tasks).toEqual([]);
				expect(result.totalTasks).toBe(0);
			});

			it('should handle direct array format', async () => {
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(sampleTasks.tasks));
				process.env.PROJECT_ROOT = testDir;

				const result = await listTasksTool.execute({
					status: 'all',
					withSubtasks: false
				});

				expect(result.totalTasks).toBe(5);
			});

			it('should return empty for unrecognized data format', async () => {
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				// Write an object that doesn't match any known format
				await fs.writeFile(tasksPath, JSON.stringify({ unknownField: 'value' }));
				process.env.PROJECT_ROOT = testDir;

				const result = await listTasksTool.execute({
					status: 'all',
					withSubtasks: false
				});

				expect(result.tasks).toEqual([]);
				expect(result.totalTasks).toBe(0);
			});
		});

		describe('getTaskTool.execute', () => {
			it('should return null when no tasks file exists', async () => {
				process.env.PROJECT_ROOT = testDir;

				const result = await getTaskTool.execute({ id: '1' });

				expect(result).toBeNull();
			});

			it('should get task by ID', async () => {
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(sampleTasks));
				process.env.PROJECT_ROOT = testDir;

				const result = await getTaskTool.execute({ id: '2' });

				expect(result).not.toBeNull();
				expect(result?.id).toBe('2');
				expect(result?.title).toBe('Implement feature A');
				expect(result?.hasSubtasks).toBe(true);
			});

			it('should return null for non-existent task', async () => {
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(sampleTasks));
				process.env.PROJECT_ROOT = testDir;

				const result = await getTaskTool.execute({ id: '999' });

				expect(result).toBeNull();
			});

			it('should get subtask by ID', async () => {
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(sampleTasks));
				process.env.PROJECT_ROOT = testDir;

				const result = await getTaskTool.execute({ id: '2.1' });

				expect(result).not.toBeNull();
				expect(result?.id).toBe('2.1');
				expect(result?.title).toBe('Subtask 1');
			});

			it('should return null for non-existent subtask', async () => {
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(sampleTasks));
				process.env.PROJECT_ROOT = testDir;

				const result = await getTaskTool.execute({ id: '2.99' });

				expect(result).toBeNull();
			});

			it('should handle subtask without description', async () => {
				const taskWithSubNoDesc = {
					tasks: [
						{
							id: 1,
							title: 'Parent',
							status: 'pending',
							subtasks: [
								{ id: 1, title: 'Sub 1', status: 'pending' }
								// No description field
							]
						}
					]
				};
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(taskWithSubNoDesc));
				process.env.PROJECT_ROOT = testDir;

				const result = await getTaskTool.execute({ id: '1.1' });

				expect(result).not.toBeNull();
				expect(result?.description).toBe('');
			});

			it('should return task without subtasks flag when no subtasks', async () => {
				const taskNoSubs = {
					tasks: [
						{ id: 1, title: 'Task 1', status: 'pending', subtasks: [] }
					]
				};
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(taskNoSubs));
				process.env.PROJECT_ROOT = testDir;

				const result = await getTaskTool.execute({ id: '1' });

				expect(result?.hasSubtasks).toBe(false);
			});
		});

		describe('getNextTaskTool.execute', () => {
			it('should return null when no tasks file exists', async () => {
				process.env.PROJECT_ROOT = testDir;

				const result = await getNextTaskTool.execute({});

				expect(result).toBeNull();
			});

			it('should return highest priority pending task with satisfied dependencies', async () => {
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(sampleTasks));
				process.env.PROJECT_ROOT = testDir;

				const result = await getNextTaskTool.execute({});

				expect(result).not.toBeNull();
				// Task 4 (Deploy) has dependency [1] which is done, and is low priority
				// But there's no high priority pending task with all deps satisfied
				expect(result?.status).toBe('pending');
			});

			it('should return null when no eligible tasks', async () => {
				const noEligible = {
					tasks: [
						{ id: 1, title: 'Task 1', status: 'pending', dependencies: [2] },
						{ id: 2, title: 'Task 2', status: 'pending', dependencies: [1] }
					]
				};
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(noEligible));
				process.env.PROJECT_ROOT = testDir;

				const result = await getNextTaskTool.execute({});

				// Both tasks have circular dependencies, neither is eligible
				expect(result).toBeNull();
			});

			it('should prioritize by priority and then by ID', async () => {
				const priorityTasks = {
					tasks: [
						{ id: 1, title: 'Low priority', status: 'pending', priority: 'low', dependencies: [] },
						{ id: 2, title: 'High priority', status: 'pending', priority: 'high', dependencies: [] },
						{ id: 3, title: 'Medium priority', status: 'pending', priority: 'medium', dependencies: [] }
					]
				};
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(priorityTasks));
				process.env.PROJECT_ROOT = testDir;

				const result = await getNextTaskTool.execute({});

				expect(result?.id).toBe('2'); // High priority first
			});

			it('should sort by ID when priorities are equal', async () => {
				const samePriorityTasks = {
					tasks: [
						{ id: 5, title: 'Task 5', status: 'pending', priority: 'medium', dependencies: [] },
						{ id: 2, title: 'Task 2', status: 'pending', priority: 'medium', dependencies: [] },
						{ id: 8, title: 'Task 8', status: 'pending', priority: 'medium', dependencies: [] }
					]
				};
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(samePriorityTasks));
				process.env.PROJECT_ROOT = testDir;

				const result = await getNextTaskTool.execute({});

				expect(result?.id).toBe('2'); // Lowest ID when priorities are equal
			});

			it('should skip tasks with unsatisfied dependencies', async () => {
				const depTasks = {
					tasks: [
						{ id: 1, title: 'Task 1', status: 'done', priority: 'high', dependencies: [] },
						{ id: 2, title: 'Task 2', status: 'pending', priority: 'high', dependencies: [1] },
						{ id: 3, title: 'Task 3', status: 'pending', priority: 'high', dependencies: [99] }
					]
				};
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(depTasks));
				process.env.PROJECT_ROOT = testDir;

				const result = await getNextTaskTool.execute({});

				// Task 3 depends on non-existent task 99, so Task 2 should be next
				expect(result?.id).toBe('2');
			});

			it('should handle tasks with no priority specified', async () => {
				const noPriorityTasks = {
					tasks: [
						{ id: 1, title: 'Task 1', status: 'pending', dependencies: [] }
						// No priority field
					]
				};
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(noPriorityTasks));
				process.env.PROJECT_ROOT = testDir;

				const result = await getNextTaskTool.execute({});

				expect(result?.id).toBe('1');
				// Priority is passed through as-is, no defaulting in the tool
			});

			it('should handle tasks with no dependencies array', async () => {
				const noDepsTask = {
					tasks: [
						{ id: 1, title: 'Task 1', status: 'pending', priority: 'high' }
						// No dependencies field
					]
				};
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(noDepsTask));
				process.env.PROJECT_ROOT = testDir;

				const result = await getNextTaskTool.execute({});

				expect(result?.id).toBe('1');
				expect(result?.dependencies).toEqual([]);
			});
		});

		describe('getCurrentContextTool.execute', () => {
			it('should return default context when no tasks file exists', async () => {
				process.env.PROJECT_ROOT = testDir;

				const result = await getCurrentContextTool.execute({});

				expect(result.currentTag).toBe('master');
				expect(result.inProgressTasks).toEqual([]);
				expect(result.recentlyCompleted).toEqual([]);
				expect(result.projectRoot).toBe(testDir);
			});

			it('should return in-progress and recently completed tasks', async () => {
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				await fs.writeFile(tasksPath, JSON.stringify(sampleTasks));
				process.env.PROJECT_ROOT = testDir;

				const result = await getCurrentContextTool.execute({});

				expect(result.inProgressTasks.length).toBe(1);
				expect(result.inProgressTasks[0].title).toBe('Implement feature A');
				expect(result.recentlyCompleted.length).toBe(1);
			});

			it('should read current tag from state file', async () => {
				const tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
				const statePath = path.join(testDir, '.taskmaster', 'state.json');
				await fs.writeFile(tasksPath, JSON.stringify(taggedTasks));
				await fs.writeFile(statePath, JSON.stringify({ currentTag: 'feature-x' }));
				process.env.PROJECT_ROOT = testDir;

				const result = await getCurrentContextTool.execute({});

				expect(result.currentTag).toBe('feature-x');
			});
		});
	});

	describe('Default Export', () => {
		it('should export all tools via default', async () => {
			const defaultExport = (await import('../../../src/tools/taskmaster.js')).default;

			expect(defaultExport.listTasks).toBe(listTasksTool);
			expect(defaultExport.getTask).toBe(getTaskTool);
			expect(defaultExport.getNextTask).toBe(getNextTaskTool);
			expect(defaultExport.getCurrentContext).toBe(getCurrentContextTool);
		});
	});
});
