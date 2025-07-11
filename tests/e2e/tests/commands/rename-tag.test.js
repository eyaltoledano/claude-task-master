const path = require('path');
const fs = require('fs');
const {
	setupTestEnvironment,
	cleanupTestEnvironment,
	runCommand
} = require('../../helpers/testHelpers');

describe('rename-tag command', () => {
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
					description: 'Task in feature',
					status: 'pending',
					tags: ['feature']
				},
				{
					id: 2,
					description: 'Task in both',
					status: 'pending',
					tags: ['master', 'feature']
				},
				{
					id: 3,
					description: 'Task in development',
					status: 'pending',
					tags: ['development']
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
				},
				development: {
					name: 'development',
					description: 'Development branch'
				}
			},
			activeTag: 'feature',
			metadata: {
				nextId: 4
			}
		};
		fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2));
	});

	afterEach(async () => {
		await cleanupTestEnvironment(testDir);
	});

	test('should rename an existing tag', async () => {
		const result = await runCommand(
			['rename-tag', 'feature', 'feature-v2'],
			testDir
		);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain(
			'Successfully renamed tag "feature" to "feature-v2"'
		);

		// Verify the tag was renamed
		const updatedData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		expect(updatedData.tags['feature-v2']).toBeDefined();
		expect(updatedData.tags['feature-v2'].name).toBe('feature-v2');
		expect(updatedData.tags['feature-v2'].description).toBe(
			'Feature branch for new functionality'
		);
		expect(updatedData.tags['feature']).toBeUndefined();

		// Verify tasks were updated
		expect(updatedData.tasks[0].tags).toContain('feature-v2');
		expect(updatedData.tasks[0].tags).not.toContain('feature');
		expect(updatedData.tasks[1].tags).toContain('feature-v2');
		expect(updatedData.tasks[1].tags).not.toContain('feature');

		// Verify active tag was updated since it was 'feature'
		expect(updatedData.activeTag).toBe('feature-v2');
	});

	test('should fail when renaming non-existent tag', async () => {
		const result = await runCommand(
			['rename-tag', 'nonexistent', 'new-name'],
			testDir
		);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Tag "nonexistent" does not exist');
	});

	test('should fail when new tag name already exists', async () => {
		const result = await runCommand(
			['rename-tag', 'feature', 'master'],
			testDir
		);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Tag "master" already exists');
	});

	test('should not rename master tag', async () => {
		const result = await runCommand(
			['rename-tag', 'master', 'main'],
			testDir
		);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Cannot rename the "master" tag');
	});

	test('should handle tag with no tasks', async () => {
		// Add a tag with no tasks
		const data = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		data.tags.empty = {
			name: 'empty',
			description: 'Empty tag'
		};
		fs.writeFileSync(tasksPath, JSON.stringify(data, null, 2));

		const result = await runCommand(
			['rename-tag', 'empty', 'not-empty'],
			testDir
		);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain(
			'Successfully renamed tag "empty" to "not-empty"'
		);

		const updatedData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		expect(updatedData.tags['not-empty']).toBeDefined();
		expect(updatedData.tags['empty']).toBeUndefined();
	});

	test('should work with custom tasks file path', async () => {
		const customTasksPath = path.join(testDir, 'custom-tasks.json');
		fs.copyFileSync(tasksPath, customTasksPath);

		const result = await runCommand(
			['rename-tag', 'feature', 'feature-renamed', '-f', customTasksPath],
			testDir
		);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain(
			'Successfully renamed tag "feature" to "feature-renamed"'
		);

		const updatedData = JSON.parse(fs.readFileSync(customTasksPath, 'utf8'));
		expect(updatedData.tags['feature-renamed']).toBeDefined();
		expect(updatedData.tags['feature']).toBeUndefined();
	});

	test('should update activeTag when renaming a tag that is not active', async () => {
		// Change active tag to development
		const data = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		data.activeTag = 'development';
		fs.writeFileSync(tasksPath, JSON.stringify(data, null, 2));

		const result = await runCommand(
			['rename-tag', 'feature', 'feature-new'],
			testDir
		);

		expect(result.code).toBe(0);

		const updatedData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		// Active tag should remain unchanged
		expect(updatedData.activeTag).toBe('development');
	});

	test('should fail when tasks file does not exist', async () => {
		const nonExistentPath = path.join(testDir, 'nonexistent.json');
		const result = await runCommand(
			['rename-tag', 'feature', 'new-name', '-f', nonExistentPath],
			testDir
		);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Tasks file not found');
	});
});