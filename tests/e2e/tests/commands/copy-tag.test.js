const path = require('path');
const fs = require('fs');
const {
	setupTestEnvironment,
	cleanupTestEnvironment,
	runCommand
} = require('../../helpers/testHelpers');

describe('copy-tag command', () => {
	let testDir;
	let tasksPath;

	beforeEach(async () => {
		const setup = await setupTestEnvironment();
		testDir = setup.testDir;
		tasksPath = setup.tasksPath;

		// Create a test project with tags and tasks
		const tasksData = {
			tasks: [
				{
					id: 1,
					description: 'Task only in master',
					status: 'pending',
					tags: ['master']
				},
				{
					id: 2,
					description: 'Task in feature',
					status: 'pending',
					tags: ['feature']
				},
				{
					id: 3,
					description: 'Task in both',
					status: 'completed',
					tags: ['master', 'feature']
				},
				{
					id: 4,
					description: 'Task with subtasks',
					status: 'pending',
					tags: ['feature'],
					subtasks: [
						{
							id: '4.1',
							description: 'Subtask 1',
							status: 'pending'
						},
						{
							id: '4.2',
							description: 'Subtask 2',
							status: 'completed'
						}
					]
				}
			],
			tags: {
				master: {
					name: 'master',
					description: 'Main development branch'
				},
				feature: {
					name: 'feature',
					description: 'Feature branch for new functionality'
				}
			},
			activeTag: 'master',
			metadata: {
				nextId: 5
			}
		};
		fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2));
	});

	afterEach(async () => {
		await cleanupTestEnvironment(testDir);
	});

	test('should copy an existing tag with all its tasks', async () => {
		const result = await runCommand(
			['copy-tag', 'feature', 'feature-backup'],
			testDir
		);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain(
			'Successfully copied tag "feature" to "feature-backup"'
		);
		expect(result.stdout).toContain('3 tasks copied'); // Tasks 2, 3, and 4

		// Verify the new tag was created
		const updatedData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		expect(updatedData.tags['feature-backup']).toBeDefined();
		expect(updatedData.tags['feature-backup'].name).toBe('feature-backup');
		expect(updatedData.tags['feature-backup'].description).toBe(
			'Feature branch for new functionality'
		);

		// Verify tasks now have the new tag
		expect(updatedData.tasks[1].tags).toContain('feature-backup');
		expect(updatedData.tasks[2].tags).toContain('feature-backup');
		expect(updatedData.tasks[3].tags).toContain('feature-backup');

		// Original tag should still exist
		expect(updatedData.tags['feature']).toBeDefined();
		expect(updatedData.tasks[1].tags).toContain('feature');
	});

	test('should copy tag with custom description', async () => {
		const result = await runCommand(
			[
				'copy-tag',
				'feature',
				'feature-v2',
				'-d',
				'Version 2 of the feature branch'
			],
			testDir
		);

		expect(result.code).toBe(0);

		const updatedData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		expect(updatedData.tags['feature-v2'].description).toBe(
			'Version 2 of the feature branch'
		);
	});

	test('should fail when copying non-existent tag', async () => {
		const result = await runCommand(
			['copy-tag', 'nonexistent', 'new-tag'],
			testDir
		);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Source tag "nonexistent" does not exist');
	});

	test('should fail when target tag already exists', async () => {
		const result = await runCommand(['copy-tag', 'feature', 'master'], testDir);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Target tag "master" already exists');
	});

	test('should copy master tag successfully', async () => {
		const result = await runCommand(
			['copy-tag', 'master', 'master-backup'],
			testDir
		);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain(
			'Successfully copied tag "master" to "master-backup"'
		);
		expect(result.stdout).toContain('2 tasks copied'); // Tasks 1 and 3

		const updatedData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		expect(updatedData.tags['master-backup']).toBeDefined();
		expect(updatedData.tasks[0].tags).toContain('master-backup');
		expect(updatedData.tasks[2].tags).toContain('master-backup');
	});

	test('should handle tag with no tasks', async () => {
		// Add an empty tag
		const data = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		data.tags.empty = {
			name: 'empty',
			description: 'Empty tag with no tasks'
		};
		fs.writeFileSync(tasksPath, JSON.stringify(data, null, 2));

		const result = await runCommand(
			['copy-tag', 'empty', 'empty-copy'],
			testDir
		);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain(
			'Successfully copied tag "empty" to "empty-copy"'
		);
		expect(result.stdout).toContain('0 tasks copied');

		const updatedData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		expect(updatedData.tags['empty-copy']).toBeDefined();
	});

	test('should preserve subtasks when copying', async () => {
		const result = await runCommand(
			['copy-tag', 'feature', 'feature-with-subtasks'],
			testDir
		);

		expect(result.code).toBe(0);

		const updatedData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const taskWithSubtasks = updatedData.tasks.find((t) => t.id === 4);
		expect(taskWithSubtasks.tags).toContain('feature-with-subtasks');
		expect(taskWithSubtasks.subtasks).toHaveLength(2);
		expect(taskWithSubtasks.subtasks[0].description).toBe('Subtask 1');
		expect(taskWithSubtasks.subtasks[1].description).toBe('Subtask 2');
	});

	test('should work with custom tasks file path', async () => {
		const customTasksPath = path.join(testDir, 'custom-tasks.json');
		fs.copyFileSync(tasksPath, customTasksPath);

		const result = await runCommand(
			['copy-tag', 'feature', 'feature-copy', '-f', customTasksPath],
			testDir
		);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain(
			'Successfully copied tag "feature" to "feature-copy"'
		);

		const updatedData = JSON.parse(fs.readFileSync(customTasksPath, 'utf8'));
		expect(updatedData.tags['feature-copy']).toBeDefined();
	});

	test('should fail when tasks file does not exist', async () => {
		const nonExistentPath = path.join(testDir, 'nonexistent.json');
		const result = await runCommand(
			['copy-tag', 'feature', 'new-tag', '-f', nonExistentPath],
			testDir
		);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Tasks file not found');
	});

	test('should create tag with same name but different case', async () => {
		const result = await runCommand(
			['copy-tag', 'feature', 'FEATURE'],
			testDir
		);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain(
			'Successfully copied tag "feature" to "FEATURE"'
		);

		const updatedData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		expect(updatedData.tags['FEATURE']).toBeDefined();
		expect(updatedData.tags['feature']).toBeDefined();
	});
});