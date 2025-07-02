/**
 * Common setup for task-manager module tests
 */
import { jest } from '@jest/globals';

// Sample test data
export const sampleTasks = {
	meta: { projectName: 'Test Project' },
	tasks: [
		{
			id: 1,
			title: 'Task 1',
			description: 'First task description',
			status: 'pending',
			dependencies: [],
			priority: 'high',
			details: 'Detailed information for task 1',
			testStrategy: 'Test strategy for task 1'
		},
		{
			id: 2,
			title: 'Task 2',
			description: 'Second task description',
			status: 'pending',
			dependencies: [1],
			priority: 'medium',
			details: 'Detailed information for task 2',
			testStrategy: 'Test strategy for task 2'
		},
		{
			id: 3,
			title: 'Task with Subtasks',
			description: 'Task with subtasks description',
			status: 'pending',
			dependencies: [1, 2],
			priority: 'high',
			details: 'Detailed information for task 3',
			testStrategy: 'Test strategy for task 3',
			subtasks: [
				{
					id: 1,
					title: 'Subtask 1',
					description: 'First subtask',
					status: 'pending',
					dependencies: [],
					details: 'Details for subtask 1'
				},
				{
					id: 2,
					title: 'Subtask 2',
					description: 'Second subtask',
					status: 'pending',
					dependencies: [1],
					details: 'Details for subtask 2'
				}
			]
		}
	]
};

export const emptySampleTasks = {
	meta: { projectName: 'Empty Project' },
	tasks: []
};

export const sampleClaudeResponse = {
	tasks: [
		{
			id: 1,
			title: 'Setup Project',
			description: 'Initialize the project structure',
			status: 'pending',
			dependencies: [],
			priority: 'high',
			details:
				'Create repository, configure build system, and setup dev environment',
			testStrategy: 'Verify project builds and tests run'
		},
		{
			id: 2,
			title: 'Implement Core Feature',
			description: 'Create the main functionality',
			status: 'pending',
			dependencies: [1],
			priority: 'high',
			details: 'Implement the core business logic for the application',
			testStrategy:
				'Unit tests for core functions, integration tests for workflows'
		}
	]
};

// Common mock setup function
export const setupCommonMocks = () => {
	// Clear mocks before setup
	jest.clearAllMocks();

	// Mock implementations
	const mocks = {
		readFileSync: jest.fn(),
		existsSync: jest.fn(),
		mkdirSync: jest.fn(),
		writeFileSync: jest.fn(),
		readJSON: jest.fn(),
		writeJSON: jest.fn(),
		log: jest.fn(),
		isTaskDependentOn: jest.fn().mockReturnValue(false),
		formatDependenciesWithStatus: jest.fn(),
		displayTaskList: jest.fn(),
		validateAndFixDependencies: jest.fn(),
		generateObjectService: jest.fn().mockResolvedValue({
			mainResult: { tasks: [] },
			telemetryData: {}
		})
	};

	return mocks;
};

// Helper to create a deep copy of objects to avoid test pollution
export const cloneData = (data) => JSON.parse(JSON.stringify(data));

/**
 * Shared mock implementation for getTagAwareFilePath that matches the actual implementation
 * This ensures consistent behavior across all test files, particularly regarding projectRoot handling.
 *
 * The key difference from previous inconsistent implementations was that some tests were not
 * properly handling the projectRoot parameter, leading to different behaviors between test files.
 *
 * @param {string} basePath - The base file path
 * @param {string|null} tag - The tag name (null, undefined, or 'master' uses base path)
 * @param {string} [projectRoot='.'] - The project root directory
 * @returns {string} The resolved file path
 */
export const createGetTagAwareFilePathMock = () => {
	return jest.fn((basePath, tag, projectRoot = '.') => {
		// Handle projectRoot consistently - this was the key fix
		const fullPath = projectRoot ? `${projectRoot}/${basePath}` : basePath;

		if (!tag || tag === 'master') {
			return fullPath;
		}

		// Mock the slugification behavior (matches actual implementation)
		const slugifiedTag = tag.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
		const idx = fullPath.lastIndexOf('.');
		return `${fullPath.slice(0, idx)}_${slugifiedTag}${fullPath.slice(idx)}`;
	});
};

/**
 * Shared mock implementation for slugifyTagForFilePath that matches the actual implementation
 * @param {string} tagName - The tag name to slugify
 * @returns {string} Slugified tag name safe for filesystem use
 */
export const createSlugifyTagForFilePathMock = () => {
	return jest.fn((tagName) => {
		if (!tagName || typeof tagName !== 'string') {
			return 'unknown-tag';
		}
		return tagName.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
	});
};
