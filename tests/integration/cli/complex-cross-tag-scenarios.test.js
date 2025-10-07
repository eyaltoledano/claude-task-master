import { jest } from '@jest/globals';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Complex Cross-Tag Scenarios', () => {
	let testDir;
	let tasksPath;

	// Define binPath once for the entire test suite
	const binPath = path.join(
		__dirname,
		'..',
		'..',
		'..',
		'dist',
		'task-master.js'
	);

	beforeEach(() => {
		// Create test directory
		testDir = fs.mkdtempSync(path.join(__dirname, 'test-'));
		process.chdir(testDir);
		// Keep integration timings deterministic
		process.env.TASKMASTER_SKIP_AUTO_UPDATE = '1';

		// Initialize task-master
		execSync(`node ${binPath} init --yes`, {
			stdio: 'pipe'
		});

		// Create test tasks with complex dependencies in the correct tagged format
		const complexTasks = {
			master: {
				tasks: [
					{
						id: 1,
						title: 'Setup Project',
						description: 'Initialize the project structure',
						status: 'done',
						priority: 'high',
						dependencies: [],
						details: 'Create basic project structure',
						testStrategy: 'Verify project structure exists',
						subtasks: []
					},
					{
						id: 2,
						title: 'Database Schema',
						description: 'Design and implement database schema',
						status: 'pending',
						priority: 'high',
						dependencies: [1],
						details: 'Create database tables and relationships',
						testStrategy: 'Run database migrations',
						subtasks: [
							{
								id: '2.1',
								title: 'User Table',
								description: 'Create user table',
								status: 'pending',
								priority: 'medium',
								dependencies: [],
								details: 'Design user table schema',
								testStrategy: 'Test user creation'
							},
							{
								id: '2.2',
								title: 'Product Table',
								description: 'Create product table',
								status: 'pending',
								priority: 'medium',
								dependencies: ['2.1'],
								details: 'Design product table schema',
								testStrategy: 'Test product creation'
							}
						]
					},
					{
						id: 3,
						title: 'API Development',
						description: 'Develop REST API endpoints',
						status: 'pending',
						priority: 'high',
						dependencies: [2],
						details: 'Create API endpoints for CRUD operations',
						testStrategy: 'Test API endpoints',
						subtasks: []
					},
					{
						id: 4,
						title: 'Frontend Development',
						description: 'Develop user interface',
						status: 'pending',
						priority: 'medium',
						dependencies: [3],
						details: 'Create React components and pages',
						testStrategy: 'Test UI components',
						subtasks: []
					},
					{
						id: 5,
						title: 'Testing',
						description: 'Comprehensive testing',
						status: 'pending',
						priority: 'medium',
						dependencies: [4],
						details: 'Write unit and integration tests',
						testStrategy: 'Run test suite',
						subtasks: []
					}
				],
				metadata: {
					created: new Date().toISOString(),
					description: 'Test tasks for complex cross-tag scenarios'
				}
			}
		};

		// Write tasks to file
		tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');
		fs.writeFileSync(tasksPath, JSON.stringify(complexTasks, null, 2));
	});

	afterEach(() => {
		// Change back to project root before cleanup
		try {
			process.chdir(global.projectRoot || path.resolve(__dirname, '../../..'));
		} catch (error) {
			// If we can't change directory, try a known safe directory
			process.chdir(require('os').homedir());
		}

		// Cleanup test directory
		if (testDir && fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true });
		}
		delete process.env.TASKMASTER_SKIP_AUTO_UPDATE;
	});

	describe('Circular Dependency Detection', () => {
		it('should detect and prevent circular dependencies', () => {
			// Create a circular dependency scenario
			const circularTasks = {
				backlog: {
					tasks: [
						{
							id: 1,
							title: 'Task 1',
							status: 'pending',
							dependencies: [2],
							subtasks: []
						},
						{
							id: 2,
							title: 'Task 2',
							status: 'pending',
							dependencies: [3],
							subtasks: []
						},
						{
							id: 3,
							title: 'Task 3',
							status: 'pending',
							dependencies: [1],
							subtasks: []
						}
					],
					metadata: {
						created: new Date().toISOString(),
						description: 'Backlog tasks with circular dependencies'
					}
				},
				'in-progress': {
					tasks: [],
					metadata: {
						created: new Date().toISOString(),
						description: 'In-progress tasks'
					}
				}
			};

			fs.writeFileSync(tasksPath, JSON.stringify(circularTasks, null, 2));

			// Try to move task 1 - should fail due to circular dependency
			expect(() => {
				execSync(
					`node ${binPath} move --from=1 --from-tag=backlog --to-tag=in-progress`,
					{ stdio: 'pipe' }
				);
			}).toThrow();

			// Check that the move was not performed
			const tasksAfter = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
			expect(tasksAfter.backlog.tasks.find((t) => t.id === 1)).toBeDefined();
			expect(
				tasksAfter['in-progress'].tasks.find((t) => t.id === 1)
			).toBeUndefined();
		});
	});

	describe('Complex Dependency Chains', () => {
		it('should handle deep dependency chains correctly', () => {
			// Create a deep dependency chain
			const deepChainTasks = {
				master: {
					tasks: [
						{
							id: 1,
							title: 'Task 1',
							status: 'pending',
							dependencies: [2],
							subtasks: []
						},
						{
							id: 2,
							title: 'Task 2',
							status: 'pending',
							dependencies: [3],
							subtasks: []
						},
						{
							id: 3,
							title: 'Task 3',
							status: 'pending',
							dependencies: [4],
							subtasks: []
						},
						{
							id: 4,
							title: 'Task 4',
							status: 'pending',
							dependencies: [5],
							subtasks: []
						},
						{
							id: 5,
							title: 'Task 5',
							status: 'pending',
							dependencies: [],
							subtasks: []
						}
					],
					metadata: {
						created: new Date().toISOString(),
						description: 'Deep dependency chain tasks'
					}
				},
				'in-progress': {
					tasks: [],
					metadata: {
						created: new Date().toISOString(),
						description: 'In-progress tasks'
					}
				}
			};

			fs.writeFileSync(tasksPath, JSON.stringify(deepChainTasks, null, 2));

			// Move task 1 with dependencies - should move entire chain
			execSync(
				`node ${binPath} move --from=1 --from-tag=master --to-tag=in-progress --with-dependencies`,
				{ stdio: 'pipe' }
			);

			// Verify all tasks in the chain were moved
			const tasksAfter = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
			expect(tasksAfter.master.tasks.find((t) => t.id === 1)).toBeUndefined();
			expect(tasksAfter.master.tasks.find((t) => t.id === 2)).toBeUndefined();
			expect(tasksAfter.master.tasks.find((t) => t.id === 3)).toBeUndefined();
			expect(tasksAfter.master.tasks.find((t) => t.id === 4)).toBeUndefined();
			expect(tasksAfter.master.tasks.find((t) => t.id === 5)).toBeUndefined();

			expect(
				tasksAfter['in-progress'].tasks.find((t) => t.id === 1)
			).toBeDefined();
			expect(
				tasksAfter['in-progress'].tasks.find((t) => t.id === 2)
			).toBeDefined();
			expect(
				tasksAfter['in-progress'].tasks.find((t) => t.id === 3)
			).toBeDefined();
			expect(
				tasksAfter['in-progress'].tasks.find((t) => t.id === 4)
			).toBeDefined();
			expect(
				tasksAfter['in-progress'].tasks.find((t) => t.id === 5)
			).toBeDefined();
		});
	});

	describe('Subtask Movement Restrictions', () => {
		it('should prevent direct subtask movement between tags', () => {
			// Try to move a subtask directly
			expect(() => {
				execSync(
					`node ${binPath} move --from=2.1 --from-tag=master --to-tag=in-progress`,
					{ stdio: 'pipe' }
				);
			}).toThrow();

			// Verify subtask was not moved
			const tasksAfter = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
			const task2 = tasksAfter.master.tasks.find((t) => t.id === 2);
			expect(task2).toBeDefined();
			expect(task2.subtasks.find((s) => s.id === '2.1')).toBeDefined();
		});

		it('should allow moving parent task with all subtasks', () => {
			// Move parent task with dependencies (includes subtasks)
			execSync(
				`node ${binPath} move --from=2 --from-tag=master --to-tag=in-progress --with-dependencies`,
				{ stdio: 'pipe' }
			);

			// Verify parent and subtasks were moved
			const tasksAfter = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
			expect(tasksAfter.master.tasks.find((t) => t.id === 2)).toBeUndefined();
			const movedTask2 = tasksAfter['in-progress'].tasks.find(
				(t) => t.id === 2
			);
			expect(movedTask2).toBeDefined();
			expect(movedTask2.subtasks).toHaveLength(2);
		});
	});

	describe('Large Task Set Performance', () => {
		it('should handle large task sets efficiently', () => {
			// Create a large task set (50 tasks)
			const largeTaskSet = {
				master: {
					tasks: [],
					metadata: {
						created: new Date().toISOString(),
						description: 'Large task set for performance testing'
					}
				},
				'in-progress': {
					tasks: [],
					metadata: {
						created: new Date().toISOString(),
						description: 'In-progress tasks'
					}
				}
			};

			// Add 25 tasks to master with dependencies
			for (let i = 1; i <= 25; i++) {
				largeTaskSet.master.tasks.push({
					id: i,
					title: `Task ${i}`,
					status: 'pending',
					dependencies: i > 1 ? [i - 1] : [],
					subtasks: []
				});
			}

			// Add 25 tasks to in-progress (ensure no ID conflict with master)
			for (let i = 26; i <= 50; i++) {
				largeTaskSet['in-progress'].tasks.push({
					id: i,
					title: `Task ${i}`,
					status: 'in-progress',
					dependencies: [],
					subtasks: []
				});
			}

			fs.writeFileSync(tasksPath, JSON.stringify(largeTaskSet, null, 2));
			// Execute move; correctness is validated below (no timing assertion)
			execSync(
				`node ${binPath} move --from=25 --from-tag=master --to-tag=in-progress --with-dependencies`,
				{ stdio: 'pipe' }
			);

			// Verify the move was successful
			const tasksAfter = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));

			// Verify all tasks in the dependency chain were moved
			for (let i = 1; i <= 25; i++) {
				expect(tasksAfter.master.tasks.find((t) => t.id === i)).toBeUndefined();
				expect(
					tasksAfter['in-progress'].tasks.find((t) => t.id === i)
				).toBeDefined();
			}

			// Verify in-progress still has its original tasks (26-50)
			for (let i = 26; i <= 50; i++) {
				expect(
					tasksAfter['in-progress'].tasks.find((t) => t.id === i)
				).toBeDefined();
			}

			// Final count check
			expect(tasksAfter['in-progress'].tasks).toHaveLength(50); // 25 moved + 25 original
		});
	});

	describe('Error Recovery and Edge Cases', () => {
		it('should handle invalid task IDs gracefully', () => {
			expect(() => {
				execSync(
					`node ${binPath} move --from=999 --from-tag=master --to-tag=in-progress`,
					{ stdio: 'pipe' }
				);
			}).toThrow();
		});

		it('should handle invalid tag names gracefully', () => {
			expect(() => {
				execSync(
					`node ${binPath} move --from=1 --from-tag=invalid-tag --to-tag=in-progress`,
					{ stdio: 'pipe' }
				);
			}).toThrow();
		});

		it('should handle same source and target tags', () => {
			expect(() => {
				execSync(
					`node ${binPath} move --from=1 --from-tag=master --to-tag=master`,
					{ stdio: 'pipe' }
				);
			}).toThrow();
		});

		it('should create target tag if it does not exist', () => {
			execSync(
				`node ${binPath} move --from=1 --from-tag=master --to-tag=new-tag`,
				{ stdio: 'pipe' }
			);

			const tasksAfter = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
			expect(tasksAfter['new-tag']).toBeDefined();
			expect(tasksAfter['new-tag'].tasks.find((t) => t.id === 1)).toBeDefined();
		});
	});

	describe('Multiple Task Movement', () => {
		it('should move multiple tasks simultaneously', () => {
			// Create tasks for multiple movement test
			const multiTaskSet = {
				master: {
					tasks: [
						{
							id: 1,
							title: 'Task 1',
							status: 'pending',
							dependencies: [],
							subtasks: []
						},
						{
							id: 2,
							title: 'Task 2',
							status: 'pending',
							dependencies: [],
							subtasks: []
						},
						{
							id: 3,
							title: 'Task 3',
							status: 'pending',
							dependencies: [],
							subtasks: []
						}
					],
					metadata: {
						created: new Date().toISOString(),
						description: 'Tasks for multiple movement test'
					}
				},
				'in-progress': {
					tasks: [],
					metadata: {
						created: new Date().toISOString(),
						description: 'In-progress tasks'
					}
				}
			};

			fs.writeFileSync(tasksPath, JSON.stringify(multiTaskSet, null, 2));

			// Move multiple tasks
			execSync(
				`node ${binPath} move --from=1,2,3 --from-tag=master --to-tag=in-progress`,
				{ stdio: 'pipe' }
			);

			// Verify all tasks were moved
			const tasksAfter = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
			expect(tasksAfter.master.tasks.find((t) => t.id === 1)).toBeUndefined();
			expect(tasksAfter.master.tasks.find((t) => t.id === 2)).toBeUndefined();
			expect(tasksAfter.master.tasks.find((t) => t.id === 3)).toBeUndefined();

			expect(
				tasksAfter['in-progress'].tasks.find((t) => t.id === 1)
			).toBeDefined();
			expect(
				tasksAfter['in-progress'].tasks.find((t) => t.id === 2)
			).toBeDefined();
			expect(
				tasksAfter['in-progress'].tasks.find((t) => t.id === 3)
			).toBeDefined();
		});
	});
});
