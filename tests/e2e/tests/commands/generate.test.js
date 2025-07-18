import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
describe('task-master generate command', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-generate-command-'));

		// Initialize test helpers
		const context = global.createTestContext('generate command');
		helpers = context.helpers;

		// Copy .env file if it exists
		const mainEnvPath = join(process.cwd(), '.env');
		const testEnvPath = join(testDir, '.env');
		if (existsSync(mainEnvPath)) {
			const envContent = readFileSync(mainEnvPath, 'utf8');
			writeFileSync(testEnvPath, envContent);
		}

		// Initialize task-master project
		const initResult = await helpers.taskMaster('init', ['-y'], {
			cwd: testDir
		});
		expect(initResult).toHaveExitCode(0);

		// Ensure tasks.json exists (bug workaround)
		const tasksJsonPath = join(testDir, '.taskmaster/tasks/tasks.json');
		if (!existsSync(tasksJsonPath)) {
			mkdirSync(join(testDir, '.taskmaster/tasks'), { recursive: true });
			writeFileSync(tasksJsonPath, JSON.stringify({ master: { tasks: [] } }));
		}
	});

	afterEach(() => {
		// Clean up test directory
		if (testDir && existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	it('should generate task files from tasks.json', async () => {
		// Create a test tasks.json file
		const outputDir = join(testDir, 'generated-tasks');
		
		// Create test tasks
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						title: 'Implement user authentication',
						description: 'Set up authentication system',
						details: 'Implementation details for auth system',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						testStrategy: 'Unit and integration tests',
						subtasks: [
							{
								id: 1,
								title: 'Set up JWT tokens',
								description: 'Implement JWT token handling',
								details: 'Create JWT token generation and validation',
								status: 'pending',
								dependencies: []
							}
						]
					},
					{
						id: 2,
						title: 'Create database schema',
						description: 'Design and implement database schema',
						details: 'Create tables and relationships',
						status: 'in_progress',
						priority: 'medium',
						dependencies: [],
						testStrategy: 'Database migration tests',
						subtasks: []
					}
				],
				metadata: {
					created: new Date().toISOString(),
					updated: new Date().toISOString(),
					description: 'Tasks for master context'
				}
			}
		};

		// Write test tasks to tasks.json
		const tasksJsonPath = join(testDir, '.taskmaster/tasks/tasks.json');
		writeFileSync(tasksJsonPath, JSON.stringify(testTasks, null, 2));

		// Run generate command
		const result = await helpers.taskMaster('generate', ['-o', outputDir], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('SUCCESS');

		// Check that output directory was created
		expect(existsSync(outputDir)).toBe(true);

		// Check that task files were generated
		const generatedFiles = readdirSync(outputDir);
		expect(generatedFiles).toContain('task_001.txt');
		expect(generatedFiles).toContain('task_002.txt');

		// Verify content of generated files
		const task1Content = readFileSync(join(outputDir, 'task_001.txt'), 'utf8');
		expect(task1Content).toContain('Implement user authentication');
		expect(task1Content).toContain('Set up JWT tokens');
		expect(task1Content).toContain('pending');
		expect(task1Content).toContain('high');

		const task2Content = readFileSync(join(outputDir, 'task_002.txt'), 'utf8');
		expect(task2Content).toContain('Create database schema');
		expect(task2Content).toContain('in_progress');
		expect(task2Content).toContain('medium');
	});

	it('should use default output directory when not specified', async () => {
		// Create a test tasks.json file
		const defaultOutputDir = join(testDir, '.taskmaster');
		
		// Create test tasks
		const testTasks = {
			master: {
				tasks: [
					{
						id: 3,
						title: 'Simple task',
						description: 'A simple task for testing',
						details: 'Implementation details',
						status: 'pending',
						priority: 'low',
						dependencies: [],
						testStrategy: 'Basic testing',
						subtasks: []
					}
				],
				metadata: {
					created: new Date().toISOString(),
					updated: new Date().toISOString(),
					description: 'Tasks for master context'
				}
			}
		};

		// Write test tasks to tasks.json
		const tasksJsonPath = join(testDir, '.taskmaster/tasks/tasks.json');
		writeFileSync(tasksJsonPath, JSON.stringify(testTasks, null, 2));

		// Run generate command without output directory
		const result = await helpers.taskMaster('generate', [], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Output directory:');
		expect(result.stdout).toContain('.taskmaster');

		// Check that task file was generated in default location
		// The files are generated in a subdirectory, so let's check if the expected structure exists
		const expectedDir = existsSync(join(defaultOutputDir, 'task_files')) ? 
			join(defaultOutputDir, 'task_files') : 
			existsSync(join(defaultOutputDir, 'tasks')) ? 
				join(defaultOutputDir, 'tasks') : 
				defaultOutputDir;
		
		if (existsSync(expectedDir) && expectedDir !== defaultOutputDir) {
			const generatedFiles = readdirSync(expectedDir);
			expect(generatedFiles).toContain('task_003.txt');
		} else {
			// Check if the file exists anywhere in the default directory tree
			const searchForFile = (dir, fileName) => {
				const items = readdirSync(dir, { withFileTypes: true });
				for (const item of items) {
					if (item.isDirectory()) {
						const fullPath = join(dir, item.name);
						if (searchForFile(fullPath, fileName)) return true;
					} else if (item.name === fileName) {
						return true;
					}
				}
				return false;
			};
			expect(searchForFile(defaultOutputDir, 'task_003.txt')).toBe(true);
		}
	});

	it('should handle tag option correctly', async () => {
		// Create a test tasks.json file with multiple tags
		const outputDir = join(testDir, 'generated-tags');
		
		// Create test tasks with different tags
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						title: 'Master tag task',
						description: 'A task for the master tag',
						details: 'Implementation details',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						testStrategy: 'Master testing',
						subtasks: []
					}
				],
				metadata: {
					created: new Date().toISOString(),
					updated: new Date().toISOString(),
					description: 'Tasks for master context'
				}
			},
			feature: {
				tasks: [
					{
						id: 1,
						title: 'Feature tag task',
						description: 'A task for the feature tag',
						details: 'Feature implementation details',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						testStrategy: 'Feature testing',
						subtasks: []
					}
				],
				metadata: {
					created: new Date().toISOString(),
					updated: new Date().toISOString(),
					description: 'Tasks for feature context'
				}
			}
		};

		// Write test tasks to tasks.json
		const tasksJsonPath = join(testDir, '.taskmaster/tasks/tasks.json');
		writeFileSync(tasksJsonPath, JSON.stringify(testTasks, null, 2));

		// Run generate command with tag option
		const result = await helpers.taskMaster('generate', ['-o', outputDir, '--tag', 'feature'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('SUCCESS');

		// Check that only feature tag task was generated
		const generatedFiles = readdirSync(outputDir);
		expect(generatedFiles).toHaveLength(1);
		expect(generatedFiles).toContain('task_001_feature.txt');

		// Verify it's the feature tag task
		const taskContent = readFileSync(join(outputDir, 'task_001_feature.txt'), 'utf8');
		expect(taskContent).toContain('Feature tag task');
		expect(taskContent).not.toContain('Master tag task');
	});

	it('should handle missing tasks file gracefully', async () => {
		const nonExistentPath = join(testDir, 'non-existent-tasks.json');
		
		// Run generate command with non-existent file
		const result = await helpers.taskMaster('generate', ['-f', nonExistentPath], { cwd: testDir });

		// Should fail with appropriate error
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr).toContain('Error');
	});
});