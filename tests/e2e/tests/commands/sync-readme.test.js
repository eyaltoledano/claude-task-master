/**
 * Comprehensive E2E tests for sync-readme command
 * Tests README.md synchronization with task list
 */

const {
	mkdtempSync,
	existsSync,
	readFileSync,
	rmSync,
	writeFileSync,
	mkdirSync
} = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');
const path = require('path');

describe('sync-readme command', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-sync-readme-'));

		// Initialize test helpers
		const context = global.createTestContext('sync-readme');
		helpers = context.helpers;

		// Copy .env file if it exists
		const mainEnvPath = join(__dirname, '../../../../.env');
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

	describe('Creating README.md', () => {
		it('should create README.md when it does not exist', async () => {
			// Add a test task
			await helpers.taskMaster(
				'add-task',
				['--title', 'Test task', '--description', 'Task for README sync'],
				{ cwd: testDir }
			);

			// Run sync-readme
			const result = await helpers.taskMaster('sync-readme', [], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Successfully synced tasks to README.md');

			// Verify README.md was created
			const readmePath = join(testDir, 'README.md');
			expect(existsSync(readmePath)).toBe(true);

			// Verify content
			const readmeContent = readFileSync(readmePath, 'utf8');
			expect(readmeContent).toContain('Test task');
			expect(readmeContent).toContain('<!-- TASKMASTER_EXPORT_START -->');
			expect(readmeContent).toContain('<!-- TASKMASTER_EXPORT_END -->');
			expect(readmeContent).toContain('Taskmaster Export');
			expect(readmeContent).toContain('Powered by [Task Master]');
		});

		it('should create basic README structure with project name', async () => {
			// Run sync-readme without any tasks
			const result = await helpers.taskMaster('sync-readme', [], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);

			const readmePath = join(testDir, 'README.md');
			const readmeContent = readFileSync(readmePath, 'utf8');

			// Should contain project name from directory
			const projectName = path.basename(testDir);
			expect(readmeContent).toContain(`# ${projectName}`);
			expect(readmeContent).toContain('This project is managed using Task Master');
		});
	});

	describe('Updating existing README.md', () => {
		beforeEach(() => {
			// Create an existing README with custom content
			const readmePath = join(testDir, 'README.md');
			writeFileSync(
				readmePath,
				`# My Project

This is my awesome project.

## Features
- Feature 1
- Feature 2

## Installation
Run npm install

`
			);
		});

		it('should preserve existing README content', async () => {
			// Add a task
			await helpers.taskMaster(
				'add-task',
				['--title', 'New feature', '--description', 'Implement feature 3'],
				{ cwd: testDir }
			);

			// Run sync-readme
			const result = await helpers.taskMaster('sync-readme', [], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);

			const readmePath = join(testDir, 'README.md');
			const readmeContent = readFileSync(readmePath, 'utf8');

			// Original content should be preserved
			expect(readmeContent).toContain('# My Project');
			expect(readmeContent).toContain('This is my awesome project');
			expect(readmeContent).toContain('## Features');
			expect(readmeContent).toContain('- Feature 1');
			expect(readmeContent).toContain('## Installation');

			// Task list should be appended
			expect(readmeContent).toContain('New feature');
			expect(readmeContent).toContain('<!-- TASKMASTER_EXPORT_START -->');
			expect(readmeContent).toContain('<!-- TASKMASTER_EXPORT_END -->');
		});

		it('should replace existing task section between markers', async () => {
			// Add initial task section to README
			const readmePath = join(testDir, 'README.md');
			let content = readFileSync(readmePath, 'utf8');
			content += `
<!-- TASKMASTER_EXPORT_START -->
Old task content that should be replaced
<!-- TASKMASTER_EXPORT_END -->
`;
			writeFileSync(readmePath, content);

			// Add new tasks
			await helpers.taskMaster(
				'add-task',
				['--title', 'Task 1', '--description', 'First task'],
				{ cwd: testDir }
			);
			await helpers.taskMaster(
				'add-task',
				['--title', 'Task 2', '--description', 'Second task'],
				{ cwd: testDir }
			);

			// Run sync-readme
			const result = await helpers.taskMaster('sync-readme', [], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);

			const updatedContent = readFileSync(readmePath, 'utf8');

			// Old content should be replaced
			expect(updatedContent).not.toContain('Old task content that should be replaced');

			// New tasks should be present
			expect(updatedContent).toContain('Task 1');
			expect(updatedContent).toContain('Task 2');

			// Original content before markers should be preserved
			expect(updatedContent).toContain('# My Project');
			expect(updatedContent).toContain('This is my awesome project');
		});
	});

	describe('Task list formatting', () => {
		beforeEach(async () => {
			// Create tasks with different properties
			const task1 = await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'High priority task',
					'--description',
					'Urgent task',
					'--priority',
					'high'
				],
				{ cwd: testDir }
			);
			const taskId1 = helpers.extractTaskId(task1.stdout);

			const task2 = await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'In progress task',
					'--description',
					'Working on it',
					'--priority',
					'medium'
				],
				{ cwd: testDir }
			);
			const taskId2 = helpers.extractTaskId(task2.stdout);
			await helpers.taskMaster(
				'set-status',
				['--id', taskId2, '--status', 'in-progress'],
				{ cwd: testDir }
			);

			const task3 = await helpers.taskMaster(
				'add-task',
				['--title', 'Completed task', '--description', 'All done'],
				{ cwd: testDir }
			);
			const taskId3 = helpers.extractTaskId(task3.stdout);
			await helpers.taskMaster(
				'set-status',
				['--id', taskId3, '--status', 'done'],
				{ cwd: testDir }
			);
		});

		it('should format tasks in markdown table', async () => {
			const result = await helpers.taskMaster('sync-readme', [], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);

			const readmePath = join(testDir, 'README.md');
			const readmeContent = readFileSync(readmePath, 'utf8');

			// Should contain markdown table headers
			expect(readmeContent).toContain('| ID |');
			expect(readmeContent).toContain('| Title |');
			expect(readmeContent).toContain('| Status |');
			expect(readmeContent).toContain('| Priority |');

			// Should contain task data
			expect(readmeContent).toContain('High priority task');
			expect(readmeContent).toContain('high');
			expect(readmeContent).toContain('In progress task');
			expect(readmeContent).toContain('in-progress');
			expect(readmeContent).toContain('Completed task');
			expect(readmeContent).toContain('done');
		});

		it('should include metadata in export header', async () => {
			const result = await helpers.taskMaster('sync-readme', [], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);

			const readmePath = join(testDir, 'README.md');
			const readmeContent = readFileSync(readmePath, 'utf8');

			// Should contain export metadata
			expect(readmeContent).toContain('Taskmaster Export');
			expect(readmeContent).toContain('without subtasks');
			expect(readmeContent).toContain('Status filter: none');
			expect(readmeContent).toContain('Powered by [Task Master](https://task-master.dev');

			// Should contain timestamp
			expect(readmeContent).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC/);
		});
	});

	describe('Subtasks support', () => {
		let parentTaskId;

		beforeEach(async () => {
			// Create parent task
			const parentResult = await helpers.taskMaster(
				'add-task',
				['--title', 'Main task', '--description', 'Has subtasks'],
				{ cwd: testDir }
			);
			parentTaskId = helpers.extractTaskId(parentResult.stdout);

			// Add subtasks
			await helpers.taskMaster(
				'add-subtask',
				[
					'--parent',
					parentTaskId,
					'--title',
					'Subtask 1',
					'--description',
					'First subtask'
				],
				{ cwd: testDir }
			);
			await helpers.taskMaster(
				'add-subtask',
				[
					'--parent',
					parentTaskId,
					'--title',
					'Subtask 2',
					'--description',
					'Second subtask'
				],
				{ cwd: testDir }
			);
		});

		it('should not include subtasks by default', async () => {
			const result = await helpers.taskMaster('sync-readme', [], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);

			const readmePath = join(testDir, 'README.md');
			const readmeContent = readFileSync(readmePath, 'utf8');

			// Should contain parent task
			expect(readmeContent).toContain('Main task');

			// Should not contain subtasks
			expect(readmeContent).not.toContain('Subtask 1');
			expect(readmeContent).not.toContain('Subtask 2');

			// Metadata should indicate no subtasks
			expect(readmeContent).toContain('without subtasks');
		});

		it('should include subtasks with --with-subtasks flag', async () => {
			const result = await helpers.taskMaster('sync-readme', ['--with-subtasks'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);

			const readmePath = join(testDir, 'README.md');
			const readmeContent = readFileSync(readmePath, 'utf8');

			// Should contain parent and subtasks
			expect(readmeContent).toContain('Main task');
			expect(readmeContent).toContain('Subtask 1');
			expect(readmeContent).toContain('Subtask 2');

			// Should show subtask IDs
			expect(readmeContent).toContain(`${parentTaskId}.1`);
			expect(readmeContent).toContain(`${parentTaskId}.2`);

			// Metadata should indicate subtasks included
			expect(readmeContent).toContain('with subtasks');
		});
	});

	describe('Status filtering', () => {
		beforeEach(async () => {
			// Create tasks with different statuses
			await helpers.taskMaster(
				'add-task',
				['--title', 'Pending task', '--description', 'Not started'],
				{ cwd: testDir }
			);

			const task2 = await helpers.taskMaster(
				'add-task',
				['--title', 'Active task', '--description', 'In progress'],
				{ cwd: testDir }
			);
			const taskId2 = helpers.extractTaskId(task2.stdout);
			await helpers.taskMaster(
				'set-status',
				['--id', taskId2, '--status', 'in-progress'],
				{ cwd: testDir }
			);

			const task3 = await helpers.taskMaster(
				'add-task',
				['--title', 'Done task', '--description', 'Completed'],
				{ cwd: testDir }
			);
			const taskId3 = helpers.extractTaskId(task3.stdout);
			await helpers.taskMaster(
				'set-status',
				['--id', taskId3, '--status', 'done'],
				{ cwd: testDir }
			);
		});

		it('should filter by pending status', async () => {
			const result = await helpers.taskMaster(
				'sync-readme',
				['--status', 'pending'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('status: pending');

			const readmePath = join(testDir, 'README.md');
			const readmeContent = readFileSync(readmePath, 'utf8');

			// Should only contain pending task
			expect(readmeContent).toContain('Pending task');
			expect(readmeContent).not.toContain('Active task');
			expect(readmeContent).not.toContain('Done task');

			// Metadata should indicate status filter
			expect(readmeContent).toContain('Status filter: pending');
		});

		it('should filter by done status', async () => {
			const result = await helpers.taskMaster(
				'sync-readme',
				['--status', 'done'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			const readmePath = join(testDir, 'README.md');
			const readmeContent = readFileSync(readmePath, 'utf8');

			// Should only contain done task
			expect(readmeContent).toContain('Done task');
			expect(readmeContent).not.toContain('Pending task');
			expect(readmeContent).not.toContain('Active task');

			// Metadata should indicate status filter
			expect(readmeContent).toContain('Status filter: done');
		});
	});

	describe('Tag support', () => {
		beforeEach(async () => {
			// Create tasks in master tag
			await helpers.taskMaster(
				'add-task',
				['--title', 'Master task', '--description', 'In master tag'],
				{ cwd: testDir }
			);

			// Create new tag and add tasks
			await helpers.taskMaster(
				'add-tag',
				['feature-branch', '--description', 'Feature work'],
				{ cwd: testDir }
			);
			await helpers.taskMaster('use-tag', ['feature-branch'], { cwd: testDir });
			await helpers.taskMaster(
				'add-task',
				[
					'--title',
					'Feature task',
					'--description',
					'In feature tag',
					'--tag',
					'feature-branch'
				],
				{ cwd: testDir }
			);
		});

		it('should sync tasks from current active tag', async () => {
			// Ensure we're on feature-branch tag
			await helpers.taskMaster('use-tag', ['feature-branch'], { cwd: testDir });

			const result = await helpers.taskMaster('sync-readme', [], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);

			const readmePath = join(testDir, 'README.md');
			const readmeContent = readFileSync(readmePath, 'utf8');

			// Should contain feature task from active tag
			expect(readmeContent).toContain('Feature task');
			expect(readmeContent).not.toContain('Master task');
		});

		it('should sync master tag tasks when on master', async () => {
			// Switch back to master tag
			await helpers.taskMaster('use-tag', ['master'], { cwd: testDir });

			const result = await helpers.taskMaster('sync-readme', [], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);

			const readmePath = join(testDir, 'README.md');
			const readmeContent = readFileSync(readmePath, 'utf8');

			// Should contain master task
			expect(readmeContent).toContain('Master task');
			expect(readmeContent).not.toContain('Feature task');
		});
	});

	describe('Error handling', () => {
		it('should handle missing tasks file gracefully', async () => {
			// Remove tasks file
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			if (existsSync(tasksPath)) {
				rmSync(tasksPath);
			}

			const result = await helpers.taskMaster('sync-readme', [], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Failed to sync tasks to README');
		});

		it('should handle invalid tasks file', async () => {
			// Create invalid tasks file
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			writeFileSync(tasksPath, '{ invalid json }');

			const result = await helpers.taskMaster('sync-readme', [], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
		});

		it('should handle read-only README file', async () => {
			// Skip this test on Windows as chmod doesn't work the same way
			if (process.platform === 'win32') {
				return;
			}

			// Create read-only README
			const readmePath = join(testDir, 'README.md');
			writeFileSync(readmePath, '# Read Only');
			
			// Make file read-only
			const fs = require('fs');
			fs.chmodSync(readmePath, 0o444);

			const result = await helpers.taskMaster('sync-readme', [], {
				cwd: testDir,
				allowFailure: true
			});

			// Restore write permissions for cleanup
			fs.chmodSync(readmePath, 0o644);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Failed to sync tasks to README');
		});
	});

	describe('File path handling', () => {
		it('should use custom tasks file path', async () => {
			// Create custom tasks file
			const customPath = join(testDir, 'custom-tasks.json');
			writeFileSync(
				customPath,
				JSON.stringify({
					master: {
						tasks: [
							{
								id: 1,
								title: 'Custom file task',
								description: 'From custom file',
								status: 'pending',
								priority: 'medium',
								dependencies: []
							}
						]
					}
				})
			);

			const result = await helpers.taskMaster(
				'sync-readme',
				['--file', customPath],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			const readmePath = join(testDir, 'README.md');
			const readmeContent = readFileSync(readmePath, 'utf8');

			expect(readmeContent).toContain('Custom file task');
			expect(readmeContent).toContain('From custom file');
		});
	});

	describe('Multiple sync operations', () => {
		it('should handle multiple sync operations correctly', async () => {
			// First sync
			await helpers.taskMaster(
				'add-task',
				['--title', 'Initial task', '--description', 'First sync'],
				{ cwd: testDir }
			);
			await helpers.taskMaster('sync-readme', [], { cwd: testDir });

			// Add more tasks
			await helpers.taskMaster(
				'add-task',
				['--title', 'Second task', '--description', 'Second sync'],
				{ cwd: testDir }
			);

			// Second sync
			const result = await helpers.taskMaster('sync-readme', [], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);

			const readmePath = join(testDir, 'README.md');
			const readmeContent = readFileSync(readmePath, 'utf8');

			// Should contain both tasks
			expect(readmeContent).toContain('Initial task');
			expect(readmeContent).toContain('Second task');

			// Should only have one set of markers
			const startMatches = (readmeContent.match(/<!-- TASKMASTER_EXPORT_START -->/g) || []).length;
			const endMatches = (readmeContent.match(/<!-- TASKMASTER_EXPORT_END -->/g) || []).length;
			expect(startMatches).toBe(1);
			expect(endMatches).toBe(1);
		});
	});

	describe('UTM tracking', () => {
		it('should include proper UTM parameters in Task Master link', async () => {
			await helpers.taskMaster(
				'add-task',
				['--title', 'Test task', '--description', 'For UTM test'],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster('sync-readme', [], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);

			const readmePath = join(testDir, 'README.md');
			const readmeContent = readFileSync(readmePath, 'utf8');

			// Should contain Task Master link with UTM parameters
			expect(readmeContent).toContain('https://task-master.dev?');
			expect(readmeContent).toContain('utm_source=github-readme');
			expect(readmeContent).toContain('utm_medium=readme-export');
			expect(readmeContent).toContain('utm_campaign=');
			expect(readmeContent).toContain('utm_content=task-export-link');

			// UTM campaign should be based on folder name
			const folderName = path.basename(testDir);
			const cleanFolderName = folderName
				.toLowerCase()
				.replace(/[^a-z0-9]/g, '-')
				.replace(/-+/g, '-')
				.replace(/^-|-$/g, '');
			expect(readmeContent).toContain(`utm_campaign=${cleanFolderName}`);
		});
	});

	describe('Output formatting', () => {
		it('should show export details in console output', async () => {
			await helpers.taskMaster(
				'add-task',
				['--title', 'Test task', '--description', 'For output test'],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster(
				'sync-readme',
				['--with-subtasks', '--status', 'pending'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Syncing tasks to README.md');
			expect(result.stdout).toContain('(with subtasks)');
			expect(result.stdout).toContain('(status: pending)');
			expect(result.stdout).toContain('Successfully synced tasks to README.md');
			expect(result.stdout).toContain('Export details: with subtasks, status: pending');
			expect(result.stdout).toContain('Location:');
			expect(result.stdout).toContain('README.md');
		});

		it('should show proper output without filters', async () => {
			await helpers.taskMaster(
				'add-task',
				['--title', 'Test task', '--description', 'No filters'],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster('sync-readme', [], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Syncing tasks to README.md');
			expect(result.stdout).not.toContain('(with subtasks)');
			expect(result.stdout).not.toContain('(status:');
			expect(result.stdout).toContain('Export details: without subtasks');
		});
	});
});