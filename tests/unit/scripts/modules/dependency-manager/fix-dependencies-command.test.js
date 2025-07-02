/**
 * Unit test to ensure fixDependenciesCommand writes JSON with the correct
 * projectRoot and tag arguments so that tag data is preserved.
 */

import { jest } from '@jest/globals';

// Mock process.exit to prevent test termination
const mockProcessExit = jest.fn();
const originalExit = process.exit;
process.exit = mockProcessExit;

// Mock utils.js BEFORE importing the module under test
jest.unstable_mockModule('../../../../../scripts/modules/utils.js', () => ({
	readJSON: jest.fn(),
	writeJSON: jest.fn(),
	log: jest.fn(),
	findProjectRoot: jest.fn(() => '/mock/project/root'),
	getCurrentTag: jest.fn(() => 'master'),
	taskExists: jest.fn(() => true),
	formatTaskId: jest.fn((id) => id),
	findCycles: jest.fn(() => []),
	isSilentMode: jest.fn(() => true),
	resolveTag: jest.fn(() => 'master'),
	getTasksForTag: jest.fn(() => []),
	setTasksForTag: jest.fn(),
	enableSilentMode: jest.fn(),
	disableSilentMode: jest.fn()
}));

// Mock ui.js
jest.unstable_mockModule('../../../../../scripts/modules/ui.js', () => ({
	displayBanner: jest.fn()
}));

// Mock task-manager.js
jest.unstable_mockModule(
	'../../../../../scripts/modules/task-manager.js',
	() => ({
		generateTaskFiles: jest.fn()
	})
);

// Mock external libraries
jest.unstable_mockModule('chalk', () => ({
	default: {
		green: jest.fn((text) => text),
		cyan: jest.fn((text) => text),
		bold: jest.fn((text) => text)
	}
}));

jest.unstable_mockModule('boxen', () => ({
	default: jest.fn((text) => text)
}));

// Import the mocked modules
const { readJSON, writeJSON, log, taskExists } = await import(
	'../../../../../scripts/modules/utils.js'
);

// Import the module under test
const { fixDependenciesCommand } = await import(
	'../../../../../scripts/modules/dependency-manager.js'
);

describe('fixDependenciesCommand tag preservation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockProcessExit.mockClear();
	});

	afterAll(() => {
		// Restore original process.exit
		process.exit = originalExit;
	});

	it('calls writeJSON with projectRoot and tag parameters when changes are made', async () => {
		const tasksPath = '/mock/tasks.json';
		const projectRoot = '/mock/project/root';
		const tag = 'master';

		// Mock data WITH dependency issues to trigger writeJSON
		const tasksDataWithIssues = {
			tasks: [
				{
					id: 1,
					title: 'Task 1',
					dependencies: [999] // Non-existent dependency to trigger fix
				},
				{
					id: 2,
					title: 'Task 2',
					dependencies: []
				}
			],
			tag: 'master',
			_rawTaggedData: {
				master: {
					tasks: [
						{
							id: 1,
							title: 'Task 1',
							dependencies: [999]
						}
					]
				}
			}
		};

		readJSON.mockReturnValue(tasksDataWithIssues);
		taskExists.mockReturnValue(false); // Make dependency invalid to trigger fix

		await fixDependenciesCommand(tasksPath, {
			context: { projectRoot, tag }
		});

		// Verify readJSON was called with correct parameters
		expect(readJSON).toHaveBeenCalledWith(tasksPath, projectRoot, tag);

		// Verify writeJSON was called (should be triggered by removing invalid dependency)
		expect(writeJSON).toHaveBeenCalled();

		// Check the writeJSON call parameters
		const writeJSONCalls = writeJSON.mock.calls;
		const lastWriteCall = writeJSONCalls[writeJSONCalls.length - 1];
		const [calledPath, _data, calledProjectRoot, calledTag] = lastWriteCall;

		expect(calledPath).toBe(tasksPath);
		expect(calledProjectRoot).toBe(projectRoot);
		expect(calledTag).toBe(tag);

		// Verify process.exit was NOT called (meaning the function succeeded)
		expect(mockProcessExit).not.toHaveBeenCalled();
	});

	it('does not call writeJSON when no changes are needed', async () => {
		const tasksPath = '/mock/tasks.json';
		const projectRoot = '/mock/project/root';
		const tag = 'master';

		// Mock data WITHOUT dependency issues (no changes needed)
		const cleanTasksData = {
			tasks: [
				{
					id: 1,
					title: 'Task 1',
					dependencies: [] // Clean, no issues
				}
			],
			tag: 'master'
		};

		readJSON.mockReturnValue(cleanTasksData);
		taskExists.mockReturnValue(true); // All dependencies exist

		await fixDependenciesCommand(tasksPath, {
			context: { projectRoot, tag }
		});

		// Verify readJSON was called
		expect(readJSON).toHaveBeenCalledWith(tasksPath, projectRoot, tag);

		// Verify writeJSON was NOT called (no changes needed)
		expect(writeJSON).not.toHaveBeenCalled();

		// Verify process.exit was NOT called
		expect(mockProcessExit).not.toHaveBeenCalled();
	});

	it('handles early exit when no valid tasks found', async () => {
		const tasksPath = '/mock/tasks.json';

		// Mock invalid data to trigger early exit
		readJSON.mockReturnValue(null);

		await fixDependenciesCommand(tasksPath, {
			context: { projectRoot: '/mock', tag: 'master' }
		});

		// Verify readJSON was called
		expect(readJSON).toHaveBeenCalled();

		// Verify writeJSON was NOT called (early exit)
		expect(writeJSON).not.toHaveBeenCalled();

		// Verify process.exit WAS called due to invalid data
		expect(mockProcessExit).toHaveBeenCalledWith(1);
	});
});
