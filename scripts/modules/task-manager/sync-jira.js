/**
 * sync-jira.js
 * Synchronize tasks between Taskmaster and Jira
 */

import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';

import { log, readJSON, writeJSON } from '../utils.js';
import { displayBanner } from '../ui.js';
import { getJiraIntegrationEnabled } from '../config-manager.js';
import {
	isJiraConfigured,
	createUserStory,
	createTask,
	updateIssueStatus,
	getJiraKey,
	storeJiraKey,
	findIssueKeyByRefId
} from '../jira-integration.js';
import {
	generateUserStoryRefId,
	generateSubtaskRefId,
	storeRefId,
	getRefId
} from '../reference-id-service.js';
import generateTaskFiles from './generate-task-files.js';

/**
 * Synchronize tasks between Taskmaster and Jira
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {Object} options - Additional options
 * @param {Object} [options.mcpLog] - MCP logger object (optional)
 * @param {Object} [options.session] - Session object from MCP server (optional)
 * @param {string} [options.projectRoot] - Project root path (for MCP/env fallback)
 * @param {boolean} [options.force] - Force synchronization even if Jira integration is not enabled
 * @returns {Promise<Object>} Result object with sync information
 */
async function syncJira(tasksPath, options = {}) {
	const { mcpLog, session, projectRoot, force = false } = options;
	const isMcpMode = !!mcpLog;

	// Create a consistent logFn object regardless of context
	const logFn = isMcpMode
		? mcpLog
		: {
				info: (...args) => log('info', ...args),
				warn: (...args) => log('warn', ...args),
				error: (...args) => log('error', ...args),
				debug: (...args) => log('debug', ...args),
				success: (...args) => log('success', ...args)
			};

	try {
		// Only display UI elements if not in MCP mode
		if (!isMcpMode) {
			displayBanner();
			console.log(
				boxen(chalk.white.bold('Synchronizing Tasks with Jira'), {
					padding: 1,
					borderColor: 'blue',
					borderStyle: 'round'
				})
			);
		}

		// Check if Jira integration is enabled and configured
		if (!force && !getJiraIntegrationEnabled(projectRoot)) {
			logFn.warn('Jira integration is not enabled in the configuration.');
			return { success: false, message: 'Jira integration is not enabled' };
		}

		if (!isJiraConfigured(projectRoot)) {
			logFn.error(
				'Jira is not properly configured. Please check your configuration.'
			);
			return { success: false, message: 'Jira is not properly configured' };
		}

		// Read the tasks file
		logFn.info(`Reading tasks from ${tasksPath}...`);
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(`No valid tasks found in ${tasksPath}`);
		}

		const tasks = data.tasks;
		logFn.info(`Found ${tasks.length} tasks to synchronize.`);

		// Statistics for reporting
		const stats = {
			tasksCreated: 0,
			subtasksCreated: 0,
			tasksUpdated: 0,
			subtasksUpdated: 0,
			errors: 0
		};

		// Process each task
		for (const task of tasks) {
			try {
				// Get reference ID from task metadata
				let refId = getRefId(task);

				// Check if task has a reference ID, if not, add one
				if (!refId && getJiraIntegrationEnabled(projectRoot)) {
					const newRefId = generateUserStoryRefId(task.id, projectRoot);
					if (newRefId) {
						task = storeRefId(task, (refId = newRefId));
						logFn.info(
							`Stored reference ID ${newRefId} in task ${task.id} metadata`
						);
						// Save the updated metadata immediately
						writeJSON(tasksPath, data);
					}
				}

				// Check if task has a Jira key in metadata
				let jiraKey = getJiraKey(task);

				if (!jiraKey) {
					// Create user story in Jira using the reference ID in the title
					logFn.info(
						`Creating user story in Jira for task ${task.id}: ${task.title}`
					);
					const jiraIssue = await createUserStory(
						{
							title: task.title, // Title now includes the reference ID
							description: task.description,
							details: task.details || '',
							priority: task.priority || 'medium'
						},
						projectRoot
					);

					if (jiraIssue && jiraIssue.key) {
						// Initialize metadata if it doesn't exist
						if (!task.metadata) {
							task.metadata = {};
						}

						// Store Jira issue key in task metadata
						task.metadata.jiraKey = jiraIssue.key;
						jiraKey = jiraIssue.key;
						logFn.success(
							`Created Jira user story: ${jiraKey} for task ${task.id} with reference ID ${refId}`
						);
						stats.tasksCreated++;

						// Write the updated tasks to the file immediately to ensure Jira keys are saved
						logFn.info('Writing updated task metadata to file...');
						writeJSON(tasksPath, data);
					} else {
						logFn.warn(`Failed to create Jira user story for task ${task.id}`);
						stats.errors++;
					}
				} else {
					// Update existing user story status
					logFn.info(
						`Updating Jira user story ${jiraKey} status to ${task.status}`
					);
					const success = await updateIssueStatus(
						jiraKey,
						task.status,
						projectRoot,
						{
							title: task.title, // Title includes the reference ID
							description: task.description,
							details: task.details || '',
							priority: task.priority || 'medium'
						}
					);

					if (success) {
						logFn.success(
							`Updated Jira user story ${jiraKey} status to ${task.status}`
						);
						stats.tasksUpdated++;
					} else {
						logFn.warn(`Failed to update Jira user story ${jiraKey} status`);
						stats.errors++;
					}
				}

				// Process subtasks if any
				if (
					task.subtasks &&
					Array.isArray(task.subtasks) &&
					task.subtasks.length > 0
				) {
					logFn.info(
						`Processing ${task.subtasks.length} subtasks for task ${task.id}...`
					);

					for (const subtask of task.subtasks) {
						try {
							// Get reference ID from subtask metadata
							let subtaskRefId = getRefId(subtask);

							// Check if subtask has a reference ID, if not, add one
							if (!subtaskRefId && getJiraIntegrationEnabled(projectRoot)) {
								const newRefId = generateSubtaskRefId(
									task.id,
									subtask.id,
									projectRoot
								);
								if (newRefId) {
									subtask = storeRefId(subtask, (subtaskRefId = newRefId));
									logFn.info(
										`Stored reference ID ${newRefId} in subtask ${subtask.id} metadata`
									);
									// Save the updated metadata immediately
									writeJSON(tasksPath, data);
								}
							}

							// Check if subtask has a Jira key in metadata
							const subtaskJiraKey = subtask.metadata?.jiraKey;

							if (!subtaskJiraKey) {
								// Create task in Jira using the reference ID in the title
								logFn.info(
									`Creating task in Jira for subtask ${subtask.id}: ${subtask.title}`
								);
								const jiraIssue = await createTask(
									{
										title: subtask.title, // Title now includes the reference ID
										description: subtask.description,
										details: subtask.details || '',
										priority: subtask.priority || 'medium'
									},
									jiraKey, // Parent Jira key
									projectRoot
								);

								if (jiraIssue && jiraIssue.key) {
									// Initialize metadata if it doesn't exist
									if (!subtask.metadata) {
										subtask.metadata = {};
									}

									// Store Jira issue key in subtask metadata
									subtask.metadata.jiraKey = jiraIssue.key;
									logFn.success(
										`Created Jira task: ${jiraIssue.key} for subtask ${subtask.id} with reference ID ${subtaskRefId}`
									);
									stats.subtasksCreated++;

									// Write the updated tasks to the file immediately to ensure Jira keys are saved
									logFn.info('Writing updated subtask metadata to file...');
									writeJSON(tasksPath, data);
								} else {
									logFn.warn(
										`Failed to create Jira task for subtask ${subtask.id}`
									);
									stats.errors++;
								}
							} else {
								// Update existing task status
								logFn.info(
									`Updating Jira task ${subtaskJiraKey} status to ${subtask.status || task.status}`
								);
								const success = await updateIssueStatus(
									subtaskJiraKey,
									subtask.status || task.status, // Use subtask status if available, otherwise use parent task status
									projectRoot,
									{
										title: subtask.title, // Title includes the reference ID
										description: subtask.description,
										details: subtask.details || '',
										priority: subtask.priority || 'medium',
										parentId: task.id,
										parentJiraKey: jiraKey,
										// Pass the full tasks data for context
										tasksData: data
									}
								);

								if (success) {
									logFn.success(
										`Updated Jira task ${subtaskJiraKey} status to ${subtask.status || task.status}`
									);
									stats.subtasksUpdated++;
								} else {
									logFn.warn(
										`Failed to update Jira task ${subtaskJiraKey} status`
									);
									stats.errors++;
								}
							}
						} catch (subtaskError) {
							logFn.error(
								`Error processing subtask ${subtask.id}: ${subtaskError.message}`
							);
							stats.errors++;
						}
					}
				}
			} catch (taskError) {
				logFn.error(`Error processing task ${task.id}: ${taskError.message}`);
				stats.errors++;
			}
		}

		// Write the updated tasks to the file
		logFn.info('Writing updated tasks to file...');
		writeJSON(tasksPath, data);

		// Generate individual task files
		logFn.info('Regenerating task files...');
		await generateTaskFiles(tasksPath, path.dirname(tasksPath), { mcpLog });

		// Display summary
		const summary =
			`Synchronization complete:\n` +
			`- User stories created: ${stats.tasksCreated}\n` +
			`- User stories updated: ${stats.tasksUpdated}\n` +
			`- Tasks created: ${stats.subtasksCreated}\n` +
			`- Tasks updated: ${stats.subtasksUpdated}\n` +
			`- Errors: ${stats.errors}`;

		if (!isMcpMode) {
			console.log(
				boxen(chalk.white.bold(summary), {
					padding: 1,
					borderColor: 'green',
					borderStyle: 'round'
				})
			);
		} else {
			logFn.success(summary);
		}

		return {
			success: true,
			stats,
			message: 'Synchronization complete'
		};
	} catch (error) {
		logFn.error(`Error synchronizing with Jira: ${error.message}`);

		if (!isMcpMode) {
			console.error(chalk.red(`Error: ${error.message}`));
		}

		return {
			success: false,
			message: `Error: ${error.message}`
		};
	}
}

export default syncJira;
