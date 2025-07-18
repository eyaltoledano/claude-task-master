import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('use-tag command', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-use-tag-'));

		// Initialize test helpers
		const context = global.createTestContext('use-tag');
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

		// Create tasks file path
		const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');

		// Create a test project with multiple tags
		const tasksData = {
			master: {
				tasks: [
					{
						id: 1,
						description: 'Task in master',
						status: 'pending',
						tags: ['master']
					},
					{
						id: 3,
						description: 'Task in both',
						status: 'pending',
						tags: ['master', 'feature']
					}
				]
			},
			feature: {
				tasks: [
					{
						id: 2,
						description: 'Task in feature',
						status: 'pending',
						tags: ['feature']
					},
					{
						id: 3,
						description: 'Task in both',
						status: 'pending',
						tags: ['master', 'feature']
					}
				]
			},
			release: {
				tasks: []
			},
			metadata: {
				nextId: 4,
				activeTag: 'master'
			}
		};
		writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2));
	});

	afterEach(async () => {
		// Clean up test directory
		if (testDir && existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	it('should switch to an existing tag', async () => {
		const result = await helpers.taskMaster('use-tag', ['feature'], {
			cwd: testDir
		});

		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Successfully switched to tag "feature"');

		// Verify the active tag was updated in state.json
		const statePath = join(testDir, '.taskmaster/state.json');
		const stateData = JSON.parse(readFileSync(statePath, 'utf8'));
		expect(stateData.currentTag).toBe('feature');
	});

	it('should show error when switching to non-existent tag', async () => {
		const result = await helpers.taskMaster('use-tag', ['nonexistent'], {
			cwd: testDir
		});

		expect(result).toHaveExitCode(1);
		expect(result.stderr).toContain('Tag "nonexistent" does not exist');
	});

	it('should switch from feature tag back to master', async () => {
		// First switch to feature
		await helpers.taskMaster('use-tag', ['feature'], { cwd: testDir });

		// Then switch back to master
		const result = await helpers.taskMaster('use-tag', ['master'], {
			cwd: testDir
		});

		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Successfully switched to tag "master"');

		// Verify the active tag was updated in state.json
		const statePath = join(testDir, '.taskmaster/state.json');
		const stateData = JSON.parse(readFileSync(statePath, 'utf8'));
		expect(stateData.currentTag).toBe('master');
	});

	it('should handle switching to the same tag gracefully', async () => {
		const result = await helpers.taskMaster('use-tag', ['master'], {
			cwd: testDir
		});

		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Successfully switched to tag "master"');
	});

	it('should work with custom tasks file path', async () => {
		const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
		const customTasksPath = join(testDir, 'custom-tasks.json');
		const content = readFileSync(tasksPath, 'utf8');
		writeFileSync(customTasksPath, content);

		const result = await helpers.taskMaster(
			'use-tag',
			['feature', '-f', customTasksPath],
			{ cwd: testDir }
		);

		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Successfully switched to tag "feature"');

		// Verify the active tag was updated in state.json
		const statePath = join(testDir, '.taskmaster/state.json');
		const stateData = JSON.parse(readFileSync(statePath, 'utf8'));
		expect(stateData.currentTag).toBe('feature');
	});

	it('should fail when tasks file does not exist', async () => {
		const nonExistentPath = join(testDir, 'nonexistent.json');
		const result = await helpers.taskMaster(
			'use-tag',
			['feature', '-f', nonExistentPath],
			{ cwd: testDir }
		);

		expect(result).toHaveExitCode(1);
		expect(result.stderr).toContain('does not exist');
	});
});