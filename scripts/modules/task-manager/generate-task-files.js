import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

import { log, readJSON } from '../utils.js';
import { formatDependenciesWithStatus } from '../ui.js';
import { validateAndFixDependencies } from '../dependency-manager.js';
import { getDebugFlag } from '../config-manager.js';

/**
 * Generate individual task files from tasks.json
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} outputDir - Output directory for task files
 * @param {Object} options - Additional options (mcpLog for MCP mode)
 * @returns {Object|undefined} Result object in MCP mode, undefined in CLI mode
 */
function generateTaskFiles(tasksPath, outputDir, options = {}) {
	try {
		// Determine if we're in MCP mode by checking for mcpLog
		const isMcpMode = !!options?.mcpLog;

		log('info', `Preparing to regenerate task files in ${tasksPath}`);

		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(`No valid tasks found in ${tasksPath}`);
		}

		// Create the output directory if it doesn't exist
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		log('info', `Found ${data.tasks.length} tasks to regenerate`);

		// Validate and fix dependencies before generating files
		log('info', `Validating and fixing dependencies`);
		validateAndFixDependencies(data, tasksPath);

		// Generate task files
		log('info', 'Generating individual task files...');
		data.tasks.forEach((task) => {
			const taskPath = path.join(
				outputDir,
				`task_${task.id.toString().padStart(3, '0')}.txt`
			);

			// Format the content
			let content = `# Task ID: ${task.id}\n`;
			content += `# Title: ${task.title}\n`;
			content += `# Status: ${task.status || 'pending'}\n`;

			// Format dependencies with their status
			if (task.dependencies && task.dependencies.length > 0) {
				content += `# Dependencies: ${formatDependenciesWithStatus(task.dependencies, data.tasks, false)}\n`;
			} else {
				content += '# Dependencies: None\n';
			}

			content += `# Priority: ${task.priority || 'medium'}\n`;
			content += `# Description: ${task.description || ''}\n`;

			// Add more detailed sections
			content += '# Details:\n';
			content += (task.details || '')
				.split('\n')
				.map((line) => line)
				.join('\n');
			content += '\n\n';

			content += '# Test Strategy:\n';
			content += (task.testStrategy || '')
				.split('\n')
				.map((line) => line)
				.join('\n');
			content += '\n';

			// Add subtasks if they exist
			if (task.subtasks && task.subtasks.length > 0) {
				content += '\n# Subtasks:\n';

				task.subtasks.forEach((subtask) => {
					content += `## ${subtask.id}. ${subtask.title} [${subtask.status || 'pending'}]\n`;

					if (subtask.dependencies && subtask.dependencies.length > 0) {
						// Format subtask dependencies
						let subtaskDeps = subtask.dependencies
							.map((depId) => {
								if (typeof depId === 'number') {
									// Handle numeric dependencies to other subtasks
									const foundSubtask = task.subtasks.find(
										(st) => st.id === depId
									);
									if (foundSubtask) {
										// Just return the plain ID format without any color formatting
										return `${task.id}.${depId}`;
									}
								}
								return depId.toString();
							})
							.join(', ');

						content += `### Dependencies: ${subtaskDeps}\n`;
					} else {
						content += '### Dependencies: None\n';
					}

					content += `### Description: ${subtask.description || ''}\n`;
					content += '### Details:\n';
					content += (subtask.details || '')
						.split('\n')
						.map((line) => line)
						.join('\n');
					content += '\n\n';
				});
			}

			// Write the file
			fs.writeFileSync(taskPath, content);
			// log('info', `Generated: task_${task.id.toString().padStart(3, '0')}.txt`); // Pollutes the CLI output
		});

		log(
			'success',
			`All ${data.tasks.length} tasks have been generated into '${outputDir}'.`
		);

		// Return success data in MCP mode
		if (isMcpMode) {
			return {
				success: true,
				count: data.tasks.length,
				directory: outputDir
			};
		}
	} catch (error) {
		log('error', `Error generating task files: ${error.message}`);

		// Only show error UI in CLI mode
		if (!options?.mcpLog) {
			console.error(chalk.red(`Error generating task files: ${error.message}`));

			if (getDebugFlag()) {
				// Use getter
				console.error(error);
			}

			process.exit(1);
		} else {
			// In MCP mode, throw the error for the caller to handle
			throw error;
		}
	}
}

export default generateTaskFiles;
