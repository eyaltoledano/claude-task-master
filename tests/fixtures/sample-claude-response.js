/**
 * Sample Claude API response for testing
 */

export const sampleClaudeResponse = {
	tasks: [
		{
			id: 1,
			title: 'Setup Task Data Structure',
			description: 'Implement the core task data structure and file operations',
			status: 'pending',
			dependencies: [],
			priority: 'high',
			details:
				'Create the tasks.json file structure with support for task properties including ID, title, description, status, dependencies, priority, details, and test strategy. Implement file system operations for reading and writing task data.',
			testStrategy:
				'Verify tasks.json is created with the correct structure and that task data can be read from and written to the file.'
		},
		{
			id: 2,
			title: 'Implement CLI Foundation',
			description:
				'Create the command-line interface foundation with basic commands',
			status: 'pending',
			dependencies: [1],
			priority: 'high',
			details:
				'Set up Commander.js for handling CLI commands. Implement the basic command structure including help documentation. Create the foundational command parsing logic.',
			testStrategy:
				'Test each command to ensure it properly parses arguments and options. Verify help documentation is displayed correctly.'
		},
		{
			id: 3,
			title: 'Develop Task Management Operations',
			description:
				'Implement core operations for creating, reading, updating, and deleting tasks',
			status: 'pending',
			dependencies: [1],
			priority: 'medium',
			details:
				'Implement functions for listing tasks, adding new tasks, updating task status, and removing tasks. Include support for filtering tasks by status and other properties.',
			testStrategy:
				'Create unit tests for each CRUD operation to verify they correctly modify the task data.'
		}
	],
	metadata: {
		projectName: 'Task Management CLI',
		totalTasks: 3,
		sourceFile: 'tests/fixtures/sample-prd.txt',
		generatedAt: '2023-12-15'
	}
};
