import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { setupTestEnvironment, cleanupTestEnvironment, runCommand } from '../../utils/test-helpers.js';
import path from 'path';
import fs from 'fs';

describe('generate command', () => {
	let testDir;

	beforeAll(() => {
		testDir = setupTestEnvironment('generate-command');
	});

	afterAll(() => {
		cleanupTestEnvironment(testDir);
	});

	it('should generate task files from tasks.json', async () => {
		// Create a test tasks.json file
		const tasksPath = path.join(testDir, '.taskmaster', 'tasks-master.json');
		const outputDir = path.join(testDir, 'generated-tasks');
		
		// Create test tasks
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Implement user authentication',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: [
							{
								id: 1.1,
								description: 'Set up JWT tokens',
								status: 'pending',
								priority: 'high'
							}
						]
					},
					{
						id: 2,
						description: 'Create database schema',
						status: 'in_progress',
						priority: 'medium',
						dependencies: [],
						subtasks: []
					}
				]
			}
		};

		// Ensure .taskmaster directory exists
		fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
		fs.writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));

		// Run generate command
		const result = await runCommand(
			'generate',
			['-f', tasksPath, '-o', outputDir],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Generating task files from:');
		expect(result.stdout).toContain('Output directory:');
		expect(result.stdout).toContain('Generated task files successfully');

		// Check that output directory was created
		expect(fs.existsSync(outputDir)).toBe(true);

		// Check that task files were generated
		const generatedFiles = fs.readdirSync(outputDir);
		expect(generatedFiles).toContain('task-001.md');
		expect(generatedFiles).toContain('task-002.md');

		// Verify content of generated files
		const task1Content = fs.readFileSync(path.join(outputDir, 'task-001.md'), 'utf8');
		expect(task1Content).toContain('# Task 1: Implement user authentication');
		expect(task1Content).toContain('Set up JWT tokens');
		expect(task1Content).toContain('Status: pending');
		expect(task1Content).toContain('Priority: high');

		const task2Content = fs.readFileSync(path.join(outputDir, 'task-002.md'), 'utf8');
		expect(task2Content).toContain('# Task 2: Create database schema');
		expect(task2Content).toContain('Status: in_progress');
		expect(task2Content).toContain('Priority: medium');
	});

	it('should use default output directory when not specified', async () => {
		// Create a test tasks.json file
		const tasksPath = path.join(testDir, '.taskmaster', 'tasks-default.json');
		const defaultOutputDir = path.join(testDir, '.taskmaster');
		
		// Create test tasks
		const testTasks = {
			master: {
				tasks: [
					{
						id: 3,
						description: 'Simple task',
						status: 'pending',
						priority: 'low',
						dependencies: [],
						subtasks: []
					}
				]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));

		// Run generate command without output directory
		const result = await runCommand(
			'generate',
			['-f', tasksPath],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Output directory:');
		expect(result.stdout).toContain('.taskmaster');

		// Check that task file was generated in default location
		const generatedFiles = fs.readdirSync(defaultOutputDir);
		expect(generatedFiles).toContain('task-003.md');
	});

	it('should handle tag option correctly', async () => {
		// Create a test tasks.json file with multiple tags
		const tasksPath = path.join(testDir, '.taskmaster', 'tasks-tags.json');
		const outputDir = path.join(testDir, 'generated-tags');
		
		// Create test tasks with different tags
		const testTasks = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Master tag task',
						status: 'pending',
						priority: 'high',
						dependencies: [],
						subtasks: []
					}
				]
			},
			feature: {
				tasks: [
					{
						id: 1,
						description: 'Feature tag task',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						subtasks: []
					}
				]
			}
		};

		fs.writeFileSync(tasksPath, JSON.stringify(testTasks, null, 2));

		// Run generate command with tag option
		const result = await runCommand(
			'generate',
			['-f', tasksPath, '-o', outputDir, '--tag', 'feature'],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Generated task files successfully');

		// Check that only feature tag task was generated
		const generatedFiles = fs.readdirSync(outputDir);
		expect(generatedFiles).toHaveLength(1);
		expect(generatedFiles).toContain('task-001.md');

		// Verify it's the feature tag task
		const taskContent = fs.readFileSync(path.join(outputDir, 'task-001.md'), 'utf8');
		expect(taskContent).toContain('Feature tag task');
		expect(taskContent).not.toContain('Master tag task');
	});

	it('should handle missing tasks file gracefully', async () => {
		const nonExistentPath = path.join(testDir, 'non-existent-tasks.json');
		
		// Run generate command with non-existent file
		const result = await runCommand(
			'generate',
			['-f', nonExistentPath],
			testDir
		);

		// Should fail with appropriate error
		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Error');
	});
});