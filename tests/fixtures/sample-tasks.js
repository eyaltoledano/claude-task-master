/**
 * Sample task data for testing
 */

export const sampleTasks = {
	meta: {
		projectName: 'Test Project',
		projectVersion: '1.0.0',
		createdAt: '2023-01-01T00:00:00.000Z',
		updatedAt: '2023-01-01T00:00:00.000Z'
	},
	tasks: [
		{
			id: 1,
			title: 'Initialize Project',
			description: 'Set up the project structure and dependencies',
			status: 'done',
			dependencies: [],
			priority: 'high',
			details:
				'Create directory structure, initialize package.json, and install dependencies',
			testStrategy: 'Verify all directories and files are created correctly'
		},
		{
			id: 2,
			title: 'Create Core Functionality',
			description: 'Implement the main features of the application',
			status: 'in-progress',
			dependencies: [1],
			priority: 'high',
			details:
				'Implement user authentication, data processing, and API endpoints',
			testStrategy: 'Write unit tests for all core functions',
			subtasks: [
				{
					id: 1,
					title: 'Implement Authentication',
					description: 'Create user authentication system',
					status: 'done',
					dependencies: []
				},
				{
					id: 2,
					title: 'Set Up Database',
					description: 'Configure database connection and models',
					status: 'pending',
					dependencies: [1]
				}
			]
		},
		{
			id: 3,
			title: 'Implement UI Components',
			description: 'Create the user interface components',
			status: 'pending',
			dependencies: [2],
			priority: 'medium',
			details: 'Design and implement React components for the user interface',
			testStrategy: 'Test components with React Testing Library',
			subtasks: [
				{
					id: 1,
					title: 'Create Header Component',
					description: 'Implement the header component',
					status: 'pending',
					dependencies: [],
					details: 'Create a responsive header with navigation links'
				},
				{
					id: 2,
					title: 'Create Footer Component',
					description: 'Implement the footer component',
					status: 'pending',
					dependencies: [],
					details: 'Create a footer with copyright information and links'
				}
			]
		}
	]
};

export const emptySampleTasks = {
	meta: {
		projectName: 'Empty Project',
		projectVersion: '1.0.0',
		createdAt: '2023-01-01T00:00:00.000Z',
		updatedAt: '2023-01-01T00:00:00.000Z'
	},
	tasks: []
};

export const crossLevelDependencyTasks = {
	tasks: [
		{
			id: 2,
			title: 'Task 2 with subtasks',
			description: 'Parent task',
			status: 'pending',
			dependencies: [],
			subtasks: [
				{
					id: 1,
					title: 'Subtask 2.1',
					description: 'First subtask',
					status: 'pending',
					dependencies: []
				},
				{
					id: 2,
					title: 'Subtask 2.2',
					description: 'Second subtask that should depend on Task 11',
					status: 'pending',
					dependencies: []
				}
			]
		},
		{
			id: 11,
			title: 'Task 11',
			description: 'Top-level task that 2.2 should depend on',
			status: 'done',
			dependencies: []
		}
	]
};

// ============================================================================
// Tagged Format Fixtures (for tag-aware system tests)
// ============================================================================

/**
 * Single task in master tag - minimal fixture
 * Use: Basic happy path tests
 */
export const taggedOneTask = {
	tag: 'master',
	tasks: [
		{
			id: 1,
			title: 'Task 1',
			description: 'First task',
			status: 'pending',
			dependencies: [],
			priority: 'medium'
		}
	]
};

/**
 * Task with subtasks in master tag
 * Use: Testing subtask operations (expand, update-subtask)
 */
export const taggedTaskWithSubtasks = {
	tag: 'master',
	tasks: [
		{
			id: 1,
			title: 'Parent Task',
			description: 'Task with subtasks',
			status: 'in-progress',
			dependencies: [],
			priority: 'high',
			subtasks: [
				{
					id: 1,
					title: 'Subtask 1.1',
					description: 'First subtask',
					status: 'done',
					dependencies: []
				},
				{
					id: 2,
					title: 'Subtask 1.2',
					description: 'Second subtask',
					status: 'pending',
					dependencies: [1]
				}
			]
		}
	]
};

/**
 * Multiple tasks with dependencies in master tag
 * Use: Testing dependency operations, task ordering
 */
export const taggedTasksWithDependencies = {
	tag: 'master',
	tasks: [
		{
			id: 1,
			title: 'Setup',
			description: 'Initial setup task',
			status: 'done',
			dependencies: [],
			priority: 'high'
		},
		{
			id: 2,
			title: 'Core Feature',
			description: 'Main feature implementation',
			status: 'in-progress',
			dependencies: [1],
			priority: 'high'
		},
		{
			id: 3,
			title: 'Polish',
			description: 'Final touches',
			status: 'pending',
			dependencies: [2],
			priority: 'low'
		}
	]
};

/**
 * Empty tag - no tasks
 * Use: Testing edge cases, "add first task" scenarios
 */
export const taggedEmptyTasks = {
	tag: 'master',
	tasks: []
};

/**
 * Helper function to create custom tagged fixture
 * @param {string} tagName - Tag name (default: 'master')
 * @param {Array} tasks - Array of task objects
 * @returns {Object} Tagged task data
 *
 * @example
 * const customData = createTaggedFixture('feature-branch', [
 *   { id: 1, title: 'Custom Task', status: 'pending', dependencies: [] }
 * ]);
 */
export function createTaggedFixture(tagName = 'master', tasks = []) {
	return {
		tag: tagName,
		tasks
	};
}
