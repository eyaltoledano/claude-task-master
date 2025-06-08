import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { log, findProjectRoot } from './utils.js';
import { getProjectName } from './config-manager.js';
import listTasks from './task-manager/list-tasks.js';

/**
 * Creates a basic README structure if one doesn't exist
 * @param {string} projectName - Name of the project
 * @returns {string} - Basic README content
 */
function createBasicReadme(projectName) {
	return `# ${projectName}

This project is managed using Task Master.

`;
}

/**
 * Create UTM tracking URL for task-master.dev
 * @param {string} projectRoot - The project root path
 * @returns {string} - UTM tracked URL
 */
function createTaskMasterUrl(projectRoot) {
	// Get the actual folder name from the project root path
	const folderName = path.basename(projectRoot);

	// Clean folder name for UTM (replace spaces/special chars with hyphens)
	const cleanFolderName = folderName
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');

	const utmParams = new URLSearchParams({
		utm_source: 'github-readme',
		utm_medium: 'readme-export',
		utm_campaign: cleanFolderName || 'task-sync',
		utm_content: 'task-export-link'
	});

	return `https://task-master.dev?${utmParams.toString()}`;
}

/**
 * Create the start marker with metadata
 * @param {Object} options - Export options
 * @returns {string} - Formatted start marker
 */
function createStartMarker(options) {
	const { timestamp, withSubtasks, status, projectRoot } = options;

	// Format status filter text
	const statusText = status
		? `Status filter: ${status}`
		: 'Status filter: none';
	const subtasksText = withSubtasks ? 'with subtasks' : 'without subtasks';

	// Create the export info content
	const exportInfo =
		`🎯 **Taskmaster Export** - ${timestamp}\n` +
		`📋 Export: ${subtasksText} • ${statusText}\n` +
		`🔗 Powered by [Task Master](${createTaskMasterUrl(projectRoot)})`;

	// Create a markdown box using code blocks and emojis to mimic our UI style
	const boxContent =
		`<!-- TASKMASTER_EXPORT_START -->\n` +
		`> ${exportInfo.split('\n').join('\n> ')}\n\n`;

	return boxContent;
}

/**
 * Create the end marker
 * @returns {string} - Formatted end marker
 */
function createEndMarker() {
	return (
		`\n> 📋 **End of Taskmaster Export** - Tasks are synced from your project using the \`sync-readme\` command.\n` +
		`<!-- TASKMASTER_EXPORT_END -->\n`
	);
}

/**
 * Syncs the current task list to README.md at the project root
 * @param {string} projectRoot - Path to the project root directory
 * @param {Object} options - Options for syncing
 * @param {boolean} options.withSubtasks - Include subtasks in the output (default: false)
 * @param {string} options.status - Filter by status (e.g., 'pending', 'done')
 * @param {string} options.tasksPath - Custom path to tasks.json
 * @returns {boolean} - True if sync was successful, false otherwise
 */
export async function syncTasksToReadme(projectRoot = null, options = {}) {
	try {
		const actualProjectRoot = projectRoot || findProjectRoot() || '.';
		const { withSubtasks = false, status, tasksPath } = options;

		// Get current tasks using the list-tasks functionality with markdown-readme format
		const tasksOutput = await listTasks(
			tasksPath ||
				path.join(actualProjectRoot, '.taskmaster', 'tasks', 'tasks.json'),
			status,
			null,
			withSubtasks,
			'markdown-readme'
		);

		if (!tasksOutput) {
			console.log(chalk.red('❌ Failed to generate task output'));
			return false;
		}

		// Generate timestamp and metadata
		const timestamp =
			new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
		const projectName = getProjectName(actualProjectRoot);

		// Create the export markers with metadata
		const startMarker = createStartMarker({
			timestamp,
			withSubtasks,
			status,
			projectRoot: actualProjectRoot
		});

		const endMarker = createEndMarker();

		// Create the complete task section
		const taskSection = startMarker + tasksOutput + endMarker;

		// Read current README content
		const readmePath = path.join(actualProjectRoot, 'README.md');
		let readmeContent = '';
		try {
			readmeContent = fs.readFileSync(readmePath, 'utf8');
		} catch (err) {
			if (err.code === 'ENOENT') {
				// Create basic README if it doesn't exist
				readmeContent = createBasicReadme(projectName);
			} else {
				throw err;
			}
		}

		// Check if export markers exist and replace content between them
		const startComment = '<!-- TASKMASTER_EXPORT_START -->';
		const endComment = '<!-- TASKMASTER_EXPORT_END -->';

		let updatedContent;
		const startIndex = readmeContent.indexOf(startComment);
		const endIndex = readmeContent.indexOf(endComment);

		if (startIndex !== -1 && endIndex !== -1) {
			// Replace existing task section
			const beforeTasks = readmeContent.substring(0, startIndex);
			const afterTasks = readmeContent.substring(endIndex + endComment.length);
			updatedContent = beforeTasks + taskSection + afterTasks;
		} else {
			// Append to end of README
			updatedContent = readmeContent + '\n' + taskSection;
		}

		// Write updated content to README
		fs.writeFileSync(readmePath, updatedContent, 'utf8');

		console.log(chalk.green('✅ Successfully synced tasks to README.md'));
		console.log(
			chalk.cyan(
				`📋 Export details: ${withSubtasks ? 'with' : 'without'} subtasks${status ? `, status: ${status}` : ''}`
			)
		);
		console.log(chalk.gray(`📍 Location: ${readmePath}`));

		return true;
	} catch (error) {
		console.log(chalk.red('❌ Failed to sync tasks to README:'), error.message);
		log('error', `README sync error: ${error.message}`);
		return false;
	}
}

export default syncTasksToReadme;
