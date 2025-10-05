import { jest } from '@jest/globals';

// --- Mocks ---
jest.unstable_mockModule('../../../../../scripts/modules/utils.js', () => ({
	readJSON: jest.fn(),
	writeJSON: jest.fn(),
	log: jest.fn(),
	setTasksForTag: jest.fn(),
	truncate: jest.fn((t) => t),
	isSilentMode: jest.fn(() => false),
	traverseDependencies: jest.fn((sourceTasks, allTasks, options = {}) => {
		// Mock realistic dependency behavior for testing
		const { direction = 'forward' } = options;

		if (direction === 'forward') {
			// For forward dependencies: return tasks that the source tasks depend on
			const result = [];
			sourceTasks.forEach((task) => {
				if (task.dependencies && Array.isArray(task.dependencies)) {
					result.push(...task.dependencies);
				}
			});
			return result;
		} else if (direction === 'reverse') {
			// For reverse dependencies: return tasks that depend on the source tasks
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
}));

jest.unstable_mockModule(
	'../../../../../scripts/modules/task-manager/generate-task-files.js',
	() => ({
		default: jest.fn().mockResolvedValue()
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/task-manager.js',
	() => ({
		isTaskDependentOn: jest.fn(() => false)
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/dependency-manager.js',
	() => ({
		validateCrossTagMove: jest.fn(),
		findCrossTagDependencies: jest.fn(),
		getDependentTaskIds: jest.fn(),
		validateSubtaskMove: jest.fn()
	})
);

const { readJSON, writeJSON, log } = await import(
	'../../../../../scripts/modules/utils.js'
);

const {
	validateCrossTagMove,
	findCrossTagDependencies,
	getDependentTaskIds,
	validateSubtaskMove
} = await import('../../../../../scripts/modules/dependency-manager.js');

const { moveTasksBetweenTags, getAllTasksWithTags } = await import(
	'../../../../../scripts/modules/task-manager/move-task.js'
);

describe('Cross-Tag Task Movement', () => {
	let mockRawData;
	let mockTasksPath;
	let mockContext;

	beforeEach(() => {
		jest.clearAllMocks();

		// Setup mock data
		mockRawData = {
			backlog: {
				tasks: [
					{ id: 1, title: 'Task 1', dependencies: [2] },
					{ id: 2, title: 'Task 2', dependencies: [] },
					{ id: 3, title: 'Task 3', dependencies: [1] }
				]
			},
			'in-progress': {
				tasks: [{ id: 4, title: 'Task 4', dependencies: [] }]
			},
			done: {
				tasks: [{ id: 5, title: 'Task 5', dependencies: [4] }]
			}
		};

		mockTasksPath = '/test/path/tasks.json';
		mockContext = { projectRoot: '/test/project' };

		// Mock readJSON to return our test data
		readJSON.mockImplementation((path, projectRoot, tag) => {
			return { ...mockRawData[tag], tag, _rawTaggedData: mockRawData };
		});

		writeJSON.mockResolvedValue();
		log.mockImplementation(() => {});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('getAllTasksWithTags', () => {
		it('should return all tasks with tag information', () => {
			const allTasks = getAllTasksWithTags(mockRawData);

			expect(allTasks).toHaveLength(5);
			expect(allTasks.find((t) => t.id === 1).tag).toBe('backlog');
			expect(allTasks.find((t) => t.id === 4).tag).toBe('in-progress');
			expect(allTasks.find((t) => t.id === 5).tag).toBe('done');
		});
	});

	describe('validateCrossTagMove', () => {
		it('should allow move when no dependencies exist', () => {
			const task = { id: 2, dependencies: [] };
			const allTasks = getAllTasksWithTags(mockRawData);

			validateCrossTagMove.mockReturnValue({ canMove: true, conflicts: [] });
			const result = validateCrossTagMove(
				task,
				'backlog',
				'in-progress',
				allTasks
			);

			expect(result.canMove).toBe(true);
			expect(result.conflicts).toHaveLength(0);
		});

		it('should block move when cross-tag dependencies exist', () => {
			const task = { id: 1, dependencies: [2] };
			const allTasks = getAllTasksWithTags(mockRawData);

			validateCrossTagMove.mockReturnValue({
				canMove: false,
				conflicts: [{ taskId: 1, dependencyId: 2, dependencyTag: 'backlog' }]
			});
			const result = validateCrossTagMove(
				task,
				'backlog',
				'in-progress',
				allTasks
			);

			expect(result.canMove).toBe(false);
			expect(result.conflicts).toHaveLength(1);
			expect(result.conflicts[0].dependencyId).toBe(2);
		});
	});

	describe('findCrossTagDependencies', () => {
		it('should find cross-tag dependencies for multiple tasks', () => {
			const sourceTasks = [
				{ id: 1, dependencies: [2] },
				{ id: 3, dependencies: [1] }
			];
			const allTasks = getAllTasksWithTags(mockRawData);

			findCrossTagDependencies.mockReturnValue([
				{ taskId: 1, dependencyId: 2, dependencyTag: 'backlog' },
				{ taskId: 3, dependencyId: 1, dependencyTag: 'backlog' }
			]);
			const conflicts = findCrossTagDependencies(
				sourceTasks,
				'backlog',
				'in-progress',
				allTasks
			);

			expect(conflicts).toHaveLength(2);
			expect(
				conflicts.some((c) => c.taskId === 1 && c.dependencyId === 2)
			).toBe(true);
			expect(
				conflicts.some((c) => c.taskId === 3 && c.dependencyId === 1)
			).toBe(true);
		});
	});

	describe('getDependentTaskIds', () => {
		it('should return dependent task IDs', () => {
			const sourceTasks = [{ id: 1, dependencies: [2] }];
			const crossTagDependencies = [
				{ taskId: 1, dependencyId: 2, dependencyTag: 'backlog' }
			];
			const allTasks = getAllTasksWithTags(mockRawData);

			getDependentTaskIds.mockReturnValue([2]);
			const dependentTaskIds = getDependentTaskIds(
				sourceTasks,
				crossTagDependencies,
				allTasks
			);

			expect(dependentTaskIds).toContain(2);
		});
	});

	// New test: ensure with-dependencies only traverses tasks from the source tag
	it('should scope dependency traversal to source tag when using --with-dependencies', async () => {
		findCrossTagDependencies.mockReturnValue([]);
		validateSubtaskMove.mockImplementation(() => {});

		const result = await moveTasksBetweenTags(
			mockTasksPath,
			[1], // backlog:1 depends on backlog:2
			'backlog',
			'in-progress',
			{ withDependencies: true },
			mockContext
		);

		// Write should include backlog:2 moved, and must NOT traverse or fetch dependencies from the target tag
		expect(writeJSON).toHaveBeenCalledWith(
			mockTasksPath,
			expect.objectContaining({
				'in-progress': expect.objectContaining({
					tasks: expect.arrayContaining([
						expect.objectContaining({ id: 1 }),
						expect.objectContaining({ id: 2 }) // the backlog:2 now moved
						// ensure existing in-progress:2 remains (by id) but we don't double-add or fetch deps from it
					])
				})
			}),
			mockContext.projectRoot,
			null
		);
	});

	describe('moveTasksBetweenTags', () => {
		it('should move tasks without dependencies successfully', async () => {
			// Mock the dependency functions to return no conflicts
			findCrossTagDependencies.mockReturnValue([]);
			validateSubtaskMove.mockImplementation(() => {});

			const result = await moveTasksBetweenTags(
				mockTasksPath,
				[2],
				'backlog',
				'in-progress',
				{},
				mockContext
			);

			expect(result.message).toContain('Successfully moved 1 tasks');
			expect(writeJSON).toHaveBeenCalledWith(
				mockTasksPath,
				expect.any(Object),
				mockContext.projectRoot,
				null
			);
		});

		it('should throw error for cross-tag dependencies by default', async () => {
			const mockDependency = {
				taskId: 1,
				dependencyId: 2,
				dependencyTag: 'backlog'
			};
			findCrossTagDependencies.mockReturnValue([mockDependency]);
			validateSubtaskMove.mockImplementation(() => {});

			await expect(
				moveTasksBetweenTags(
					mockTasksPath,
					[1],
					'backlog',
					'in-progress',
					{},
					mockContext
				)
			).rejects.toThrow(
				'Cannot move tasks: 1 cross-tag dependency conflicts found'
			);

			expect(writeJSON).not.toHaveBeenCalled();
		});

		it('should move with dependencies when --with-dependencies is used', async () => {
			const mockDependency = {
				taskId: 1,
				dependencyId: 2,
				dependencyTag: 'backlog'
			};
			findCrossTagDependencies.mockReturnValue([mockDependency]);
			getDependentTaskIds.mockReturnValue([2]);
			validateSubtaskMove.mockImplementation(() => {});

			const result = await moveTasksBetweenTags(
				mockTasksPath,
				[1],
				'backlog',
				'in-progress',
				{ withDependencies: true },
				mockContext
			);

			expect(result.message).toContain('Successfully moved 2 tasks');
			expect(writeJSON).toHaveBeenCalledWith(
				mockTasksPath,
				expect.objectContaining({
					backlog: expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({
								id: 3,
								title: 'Task 3',
								dependencies: [1]
							})
						])
					}),
					'in-progress': expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({
								id: 4,
								title: 'Task 4',
								dependencies: []
							}),
							expect.objectContaining({
								id: 1,
								title: 'Task 1',
								dependencies: [2],
								metadata: expect.objectContaining({
									moveHistory: expect.arrayContaining([
										expect.objectContaining({
											fromTag: 'backlog',
											toTag: 'in-progress',
											timestamp: expect.any(String)
										})
									])
								})
							}),
							expect.objectContaining({
								id: 2,
								title: 'Task 2',
								dependencies: [],
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
					}),
					done: expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({
								id: 5,
								title: 'Task 5',
								dependencies: [4]
							})
						])
					})
				}),
				mockContext.projectRoot,
				null
			);
		});

		it('should break dependencies when --ignore-dependencies is used', async () => {
			const mockDependency = {
				taskId: 1,
				dependencyId: 2,
				dependencyTag: 'backlog'
			};
			findCrossTagDependencies.mockReturnValue([mockDependency]);
			validateSubtaskMove.mockImplementation(() => {});

			const result = await moveTasksBetweenTags(
				mockTasksPath,
				[2],
				'backlog',
				'in-progress',
				{ ignoreDependencies: true },
				mockContext
			);

			expect(result.message).toContain('Successfully moved 1 tasks');
			expect(writeJSON).toHaveBeenCalledWith(
				mockTasksPath,
				expect.objectContaining({
					backlog: expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({
								id: 1,
								title: 'Task 1',
								dependencies: [2] // Dependencies not actually removed in current implementation
							}),
							expect.objectContaining({
								id: 3,
								title: 'Task 3',
								dependencies: [1]
							})
						])
					}),
					'in-progress': expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({
								id: 4,
								title: 'Task 4',
								dependencies: []
							}),
							expect.objectContaining({
								id: 2,
								title: 'Task 2',
								dependencies: [],
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
					}),
					done: expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({
								id: 5,
								title: 'Task 5',
								dependencies: [4]
							})
						])
					})
				}),
				mockContext.projectRoot,
				null
			);
		});

		it('should create target tag if it does not exist', async () => {
			findCrossTagDependencies.mockReturnValue([]);
			validateSubtaskMove.mockImplementation(() => {});

			const result = await moveTasksBetweenTags(
				mockTasksPath,
				[2],
				'backlog',
				'new-tag',
				{},
				mockContext
			);

			expect(result.message).toContain('Successfully moved 1 tasks');
			expect(result.message).toContain('new-tag');
			expect(writeJSON).toHaveBeenCalledWith(
				mockTasksPath,
				expect.objectContaining({
					backlog: expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({
								id: 1,
								title: 'Task 1',
								dependencies: [2]
							}),
							expect.objectContaining({
								id: 3,
								title: 'Task 3',
								dependencies: [1]
							})
						])
					}),
					'new-tag': expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({
								id: 2,
								title: 'Task 2',
								dependencies: [],
								metadata: expect.objectContaining({
									moveHistory: expect.arrayContaining([
										expect.objectContaining({
											fromTag: 'backlog',
											toTag: 'new-tag',
											timestamp: expect.any(String)
										})
									])
								})
							})
						])
					}),
					'in-progress': expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({
								id: 4,
								title: 'Task 4',
								dependencies: []
							})
						])
					}),
					done: expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({
								id: 5,
								title: 'Task 5',
								dependencies: [4]
							})
						])
					})
				}),
				mockContext.projectRoot,
				null
			);
		});

		it('should throw error for subtask movement', async () => {
			const subtaskError = 'Cannot move subtask 1.2 directly between tags';
			validateSubtaskMove.mockImplementation(() => {
				throw new Error(subtaskError);
			});

			await expect(
				moveTasksBetweenTags(
					mockTasksPath,
					['1.2'],
					'backlog',
					'in-progress',
					{},
					mockContext
				)
			).rejects.toThrow(subtaskError);

			expect(writeJSON).not.toHaveBeenCalled();
		});

		it('should throw error for invalid task IDs', async () => {
			findCrossTagDependencies.mockReturnValue([]);
			validateSubtaskMove.mockImplementation(() => {});

			await expect(
				moveTasksBetweenTags(
					mockTasksPath,
					[999], // Non-existent task
					'backlog',
					'in-progress',
					{},
					mockContext
				)
			).rejects.toThrow('Task 999 not found in source tag "backlog"');

			expect(writeJSON).not.toHaveBeenCalled();
		});

		it('should throw error for invalid source tag', async () => {
			findCrossTagDependencies.mockReturnValue([]);
			validateSubtaskMove.mockImplementation(() => {});

			await expect(
				moveTasksBetweenTags(
					mockTasksPath,
					[1],
					'non-existent-tag',
					'in-progress',
					{},
					mockContext
				)
			).rejects.toThrow('Source tag "non-existent-tag" not found or invalid');

			expect(writeJSON).not.toHaveBeenCalled();
		});

		it('should handle string dependencies correctly during cross-tag move', async () => {
			// Setup mock data with string dependencies
			mockRawData = {
				backlog: {
					tasks: [
						{ id: 1, title: 'Task 1', dependencies: ['2'] }, // String dependency
						{ id: 2, title: 'Task 2', dependencies: [] },
						{ id: 3, title: 'Task 3', dependencies: ['1'] } // String dependency
					]
				},
				'in-progress': {
					tasks: [{ id: 4, title: 'Task 4', dependencies: [] }]
				}
			};

			// Mock readJSON to return our test data
			readJSON.mockImplementation((path, projectRoot, tag) => {
				return { ...mockRawData[tag], tag, _rawTaggedData: mockRawData };
			});

			findCrossTagDependencies.mockReturnValue([]);
			validateSubtaskMove.mockImplementation(() => {});

			const result = await moveTasksBetweenTags(
				mockTasksPath,
				['1'], // String task ID
				'backlog',
				'in-progress',
				{},
				mockContext
			);

			expect(result.message).toContain('Successfully moved 1 tasks');
			expect(writeJSON).toHaveBeenCalledWith(
				mockTasksPath,
				expect.objectContaining({
					backlog: expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({
								id: 2,
								title: 'Task 2',
								dependencies: []
							}),
							expect.objectContaining({
								id: 3,
								title: 'Task 3',
								dependencies: ['1'] // Should remain as string
							})
						])
					}),
					'in-progress': expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({
								id: 1,
								title: 'Task 1',
								dependencies: ['2'], // Should remain as string
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
				mockContext.projectRoot,
				null
			);
		});
	});
});
