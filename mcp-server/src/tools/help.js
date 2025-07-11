/**
 * help.js
 * MCP tool for displaying help information about Task Master tools
 */

import { z } from 'zod';
import { createContentResponse } from './utils.js';
import logger from '../logger.js';

/**
 * Register the help tool
 * @param {Object} server - FastMCP server instance
 */
export function registerHelpTool(server) {
	server.addTool({
		name: 'help',
		description: 'Display help information about Task Master MCP tools and commands',
		parameters: z.object({
			command: z.string().optional().describe('Specific command to get help for (optional)')
		}),
		execute: async (args, { log }) => {
			try {
				const { command } = args;
				
				log.info(`Displaying help information${command ? ` for command: ${command}` : ''}`);

				if (command) {
					// Show specific command help
					const specificHelp = getSpecificCommandHelp(command);
					if (specificHelp) {
						return createContentResponse(specificHelp);
					} else {
						return createContentResponse(`❌ No help available for command: ${command}\n\nUse 'help' without arguments to see all available commands.`);
					}
				} else {
					// Show general help
					const generalHelp = getGeneralHelp();
					return createContentResponse(generalHelp);
				}

			} catch (error) {
				const errorMsg = `Error displaying help: ${error.message}`;
				log.error(errorMsg, { stack: error.stack });
				return createContentResponse(`❌ Error displaying help: ${error.message}`);
			}
		}
	});
}

/**
 * Get general help information
 * @returns {string} - Formatted help text
 */
function getGeneralHelp() {
	return `# 🎯 Task Master MCP Tools Help

## 📋 Available Commands

### 🚀 Project Setup & Initialization
- **initialize_project** - Initialize a new Task Master project
- **models** - View and configure AI model settings
- **rules** - Manage project rules and profiles

### 📝 Task Generation & Parsing
- **parse_prd** - Parse PRD documents and generate tasks
- **generate** - Generate individual task files from tasks.json

### 📊 Task Management
- **get_tasks** - List all tasks with filtering options
- **get_task** - Show detailed information about a specific task
- **add_task** - Create a new task
- **update_task** - Update an existing task
- **remove_task** - Delete a task
- **move_task** - Move a task to a different position

### 🔄 Task Status & Workflow
- **set_task_status** - Change a task's status
- **next_task** - Get the next recommended task to work on

### 🌳 Subtask Management
- **add_subtask** - Add a subtask to an existing task
- **update_subtask** - Update an existing subtask
- **remove_subtask** - Remove a subtask
- **clear_subtasks** - Remove all subtasks from a task

### 🔍 Task Analysis & Expansion
- **analyze** - Analyze project complexity and structure
- **expand_task** - Break down a task into subtasks
- **expand_all** - Expand all eligible tasks automatically
- **complexity_report** - Generate detailed complexity analysis

### 🔗 Dependency Management
- **add_dependency** - Add a dependency between tasks
- **remove_dependency** - Remove a task dependency
- **validate_dependencies** - Check for dependency issues
- **fix_dependencies** - Automatically fix dependency problems

### 🏷️ Tag Management
- **list_tags** - List all available tags
- **add_tag** - Create a new tag
- **delete_tag** - Remove a tag
- **use_tag** - Switch to a different tag context
- **rename_tag** - Rename an existing tag
- **copy_tag** - Copy tasks from one tag to another

### 🔬 Research & Analysis
- **research** - Perform AI-powered research on tasks or topics

### 📄 Export & Documentation
- **sync_readme** - Sync tasks to README.md file
- **get_operation_status** - Check the status of background operations

### ❓ Help & Information
- **help** - Display this help information

## 💡 Usage Tips

1. **Start with initialization**: Use \`initialize_project\` to set up a new project
2. **Parse requirements**: Use \`parse_prd\` to generate tasks from documents
3. **Daily workflow**: Use \`next_task\` to see what to work on next
4. **Task breakdown**: Use \`expand_task\` for complex tasks that need subtasks
5. **Stay organized**: Use tags to organize tasks by feature or sprint

## 🔧 Common Workflows

### New Project Setup
1. \`initialize_project\`
2. \`models\` (configure AI providers)
3. \`parse_prd\` (generate initial tasks)

### Daily Development
1. \`next_task\` (see what to work on)
2. \`set_task_status\` (update progress)
3. \`expand_task\` (break down complex tasks)

### Project Management
1. \`get_tasks\` (review all tasks)
2. \`complexity_report\` (analyze project)
3. \`sync_readme\` (update documentation)

For specific command help, use: \`help <command_name>\`
`;
}

/**
 * Get help for a specific command
 * @param {string} command - Command name
 * @returns {string|null} - Formatted help text or null if not found
 */
function getSpecificCommandHelp(command) {
	const commandHelp = {
		'initialize_project': `# initialize_project

Initialize a new Task Master project in the current directory.

**Parameters:**
- \`projectName\` (optional): Name for the project
- \`description\` (optional): Project description

**Example:**
\`\`\`
initialize_project({
  "projectName": "My Web App",
  "description": "A modern web application"
})
\`\`\``,

		'parse_prd': `# parse_prd

Parse a PRD (Product Requirements Document) and generate tasks.

**Parameters:**
- \`prdContent\`: Content of the PRD document
- \`numTasks\` (optional): Maximum number of tasks to generate
- \`useResearch\` (optional): Use research AI for enhanced parsing

**Example:**
\`\`\`
parse_prd({
  "prdContent": "Build a user authentication system...",
  "numTasks": 10,
  "useResearch": true
})
\`\`\``,

		'get_tasks': `# get_tasks

List all tasks with optional filtering.

**Parameters:**
- \`status\` (optional): Filter by status (pending, done, in-progress, etc.)
- \`withSubtasks\` (optional): Include subtasks in the output
- \`tag\` (optional): Filter by tag

**Example:**
\`\`\`
get_tasks({
  "status": "pending",
  "withSubtasks": true
})
\`\`\``,

		'sync_readme': `# sync_readme

Sync the current task list to README.md file with professional formatting.

**Parameters:**
- \`withSubtasks\` (optional): Include subtasks in the output
- \`status\` (optional): Filter tasks by status
- \`tasksPath\` (optional): Custom path to tasks.json

**Example:**
\`\`\`
sync_readme({
  "withSubtasks": true,
  "status": "pending"
})
\`\`\``
	};

	return commandHelp[command] || null;
}

export default { registerHelpTool };
