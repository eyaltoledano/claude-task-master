import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock dependencies before importing
const mockUtils = {
	readJSON: jest.fn(),
	writeJSON: jest.fn(),
	findProjectRoot: jest.fn(() => '/test/project/root'),
	log: jest.fn(),
	setTasksForTag: jest.fn(),
	traverseDependencies: jest.fn((sourceTasks, allTasks, options = {}) => {
		// Mock realistic dependency behavior for testing
		const { direction = 'forward' } = options;

		if (direction === 'forward') {
			// Return dependencies that tasks have
			const result = [];
			sourceTasks.forEach((task) => {
				if (task.dependencies && Array.isArray(task.dependencies)) {
					result.push(...task.dependencies);
				}
			});
			return result;
		} else if (direction === 'reverse') {
			// Return tasks that depend on the source tasks
			const sourceIds = sourceTasks.map((t) => t.id);
			const normalizedSourceIds = sourceIds.map((id) => String(id));
			const result = [];
			allTasks.forEach((task) => {
				if (task.dependencies && Array.isArray(task.dependencies)) {
					const hasDependency = task.dependencies.some((depId) =>
						normalizedSourceIds.includes(String(depId))
					);
					if (hasDependency) {
						result.push(task.id);
					}
				}
			});
			return result;
		}
		return [];
	})
};

// Mock the utils module
jest.unstable_mockModule('../../scripts/modules/utils.js', () => mockUtils);

// Mock other dependencies
jest.unstable_mockModule(
	'../../scripts/modules/task-manager/is-task-dependent.js',
	() => ({
		default: jest.fn(() => false)
	})
);

jest.unstable_mockModule('../../scripts/modules/dependency-manager.js', () => ({
	findCrossTagDependencies: jest.fn(() => {
		// Since dependencies can only exist within the same tag,
		// this function should never find any cross-tag conflicts
		return [];
	}),
	getDependentTaskIds: jest.fn(
		(sourceTasks, crossTagDependencies, allTasks) => {
			// Since we now use findAllDependenciesRecursively in the actual implementation,
			// this mock simulates finding all dependencies recursively within the same tag
			const dependentIds = new Set();
			const processedIds = new Set();

			function findAllDependencies(taskId) {
				if (processedIds.has(taskId)) return;
				processedIds.add(taskId);

				const task = allTasks.find((t) => t.id === taskId);
				if (!task || !Array.isArray(task.dependencies)) return;

				task.dependencies.forEach((depId) => {
					const normalizedDepId =
						typeof depId === 'string' ? parseInt(depId, 10) : depId;
					if (!isNaN(normalizedDepId) && normalizedDepId !== taskId) {
						dependentIds.add(normalizedDepId);
						findAllDependencies(normalizedDepId);
					}
				});
			}

			sourceTasks.forEach((sourceTask) => {
				if (sourceTask && sourceTask.id) {
					findAllDependencies(sourceTask.id);
				}
			});

			return Array.from(dependentIds);
		}
	),
	validateSubtaskMove: jest.fn((taskId, sourceTag, targetTag) => {
		// Throw error for subtask IDs
		const taskIdStr = String(taskId);
		if (taskIdStr.includes('.')) {
			throw new Error('Cannot move subtasks directly between tags');
		}
	})
}));

jest.unstable_mockModule(
	'../../scripts/modules/task-manager/generate-task-files.js',
	() => ({
		default: jest.fn().mockResolvedValue()
	})
);

// Import the modules we'll be testing after mocking
const { moveTasksBetweenTags } = await import(
	'../../scripts/modules/task-manager/move-task.js'
);

describe('Cross-Tag Task Movement Integration Tests', () => {
	let testDataPath;
	let mockTasksData;

	beforeEach(() => {
		// Setup test data path
		testDataPath = path.join(__dirname, 'temp-test-tasks.json');

		// Initialize mock data with multiple tags
		mockTasksData = {
			backlog: {
				tasks: [
					{
						id: 1,
						title: 'Backlog Task 1',
						description: 'A task in backlog',
						status: 'pending',
						dependencies: [],
						priority: 'medium',
						tag: 'backlog'
					},
					{
						id: 2,
						title: 'Backlog Task 2',
						description: 'Another task in backlog',
						status: 'pending',
						dependencies: [1],
						priority: 'high',
						tag: 'backlog'
					},
					{
						id: 3,
						title: 'Backlog Task 3',
						description: 'Independent task',
						status: 'pending',
						dependencies: [],
						priority: 'low',
						tag: 'backlog'
					}
				]
			},
			'in-progress': {
				tasks: [
					{
						id: 4,
						title: 'In Progress Task 1',
						description: 'A task being worked on',
						status: 'in-progress',
						dependencies: [],
						priority: 'high',
						tag: 'in-progress'
					}
				]
			},
			done: {
				tasks: [
					{
						id: 5,
						title: 'Completed Task 1',
						description: 'A completed task',
						status: 'done',
						dependencies: [],
						priority: 'medium',
						tag: 'done'
					}
				]
			}
		};

		// Setup mock utils
		mockUtils.readJSON.mockReturnValue(mockTasksData);
		mockUtils.writeJSON.mockImplementation((path, data, projectRoot, tag) => {
			// Simulate writing to file
			return Promise.resolve();
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
		// Clean up temp file if it exists
		if (fs.existsSync(testDataPath)) {
			fs.unlinkSync(testDataPath);
		}
	});

	describe('Basic Cross-Tag Movement', () => {
		it('should move a single task between tags successfully', async () => {
			const taskIds = [1];
			const sourceTag = 'backlog';
			const targetTag = 'in-progress';

			const result = await moveTasksBetweenTags(
				testDataPath,
				taskIds,
				sourceTag,
				targetTag,
				{},
				{ projectRoot: '/test/project' }
			);

			// Verify readJSON was called with correct parameters
			expect(mockUtils.readJSON).toHaveBeenCalledWith(
				testDataPath,
				'/test/project',
				sourceTag
			);

			// Verify writeJSON was called with updated data
			expect(mockUtils.writeJSON).toHaveBeenCalledWith(
				testDataPath,
				expect.objectContaining({
					backlog: expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({ id: 2 }),
							expect.objectContaining({ id: 3 })
						])
					}),
					'in-progress': expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({ id: 4 }),
							expect.objectContaining({
								id: 1,
								tag: 'in-progress'
							})
						])
					})
				}),
				'/test/project',
				null
			);

			// Verify result structure
			expect(result).toEqual({
				message: 'Successfully moved 1 tasks from "backlog" to "in-progress"',
				movedTasks: [
					{
						id: 1,
						fromTag: 'backlog',
						toTag: 'in-progress'
					}
				]
			});
		});

		it('should move multiple tasks between tags', async () => {
			const taskIds = [1, 3];
			const sourceTag = 'backlog';
			const targetTag = 'done';

			const result = await moveTasksBetweenTags(
				testDataPath,
				taskIds,
				sourceTag,
				targetTag,
				{},
				{ projectRoot: '/test/project' }
			);

			// Verify the moved tasks are in the target tag
			expect(mockUtils.writeJSON).toHaveBeenCalledWith(
				testDataPath,
				expect.objectContaining({
					backlog: expect.objectContaining({
						tasks: expect.arrayContaining([expect.objectContaining({ id: 2 })])
					}),
					done: expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({ id: 5 }),
							expect.objectContaining({
								id: 1,
								tag: 'done'
							}),
							expect.objectContaining({
								id: 3,
								tag: 'done'
							})
						])
					})
				}),
				'/test/project',
				null
			);

			// Verify result structure
			expect(result.movedTasks).toHaveLength(2);
			expect(result.movedTasks).toEqual(
				expect.arrayContaining([
					{ id: 1, fromTag: 'backlog', toTag: 'done' },
					{ id: 3, fromTag: 'backlog', toTag: 'done' }
				])
			);
		});

		it('should create target tag if it does not exist', async () => {
			const taskIds = [1];
			const sourceTag = 'backlog';
			const targetTag = 'new-tag';

			const result = await moveTasksBetweenTags(
				testDataPath,
				taskIds,
				sourceTag,
				targetTag,
				{},
				{ projectRoot: '/test/project' }
			);

			// Verify new tag was created
			expect(mockUtils.writeJSON).toHaveBeenCalledWith(
				testDataPath,
				expect.objectContaining({
					'new-tag': expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({
								id: 1,
								tag: 'new-tag'
							})
						])
					})
				}),
				'/test/project',
				null
			);
		});
	});

	describe('Dependency Handling', () => {
		it('should move task with dependencies when withDependencies is true', async () => {
			const taskIds = [2]; // Task 2 depends on Task 1
			const sourceTag = 'backlog';
			const targetTag = 'in-progress';

			const result = await moveTasksBetweenTags(
				testDataPath,
				taskIds,
				sourceTag,
				targetTag,
				{ withDependencies: true },
				{ projectRoot: '/test/project' }
			);

			// Verify both task 2 and its dependency (task 1) were moved
			expect(mockUtils.writeJSON).toHaveBeenCalledWith(
				testDataPath,
				expect.objectContaining({
					backlog: expect.objectContaining({
						tasks: expect.arrayContaining([expect.objectContaining({ id: 3 })])
					}),
					'in-progress': expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({ id: 4 }),
							expect.objectContaining({
								id: 1,
								tag: 'in-progress'
							}),
							expect.objectContaining({
								id: 2,
								tag: 'in-progress'
							})
						])
					})
				}),
				'/test/project',
				null
			);
		});

		it('should move task normally when ignoreDependencies is true (no cross-tag conflicts to ignore)', async () => {
			const taskIds = [2]; // Task 2 depends on Task 1
			const sourceTag = 'backlog';
			const targetTag = 'in-progress';

			const result = await moveTasksBetweenTags(
				testDataPath,
				taskIds,
				sourceTag,
				targetTag,
				{ ignoreDependencies: true },
				{ projectRoot: '/test/project' }
			);

			// Since dependencies only exist within tags, there are no cross-tag conflicts to ignore
			// Task 2 moves with its dependencies intact
			expect(mockUtils.writeJSON).toHaveBeenCalledWith(
				testDataPath,
				expect.objectContaining({
					backlog: expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({ id: 1 }),
							expect.objectContaining({ id: 3 })
						])
					}),
					'in-progress': expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({ id: 4 }),
							expect.objectContaining({
								id: 2,
								tag: 'in-progress',
								dependencies: [1] // Dependencies preserved since no cross-tag conflicts
							})
						])
					})
				}),
				'/test/project',
				null
			);
		});

		it('should provide advisory tips when ignoreDependencies breaks deps', async () => {
			// Move a task that has dependencies so cross-tag conflicts would be broken
			const taskIds = [2]; // backlog:2 depends on 1
			const sourceTag = 'backlog';
			const targetTag = 'in-progress';

			// Override cross-tag detection to simulate conflicts for this case
			const depManager = await import(
				'../../scripts/modules/dependency-manager.js'
			);
			depManager.findCrossTagDependencies.mockReturnValueOnce([
				{ taskId: 2, dependencyId: 1, dependencyTag: sourceTag }
			]);

			const result = await moveTasksBetweenTags(
				testDataPath,
				taskIds,
				sourceTag,
				targetTag,
				{ ignoreDependencies: true },
				{ projectRoot: '/test/project' }
			);

			expect(Array.isArray(result.tips)).toBe(true);
			const expectedTips = [
				'Run "task-master validate-dependencies" to check for dependency issues.',
				'Run "task-master fix-dependencies" to automatically repair dangling dependencies.'
			];
			expect(result.tips).toHaveLength(expectedTips.length);
			expect(result.tips).toEqual(expect.arrayContaining(expectedTips));
		});

		it('should move task without cross-tag dependency conflicts (since dependencies only exist within tags)', async () => {
			const taskIds = [2]; // Task 2 depends on Task 1 (both in same tag)
			const sourceTag = 'backlog';
			const targetTag = 'in-progress';

			// Since dependencies can only exist within the same tag,
			// there should be no cross-tag conflicts
			const result = await moveTasksBetweenTags(
				testDataPath,
				taskIds,
				sourceTag,
				targetTag,
				{},
				{ projectRoot: '/test/project' }
			);

			// Verify task was moved successfully (without dependencies)
			expect(mockUtils.writeJSON).toHaveBeenCalledWith(
				testDataPath,
				expect.objectContaining({
					backlog: expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({ id: 1 }), // Task 1 stays in backlog
							expect.objectContaining({ id: 3 })
						])
					}),
					'in-progress': expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({ id: 4 }),
							expect.objectContaining({
								id: 2,
								tag: 'in-progress'
							})
						])
					})
				}),
				'/test/project',
				null
			);
		});
	});

	describe('Error Handling', () => {
		it('should throw error for invalid source tag', async () => {
			const taskIds = [1];
			const sourceTag = 'nonexistent-tag';
			const targetTag = 'in-progress';

			// Mock readJSON to return data without the source tag
			mockUtils.readJSON.mockReturnValue({
				'in-progress': { tasks: [] }
			});

			await expect(
				moveTasksBetweenTags(
					testDataPath,
					taskIds,
					sourceTag,
					targetTag,
					{},
					{ projectRoot: '/test/project' }
				)
			).rejects.toThrow('Source tag "nonexistent-tag" not found or invalid');
		});

		it('should throw error for invalid task IDs', async () => {
			const taskIds = [999]; // Non-existent task ID
			const sourceTag = 'backlog';
			const targetTag = 'in-progress';

			await expect(
				moveTasksBetweenTags(
					testDataPath,
					taskIds,
					sourceTag,
					targetTag,
					{},
					{ projectRoot: '/test/project' }
				)
			).rejects.toThrow('Task 999 not found in source tag "backlog"');
		});

		it('should throw error for subtask movement', async () => {
			const taskIds = ['1.1']; // Subtask ID
			const sourceTag = 'backlog';
			const targetTag = 'in-progress';

			await expect(
				moveTasksBetweenTags(
					testDataPath,
					taskIds,
					sourceTag,
					targetTag,
					{},
					{ projectRoot: '/test/project' }
				)
			).rejects.toThrow('Cannot move subtasks directly between tags');
		});

		it('should handle ID conflicts in target tag', async () => {
			// Setup data with conflicting IDs
			const conflictingData = {
				backlog: {
					tasks: [
						{
							id: 1,
							title: 'Backlog Task',
							tag: 'backlog'
						}
					]
				},
				'in-progress': {
					tasks: [
						{
							id: 1, // Same ID as in backlog
							title: 'In Progress Task',
							tag: 'in-progress'
						}
					]
				}
			};

			mockUtils.readJSON.mockReturnValue(conflictingData);

			const taskIds = [1];
			const sourceTag = 'backlog';
			const targetTag = 'in-progress';

			await expect(
				moveTasksBetweenTags(
					testDataPath,
					taskIds,
					sourceTag,
					targetTag,
					{},
					{ projectRoot: '/test/project' }
				)
			).rejects.toThrow('Task 1 already exists in target tag "in-progress"');

			// Validate suggestions on the error payload
			try {
				await moveTasksBetweenTags(
					testDataPath,
					taskIds,
					sourceTag,
					targetTag,
					{},
					{ projectRoot: '/test/project' }
				);
			} catch (err) {
				expect(err.code).toBe('TASK_ALREADY_EXISTS');
				expect(Array.isArray(err.data?.suggestions)).toBe(true);
				const s = (err.data?.suggestions || []).join(' ');
				expect(s).toContain('different target tag');
				expect(s).toContain('different set of IDs');
				expect(s).toContain('within-tag');
			}
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty task list in source tag', async () => {
			const emptyData = {
				backlog: { tasks: [] },
				'in-progress': { tasks: [] }
			};

			mockUtils.readJSON.mockReturnValue(emptyData);

			const taskIds = [1];
			const sourceTag = 'backlog';
			const targetTag = 'in-progress';

			await expect(
				moveTasksBetweenTags(
					testDataPath,
					taskIds,
					sourceTag,
					targetTag,
					{},
					{ projectRoot: '/test/project' }
				)
			).rejects.toThrow('Task 1 not found in source tag "backlog"');
		});

		it('should preserve task metadata during move', async () => {
			const taskIds = [1];
			const sourceTag = 'backlog';
			const targetTag = 'in-progress';

			const result = await moveTasksBetweenTags(
				testDataPath,
				taskIds,
				sourceTag,
				targetTag,
				{},
				{ projectRoot: '/test/project' }
			);

			// Verify task metadata is preserved
			expect(mockUtils.writeJSON).toHaveBeenCalledWith(
				testDataPath,
				expect.objectContaining({
					'in-progress': expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({
								id: 1,
								title: 'Backlog Task 1',
								description: 'A task in backlog',
								status: 'pending',
								priority: 'medium',
								tag: 'in-progress', // Tag should be updated
								metadata: expect.objectContaining({
									moveHistory: expect.arrayContaining([
										expect.objectContaining({
											fromTag: 'backlog',
											toTag: 'in-progress',
											timestamp: expect.any(String)
										})
									])
								})
							})
						])
					})
				}),
				'/test/project',
				null
			);
		});

		// Note: force flag deprecated for cross-tag moves; covered by with/ignore dependencies tests
	});

	describe('Complex Scenarios', () => {
		it('should handle complex moves without cross-tag conflicts (dependencies only within tags)', async () => {
			// Setup data with valid within-tag dependencies
			const validData = {
				backlog: {
					tasks: [
						{
							id: 1,
							title: 'Task 1',
							dependencies: [], // No dependencies
							tag: 'backlog'
						},
						{
							id: 3,
							title: 'Task 3',
							dependencies: [1], // Depends on Task 1 (same tag)
							tag: 'backlog'
						}
					]
				},
				'in-progress': {
					tasks: [
						{
							id: 2,
							title: 'Task 2',
							dependencies: [], // No dependencies
							tag: 'in-progress'
						}
					]
				}
			};

			mockUtils.readJSON.mockReturnValue(validData);

			const taskIds = [3];
			const sourceTag = 'backlog';
			const targetTag = 'in-progress';

			// Should succeed since there are no cross-tag conflicts
			const result = await moveTasksBetweenTags(
				testDataPath,
				taskIds,
				sourceTag,
				targetTag,
				{},
				{ projectRoot: '/test/project' }
			);

			expect(result).toEqual({
				message: 'Successfully moved 1 tasks from "backlog" to "in-progress"',
				movedTasks: [{ id: 3, fromTag: 'backlog', toTag: 'in-progress' }]
			});
		});

		it('should handle bulk move with mixed dependency scenarios', async () => {
			const taskIds = [1, 2, 3]; // Multiple tasks with dependencies
			const sourceTag = 'backlog';
			const targetTag = 'in-progress';

			const result = await moveTasksBetweenTags(
				testDataPath,
				taskIds,
				sourceTag,
				targetTag,
				{ withDependencies: true },
				{ projectRoot: '/test/project' }
			);

			// Verify all tasks were moved
			expect(mockUtils.writeJSON).toHaveBeenCalledWith(
				testDataPath,
				expect.objectContaining({
					backlog: expect.objectContaining({
						tasks: [] // All tasks should be moved
					}),
					'in-progress': expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({ id: 4 }),
							expect.objectContaining({ id: 1, tag: 'in-progress' }),
							expect.objectContaining({ id: 2, tag: 'in-progress' }),
							expect.objectContaining({ id: 3, tag: 'in-progress' })
						])
					})
				}),
				'/test/project',
				null
			);

			// Verify result structure
			expect(result.movedTasks).toHaveLength(3);
			expect(result.movedTasks).toEqual(
				expect.arrayContaining([
					{ id: 1, fromTag: 'backlog', toTag: 'in-progress' },
					{ id: 2, fromTag: 'backlog', toTag: 'in-progress' },
					{ id: 3, fromTag: 'backlog', toTag: 'in-progress' }
				])
			);
		});
	});
});
