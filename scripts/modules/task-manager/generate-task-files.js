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
 * @param {Object} options - Additional options (mcpLog for MCP mode, projectRoot, tag)
 * @returns {Object|undefined} Result object in MCP mode, undefined in CLI mode
 */
function generateTaskFiles(tasksPath, outputDir, options = {}) {
	try {
		const isMcpMode = !!options?.mcpLog;

		// 1. Read the raw data structure, ensuring we have all tags.
		// We call readJSON without a specific tag to get the resolved default view,
		// which correctly contains the full structure in `_rawTaggedData`.
		const resolvedData = readJSON(tasksPath, options.projectRoot);
		if (!resolvedData) {
			throw new Error(`Could not read or parse tasks file: ${tasksPath}`);
		}
		// Prioritize the _rawTaggedData if it exists, otherwise use the data as is.
		const rawData = resolvedData._rawTaggedData || resolvedData;

		// 2. Determine the target tag we need to generate files for.
		const targetTag = options.tag || resolvedData.tag || 'master';
		const tagData = rawData[targetTag];

		if (!tagData || !tagData.tasks) {
			throw new Error(
				`Tag '${targetTag}' not found or has no tasks in the data.`
			);
		}
		const tasksForGeneration = tagData.tasks;

		// Create the output directory if it doesn't exist
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		log(
			'info',
			`Preparing to regenerate ${tasksForGeneration.length} task files for tag '${targetTag}'`
		);

		// 3. Validate dependencies using the FULL, raw data structure to prevent data loss.
		validateAndFixDependencies(
			rawData, // Pass the entire object with all tags
			tasksPath,
			options.projectRoot,
			targetTag // Provide the current tag context for the operation
		);

		const allTasksInTag = tagData.tasks;
		const validTaskIds = allTasksInTag.map((task) => task.id);

		// Cleanup orphaned task files
		log('info', 'Checking for orphaned task files to clean up...');
		try {
			const files = fs.readdirSync(outputDir);
			// Tag-aware file patterns: master -> task_001.txt, other tags -> task_001_tagname.txt
			const masterFilePattern = /^task_(\d+)\.txt$/;
			const taggedFilePattern = new RegExp(`^task_(\\d+)_${targetTag}\\.txt$`);

			const orphanedFiles = files.filter((file) => {
				let match = null;
				let fileTaskId = null;

				// Check if file belongs to current tag
				if (targetTag === 'master') {
					match = file.match(masterFilePattern);
					if (match) {
						fileTaskId = parseInt(match[1], 10);
						// Only clean up master files when processing master tag
						return !validTaskIds.includes(fileTaskId);
					}
				} else {
					match = file.match(taggedFilePattern);
					if (match) {
						fileTaskId = parseInt(match[1], 10);
						// Only clean up files for the current tag
						return !validTaskIds.includes(fileTaskId);
					}
				}
				return false;
			});

			if (orphanedFiles.length > 0) {
				log(
					'info',
					`Found ${orphanedFiles.length} orphaned task files to remove for tag '${targetTag}'`
				);
				orphanedFiles.forEach((file) => {
					const filePath = path.join(outputDir, file);
					fs.unlinkSync(filePath);
				});
			} else {
				log('info', 'No orphaned task files found.');
			}
		} catch (err) {
			log('warn', `Error cleaning up orphaned task files: ${err.message}`);
		}

		// Generate task files for the target tag
		log('info', `Generating individual task files for tag '${targetTag}'...`);
		tasksForGeneration.forEach((task) => {
			// Tag-aware file naming: master -> task_001.txt, other tags -> task_001_tagname.txt
			const taskFileName =
				targetTag === 'master'
					? `task_${task.id.toString().padStart(3, '0')}.txt`
					: `task_${task.id.toString().padStart(3, '0')}_${targetTag}.txt`;

			const taskPath = path.join(outputDir, taskFileName);

			let content = `# Task ID: ${task.id}\n`;
			content += `# Title: ${task.title}\n`;
			content += `# Status: ${task.status || 'pending'}\n`;

			if (task.dependencies && task.dependencies.length > 0) {
				content += `# Dependencies: ${formatDependenciesWithStatus(task.dependencies, allTasksInTag, false)}\n`;
			} else {
				content += '# Dependencies: None\n';
			}

			content += `# Priority: ${task.priority || 'medium'}\n`;
			content += `# Description: ${task.description || ''}\n`;
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

			if (task.subtasks && task.subtasks.length > 0) {
				content += '\n# Subtasks:\n';
				task.subtasks.forEach((subtask) => {
					content += `## ${subtask.id}. ${subtask.title} [${subtask.status || 'pending'}]\n`;
					if (subtask.dependencies && subtask.dependencies.length > 0) {
						const subtaskDeps = subtask.dependencies
							.map((depId) =>
								typeof depId === 'number'
									? `${task.id}.${depId}`
									: depId.toString()
							)
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

			fs.writeFileSync(taskPath, content);
		});

		log(
			'success',
			`All ${tasksForGeneration.length} tasks for tag '${targetTag}' have been generated into '${outputDir}'.`
		);

		if (isMcpMode) {
			return {
				success: true,
				count: tasksForGeneration.length,
				directory: outputDir
			};
		}
	} catch (error) {
		log('error', `Error generating task files: ${error.message}`);
		if (!options?.mcpLog) {
			console.error(chalk.red(`Error generating task files: ${error.message}`));
			if (getDebugFlag()) {
				console.error(error);
			}
			process.exit(1);
		} else {
			throw error;
		}
	}
}

export default generateTaskFiles;
