import path from 'path';
import fs from 'fs';
import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';

import {
	log,
	readJSON,
	writeJSON,
	getCurrentTag,
	resolveTag,
	getTasksForTag,
	setTasksForTag,
	findProjectRoot,
	truncate
} from '../utils.js';
import { displayBanner, getStatusWithColor } from '../ui.js';
import findNextTask from './find-next-task.js';

/**
 * Create a new tag context
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} tagName - Name of the new tag to create
 * @param {Object} options - Options object
 * @param {boolean} [options.copyFromCurrent=false] - Whether to copy tasks from current tag
 * @param {string} [options.copyFromTag] - Specific tag to copy tasks from
 * @param {string} [options.description] - Optional description for the tag
 * @param {Object} context - Context object containing session and projectRoot
 * @param {string} [context.projectRoot] - Project root path
 * @param {Object} [context.mcpLog] - MCP logger object (optional)
 * @param {string} outputFormat - Output format (text or json)
 * @returns {Promise<Object>} Result object with tag creation details
 */
async function createTag(
	tasksPath,
	tagName,
	options = {},
	context = {},
	outputFormat = 'text'
) {
	const { mcpLog, projectRoot } = context;
	const { copyFromCurrent = false, copyFromTag, description } = options;

	// Create a consistent logFn object regardless of context
	const logFn = mcpLog || {
		info: (...args) => log('info', ...args),
		warn: (...args) => log('warn', ...args),
		error: (...args) => log('error', ...args),
		debug: (...args) => log('debug', ...args),
		success: (...args) => log('success', ...args)
	};

	try {
		// Validate tag name
		if (!tagName || typeof tagName !== 'string') {
			throw new Error('Tag name is required and must be a string');
		}

		// Validate tag name format (alphanumeric, hyphens, underscores only)
		if (!/^[a-zA-Z0-9_-]+$/.test(tagName)) {
			throw new Error(
				'Tag name can only contain letters, numbers, hyphens, and underscores'
			);
		}

		// Reserved tag names
		const reservedNames = ['master', 'main', 'default'];
		if (reservedNames.includes(tagName.toLowerCase())) {
			throw new Error(`"${tagName}" is a reserved tag name`);
		}

		logFn.info(`Creating new tag: ${tagName}`);

		// Read current tasks data
		const data = readJSON(tasksPath, projectRoot);
		if (!data) {
			throw new Error(`Could not read tasks file at ${tasksPath}`);
		}

		// Use raw tagged data for tag operations - ensure we get the actual tagged structure
		let rawData;
		if (data._rawTaggedData) {
			// If we have _rawTaggedData, use it (this is the clean tagged structure)
			rawData = data._rawTaggedData;
		} else if (data.tasks && !data.master) {
			// This is legacy format - create a master tag structure
			rawData = {
				master: {
					tasks: data.tasks,
					metadata: data.metadata || {
						created: new Date().toISOString(),
						updated: new Date().toISOString(),
						description: 'Tasks live here by default'
					}
				}
			};
		} else {
			// This is already in tagged format, use it directly but exclude internal fields
			rawData = {};
			for (const [key, value] of Object.entries(data)) {
				if (key !== '_rawTaggedData' && key !== 'tag') {
					rawData[key] = value;
				}
			}
		}

		// Check if tag already exists
		if (rawData[tagName]) {
			throw new Error(`Tag "${tagName}" already exists`);
		}

		// Determine source for copying tasks (only if explicitly requested)
		let sourceTasks = [];
		if (copyFromCurrent || copyFromTag) {
			const sourceTag = copyFromTag || getCurrentTag(projectRoot);
			sourceTasks = getTasksForTag(rawData, sourceTag);

			if (copyFromTag && sourceTasks.length === 0) {
				logFn.warn(`Source tag "${copyFromTag}" not found or has no tasks`);
			}

			logFn.info(`Copying ${sourceTasks.length} tasks from tag "${sourceTag}"`);
		} else {
			logFn.info('Creating empty tag (no tasks copied)');
		}

		// Create the new tag structure in raw data
		rawData[tagName] = {
			tasks: [...sourceTasks], // Create a copy of the tasks array
			metadata: {
				created: new Date().toISOString(),
				updated: new Date().toISOString(),
				description:
					description || `Tag created on ${new Date().toLocaleDateString()}`
			}
		};

		// Create clean data for writing (exclude _rawTaggedData to prevent corruption)
		const cleanData = {};
		for (const [key, value] of Object.entries(rawData)) {
			if (key !== '_rawTaggedData') {
				cleanData[key] = value;
			}
		}

		// Write the clean data back to file
		writeJSON(tasksPath, cleanData);

		logFn.success(`Successfully created tag "${tagName}"`);

		// For JSON output, return structured data
		if (outputFormat === 'json') {
			return {
				tagName,
				created: true,
				tasksCopied: sourceTasks.length,
				sourceTag:
					copyFromCurrent || copyFromTag
						? copyFromTag || getCurrentTag(projectRoot)
						: null,
				description:
					description || `Tag created on ${new Date().toLocaleDateString()}`
			};
		}

		// For text output, display success message
		if (outputFormat === 'text') {
			console.log(
				boxen(
					chalk.green.bold('✓ Tag Created Successfully') +
						`\n\nTag Name: ${chalk.cyan(tagName)}` +
						`\nTasks Copied: ${chalk.yellow(sourceTasks.length)}` +
						(copyFromCurrent || copyFromTag
							? `\nSource Tag: ${chalk.cyan(copyFromTag || getCurrentTag(projectRoot))}`
							: '') +
						(description ? `\nDescription: ${chalk.gray(description)}` : ''),
					{
						padding: 1,
						borderColor: 'green',
						borderStyle: 'round',
						margin: { top: 1, bottom: 1 }
					}
				)
			);
		}

		return {
			tagName,
			created: true,
			tasksCopied: sourceTasks.length,
			sourceTag:
				copyFromCurrent || copyFromTag
					? copyFromTag || getCurrentTag(projectRoot)
					: null,
			description:
				description || `Tag created on ${new Date().toLocaleDateString()}`
		};
	} catch (error) {
		logFn.error(`Error creating tag: ${error.message}`);
		throw error;
	}
}

/**
 * Delete an existing tag
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} tagName - Name of the tag to delete
 * @param {Object} options - Options object
 * @param {boolean} [options.yes=false] - Skip confirmation prompts
 * @param {Object} context - Context object containing session and projectRoot
 * @param {string} [context.projectRoot] - Project root path
 * @param {Object} [context.mcpLog] - MCP logger object (optional)
 * @param {string} outputFormat - Output format (text or json)
 * @returns {Promise<Object>} Result object with deletion details
 */
async function deleteTag(
	tasksPath,
	tagName,
	options = {},
	context = {},
	outputFormat = 'text'
) {
	const { mcpLog, projectRoot } = context;
	const { yes = false } = options;

	// Create a consistent logFn object regardless of context
	const logFn = mcpLog || {
		info: (...args) => log('info', ...args),
		warn: (...args) => log('warn', ...args),
		error: (...args) => log('error', ...args),
		debug: (...args) => log('debug', ...args),
		success: (...args) => log('success', ...args)
	};

	try {
		// Validate tag name
		if (!tagName || typeof tagName !== 'string') {
			throw new Error('Tag name is required and must be a string');
		}

		// Prevent deletion of master tag
		if (tagName === 'master') {
			throw new Error('Cannot delete the "master" tag');
		}

		logFn.info(`Deleting tag: ${tagName}`);

		// Read current tasks data
		const data = readJSON(tasksPath, projectRoot);
		if (!data) {
			throw new Error(`Could not read tasks file at ${tasksPath}`);
		}

		// Use raw tagged data for tag operations - ensure we get the actual tagged structure
		let rawData;
		if (data._rawTaggedData) {
			// If we have _rawTaggedData, use it (this is the clean tagged structure)
			rawData = data._rawTaggedData;
		} else if (data.tasks && !data.master) {
			// This is legacy format - create a master tag structure
			rawData = {
				master: {
					tasks: data.tasks,
					metadata: data.metadata || {
						created: new Date().toISOString(),
						updated: new Date().toISOString(),
						description: 'Tasks live here by default'
					}
				}
			};
		} else {
			// This is already in tagged format, use it directly but exclude internal fields
			rawData = {};
			for (const [key, value] of Object.entries(data)) {
				if (key !== '_rawTaggedData' && key !== 'tag') {
					rawData[key] = value;
				}
			}
		}

		// Check if tag exists
		if (!rawData[tagName]) {
			throw new Error(`Tag "${tagName}" does not exist`);
		}

		// Get current tag to check if we're deleting the active tag
		const currentTag = getCurrentTag(projectRoot);
		const isCurrentTag = currentTag === tagName;

		// Get task count for confirmation
		const tasks = getTasksForTag(rawData, tagName);
		const taskCount = tasks.length;

		// If not forced and has tasks, require confirmation (for CLI)
		if (!yes && taskCount > 0 && outputFormat === 'text') {
			console.log(
				boxen(
					chalk.yellow.bold('⚠ WARNING: Tag Deletion') +
						`\n\nYou are about to delete tag "${chalk.cyan(tagName)}"` +
						`\nThis will permanently delete ${chalk.red.bold(taskCount)} tasks` +
						'\n\nThis action cannot be undone!',
					{
						padding: 1,
						borderColor: 'yellow',
						borderStyle: 'round',
						margin: { top: 1, bottom: 1 }
					}
				)
			);

			// First confirmation
			const firstConfirm = await inquirer.prompt([
				{
					type: 'confirm',
					name: 'proceed',
					message: `Are you sure you want to delete tag "${tagName}" and its ${taskCount} tasks?`,
					default: false
				}
			]);

			if (!firstConfirm.proceed) {
				logFn.info('Tag deletion cancelled by user');
				throw new Error('Tag deletion cancelled');
			}

			// Second confirmation (double-check)
			const secondConfirm = await inquirer.prompt([
				{
					type: 'input',
					name: 'tagNameConfirm',
					message: `To confirm deletion, please type the tag name "${tagName}":`,
					validate: (input) => {
						if (input === tagName) {
							return true;
						}
						return `Please type exactly "${tagName}" to confirm deletion`;
					}
				}
			]);

			if (secondConfirm.tagNameConfirm !== tagName) {
				logFn.info('Tag deletion cancelled - incorrect tag name confirmation');
				throw new Error('Tag deletion cancelled');
			}

			logFn.info('Double confirmation received, proceeding with deletion...');
		}

		// Delete the tag
		delete rawData[tagName];

		// If we're deleting the current tag, switch to master
		if (isCurrentTag) {
			await switchCurrentTag(projectRoot, 'master');
			logFn.info('Switched current tag to "master"');
		}

		// Create clean data for writing (exclude _rawTaggedData to prevent corruption)
		const cleanData = {};
		for (const [key, value] of Object.entries(rawData)) {
			if (key !== '_rawTaggedData') {
				cleanData[key] = value;
			}
		}

		// Write the clean data back to file
		writeJSON(tasksPath, cleanData);

		logFn.success(`Successfully deleted tag "${tagName}"`);

		// For JSON output, return structured data
		if (outputFormat === 'json') {
			return {
				tagName,
				deleted: true,
				tasksDeleted: taskCount,
				wasCurrentTag: isCurrentTag,
				switchedToMaster: isCurrentTag
			};
		}

		// For text output, display success message
		if (outputFormat === 'text') {
			console.log(
				boxen(
					chalk.red.bold('✓ Tag Deleted Successfully') +
						`\n\nTag Name: ${chalk.cyan(tagName)}` +
						`\nTasks Deleted: ${chalk.yellow(taskCount)}` +
						(isCurrentTag
							? `\n${chalk.yellow('⚠ Switched current tag to "master"')}`
							: ''),
					{
						padding: 1,
						borderColor: 'red',
						borderStyle: 'round',
						margin: { top: 1, bottom: 1 }
					}
				)
			);
		}

		return {
			tagName,
			deleted: true,
			tasksDeleted: taskCount,
			wasCurrentTag: isCurrentTag,
			switchedToMaster: isCurrentTag
		};
	} catch (error) {
		logFn.error(`Error deleting tag: ${error.message}`);
		throw error;
	}
}

/**
 * Enhance existing tags with metadata if they don't have it
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {Object} rawData - The raw tagged data
 * @param {Object} context - Context object
 * @returns {Promise<boolean>} True if any tags were enhanced
 */
async function enhanceTagsWithMetadata(tasksPath, rawData, context = {}) {
	let enhanced = false;

	try {
		// Get file stats for creation date fallback
		let fileCreatedDate;
		try {
			const stats = fs.statSync(tasksPath);
			fileCreatedDate =
				stats.birthtime < stats.mtime ? stats.birthtime : stats.mtime;
		} catch (error) {
			fileCreatedDate = new Date();
		}

		for (const [tagName, tagData] of Object.entries(rawData)) {
			// Skip non-tag properties
			if (
				tagName === 'tasks' ||
				tagName === 'tag' ||
				tagName === '_rawTaggedData' ||
				!tagData ||
				typeof tagData !== 'object' ||
				!Array.isArray(tagData.tasks)
			) {
				continue;
			}

			// Check if tag needs metadata enhancement
			if (!tagData.metadata) {
				tagData.metadata = {};
				enhanced = true;
			}

			// Add missing metadata fields
			if (!tagData.metadata.created) {
				tagData.metadata.created = fileCreatedDate.toISOString();
				enhanced = true;
			}

			if (!tagData.metadata.description) {
				if (tagName === 'master') {
					tagData.metadata.description = 'Tasks live here by default';
				} else {
					tagData.metadata.description = `Tag created on ${new Date(tagData.metadata.created).toLocaleDateString()}`;
				}
				enhanced = true;
			}

			// Add updated field if missing (set to created date initially)
			if (!tagData.metadata.updated) {
				tagData.metadata.updated = tagData.metadata.created;
				enhanced = true;
			}
		}

		// If we enhanced any tags, write the data back
		if (enhanced) {
			// Create clean data for writing (exclude _rawTaggedData to prevent corruption)
			const cleanData = {};
			for (const [key, value] of Object.entries(rawData)) {
				if (key !== '_rawTaggedData') {
					cleanData[key] = value;
				}
			}
			writeJSON(tasksPath, cleanData);
		}
	} catch (error) {
		// Don't throw - just log and continue
		const logFn = context.mcpLog || {
			warn: (...args) => log('warn', ...args)
		};
		logFn.warn(`Could not enhance tag metadata: ${error.message}`);
	}

	return enhanced;
}

/**
 * List all available tags with metadata
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {Object} options - Options object
 * @param {boolean} [options.showTaskCounts=true] - Whether to show task counts
 * @param {boolean} [options.showMetadata=false] - Whether to show metadata
 * @param {Object} context - Context object containing session and projectRoot
 * @param {string} [context.projectRoot] - Project root path
 * @param {Object} [context.mcpLog] - MCP logger object (optional)
 * @param {string} outputFormat - Output format (text or json)
 * @returns {Promise<Object>} Result object with tags list
 */
async function tags(
	tasksPath,
	options = {},
	context = {},
	outputFormat = 'text'
) {
	const { mcpLog, projectRoot } = context;
	const { showTaskCounts = true, showMetadata = false } = options;

	// Create a consistent logFn object regardless of context
	const logFn = mcpLog || {
		info: (...args) => log('info', ...args),
		warn: (...args) => log('warn', ...args),
		error: (...args) => log('error', ...args),
		debug: (...args) => log('debug', ...args),
		success: (...args) => log('success', ...args)
	};

	try {
		logFn.info('Listing available tags');

		// Read current tasks data
		const data = readJSON(tasksPath, projectRoot);
		if (!data) {
			throw new Error(`Could not read tasks file at ${tasksPath}`);
		}

		// Get current tag
		const currentTag = getCurrentTag(projectRoot);

		// Use raw tagged data if available, otherwise use the data directly
		const rawData = data._rawTaggedData || data;

		// Enhance existing tags with metadata if they don't have it
		await enhanceTagsWithMetadata(tasksPath, rawData, context);

		// Extract all tags
		const tagList = [];
		for (const [tagName, tagData] of Object.entries(rawData)) {
			// Skip non-tag properties (like legacy 'tasks' array, 'tag', '_rawTaggedData')
			if (
				tagName === 'tasks' ||
				tagName === 'tag' ||
				tagName === '_rawTaggedData' ||
				!tagData ||
				typeof tagData !== 'object' ||
				!Array.isArray(tagData.tasks)
			) {
				continue;
			}

			const tasks = tagData.tasks || [];
			const metadata = tagData.metadata || {};

			tagList.push({
				name: tagName,
				isCurrent: tagName === currentTag,
				completedTasks: tasks.filter(
					(t) => t.status === 'done' || t.status === 'completed'
				).length,
				tasks: tasks || [],
				created: metadata.created || 'Unknown',
				description: metadata.description || 'No description'
			});
		}

		// Sort tags: current tag first, then alphabetically
		tagList.sort((a, b) => {
			if (a.isCurrent) return -1;
			if (b.isCurrent) return 1;
			return a.name.localeCompare(b.name);
		});

		logFn.success(`Found ${tagList.length} tags`);

		// For JSON output, return structured data
		if (outputFormat === 'json') {
			return {
				tags: tagList,
				currentTag,
				totalTags: tagList.length
			};
		}

		// For text output, display formatted table
		if (outputFormat === 'text') {
			if (tagList.length === 0) {
				console.log(
					boxen(chalk.yellow('No tags found'), {
						padding: 1,
						borderColor: 'yellow',
						borderStyle: 'round',
						margin: { top: 1, bottom: 1 }
					})
				);
				return { tags: [], currentTag, totalTags: 0 };
			}

			// Create table headers based on options
			const headers = [chalk.cyan.bold('Tag Name')];
			if (showTaskCounts) {
				headers.push(chalk.cyan.bold('Tasks'));
				headers.push(chalk.cyan.bold('Completed'));
			}
			if (showMetadata) {
				headers.push(chalk.cyan.bold('Created'));
				headers.push(chalk.cyan.bold('Description'));
			}

			const table = new Table({
				head: headers,
				colWidths: showMetadata ? [20, 10, 12, 15, 50] : [25, 10, 12]
			});

			// Add rows
			tagList.forEach((tag) => {
				const row = [];

				// Tag name with current indicator
				const tagDisplay = tag.isCurrent
					? `${chalk.green('●')} ${chalk.green.bold(tag.name)} ${chalk.gray('(current)')}`
					: `  ${tag.name}`;
				row.push(tagDisplay);

				if (showTaskCounts) {
					row.push(chalk.white(tag.tasks.length.toString()));
					row.push(chalk.green(tag.completedTasks.toString()));
				}

				if (showMetadata) {
					const createdDate =
						tag.created !== 'Unknown'
							? new Date(tag.created).toLocaleDateString()
							: 'Unknown';
					row.push(chalk.gray(createdDate));
					row.push(chalk.gray(truncate(tag.description, 50)));
				}

				table.push(row);
			});

			// console.log(
			// 	boxen(
			// 		chalk.white.bold('Available Tags') +
			// 			`\n\nCurrent Tag: ${chalk.green.bold(currentTag)}`,
			// 		{
			// 			padding: { top: 0, bottom: 1, left: 1, right: 1 },
			// 			borderColor: 'blue',
			// 			borderStyle: 'round',
			// 			margin: { top: 1, bottom: 0 }
			// 		}
			// 	)
			// );

			console.log(table.toString());
		}

		return {
			tags: tagList,
			currentTag,
			totalTags: tagList.length
		};
	} catch (error) {
		logFn.error(`Error listing tags: ${error.message}`);
		throw error;
	}
}

/**
 * Switch to a different tag context
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} tagName - Name of the tag to switch to
 * @param {Object} options - Options object
 * @param {Object} context - Context object containing session and projectRoot
 * @param {string} [context.projectRoot] - Project root path
 * @param {Object} [context.mcpLog] - MCP logger object (optional)
 * @param {string} outputFormat - Output format (text or json)
 * @returns {Promise<Object>} Result object with switch details
 */
async function useTag(
	tasksPath,
	tagName,
	options = {},
	context = {},
	outputFormat = 'text'
) {
	const { mcpLog, projectRoot } = context;

	// Create a consistent logFn object regardless of context
	const logFn = mcpLog || {
		info: (...args) => log('info', ...args),
		warn: (...args) => log('warn', ...args),
		error: (...args) => log('error', ...args),
		debug: (...args) => log('debug', ...args),
		success: (...args) => log('success', ...args)
	};

	try {
		// Validate tag name
		if (!tagName || typeof tagName !== 'string') {
			throw new Error('Tag name is required and must be a string');
		}

		logFn.info(`Switching to tag: ${tagName}`);

		// Read current tasks data to verify tag exists
		const data = readJSON(tasksPath, projectRoot);
		if (!data) {
			throw new Error(`Could not read tasks file at ${tasksPath}`);
		}

		// Use raw tagged data to check if tag exists
		const rawData = data._rawTaggedData || data;

		// Check if tag exists
		if (!rawData[tagName]) {
			throw new Error(`Tag "${tagName}" does not exist`);
		}

		// Get current tag
		const previousTag = getCurrentTag(projectRoot);

		// Switch to the new tag
		await switchCurrentTag(projectRoot, tagName);

		// Get task count for the new tag - read tasks specifically for this tag
		const tagData = readJSON(tasksPath, projectRoot, tagName);
		const tasks = tagData ? tagData.tasks || [] : [];
		const taskCount = tasks.length;

		// Find the next task to work on in this tag
		const nextTask = findNextTask(tasks);

		logFn.success(`Successfully switched to tag "${tagName}"`);

		// For JSON output, return structured data
		if (outputFormat === 'json') {
			return {
				previousTag,
				currentTag: tagName,
				switched: true,
				taskCount,
				nextTask
			};
		}

		// For text output, display success message
		if (outputFormat === 'text') {
			let nextTaskInfo = '';
			if (nextTask) {
				nextTaskInfo = `\nNext Task: ${chalk.cyan(`#${nextTask.id}`)} - ${chalk.white(nextTask.title)}`;
			} else {
				nextTaskInfo = `\nNext Task: ${chalk.gray('No eligible tasks available')}`;
			}

			console.log(
				boxen(
					chalk.green.bold('✓ Tag Switched Successfully') +
						`\n\nPrevious Tag: ${chalk.cyan(previousTag)}` +
						`\nCurrent Tag: ${chalk.green.bold(tagName)}` +
						`\nAvailable Tasks: ${chalk.yellow(taskCount)}` +
						nextTaskInfo,
					{
						padding: 1,
						borderColor: 'green',
						borderStyle: 'round',
						margin: { top: 1, bottom: 1 }
					}
				)
			);
		}

		return {
			previousTag,
			currentTag: tagName,
			switched: true,
			taskCount,
			nextTask
		};
	} catch (error) {
		logFn.error(`Error switching tag: ${error.message}`);
		throw error;
	}
}

/**
 * Rename an existing tag
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} oldName - Current name of the tag
 * @param {string} newName - New name for the tag
 * @param {Object} options - Options object
 * @param {Object} context - Context object containing session and projectRoot
 * @param {string} [context.projectRoot] - Project root path
 * @param {Object} [context.mcpLog] - MCP logger object (optional)
 * @param {string} outputFormat - Output format (text or json)
 * @returns {Promise<Object>} Result object with rename details
 */
async function renameTag(
	tasksPath,
	oldName,
	newName,
	options = {},
	context = {},
	outputFormat = 'text'
) {
	const { mcpLog, projectRoot } = context;

	// Create a consistent logFn object regardless of context
	const logFn = mcpLog || {
		info: (...args) => log('info', ...args),
		warn: (...args) => log('warn', ...args),
		error: (...args) => log('error', ...args),
		debug: (...args) => log('debug', ...args),
		success: (...args) => log('success', ...args)
	};

	try {
		// Validate parameters
		if (!oldName || typeof oldName !== 'string') {
			throw new Error('Old tag name is required and must be a string');
		}
		if (!newName || typeof newName !== 'string') {
			throw new Error('New tag name is required and must be a string');
		}

		// Validate new tag name format
		if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
			throw new Error(
				'New tag name can only contain letters, numbers, hyphens, and underscores'
			);
		}

		// Prevent renaming master tag
		if (oldName === 'master') {
			throw new Error('Cannot rename the "master" tag');
		}

		// Reserved tag names
		const reservedNames = ['master', 'main', 'default'];
		if (reservedNames.includes(newName.toLowerCase())) {
			throw new Error(`"${newName}" is a reserved tag name`);
		}

		logFn.info(`Renaming tag from "${oldName}" to "${newName}"`);

		// Read current tasks data
		const data = readJSON(tasksPath, projectRoot);
		if (!data) {
			throw new Error(`Could not read tasks file at ${tasksPath}`);
		}

		// Use raw tagged data for tag operations
		const rawData = data._rawTaggedData || data;

		// Check if old tag exists
		if (!rawData[oldName]) {
			throw new Error(`Tag "${oldName}" does not exist`);
		}

		// Check if new tag name already exists
		if (rawData[newName]) {
			throw new Error(`Tag "${newName}" already exists`);
		}

		// Get current tag to check if we're renaming the active tag
		const currentTag = getCurrentTag(projectRoot);
		const isCurrentTag = currentTag === oldName;

		// Rename the tag by copying data and deleting old
		rawData[newName] = { ...rawData[oldName] };

		// Update metadata if it exists
		if (rawData[newName].metadata) {
			rawData[newName].metadata.renamed = {
				from: oldName,
				date: new Date().toISOString()
			};
		}

		delete rawData[oldName];

		// If we're renaming the current tag, update the current tag reference
		if (isCurrentTag) {
			await switchCurrentTag(projectRoot, newName);
			logFn.info(`Updated current tag reference to "${newName}"`);
		}

		// Create clean data for writing (exclude _rawTaggedData to prevent corruption)
		const cleanData = {};
		for (const [key, value] of Object.entries(rawData)) {
			if (key !== '_rawTaggedData') {
				cleanData[key] = value;
			}
		}

		// Write the clean data back to file
		writeJSON(tasksPath, cleanData);

		// Get task count
		const tasks = getTasksForTag(rawData, newName);
		const taskCount = tasks.length;

		logFn.success(`Successfully renamed tag from "${oldName}" to "${newName}"`);

		// For JSON output, return structured data
		if (outputFormat === 'json') {
			return {
				oldName,
				newName,
				renamed: true,
				taskCount,
				wasCurrentTag: isCurrentTag,
				isCurrentTag: isCurrentTag
			};
		}

		// For text output, display success message
		if (outputFormat === 'text') {
			console.log(
				boxen(
					chalk.green.bold('✓ Tag Renamed Successfully') +
						`\n\nOld Name: ${chalk.cyan(oldName)}` +
						`\nNew Name: ${chalk.green.bold(newName)}` +
						`\nTasks: ${chalk.yellow(taskCount)}` +
						(isCurrentTag ? `\n${chalk.green('✓ Current tag updated')}` : ''),
					{
						padding: 1,
						borderColor: 'green',
						borderStyle: 'round',
						margin: { top: 1, bottom: 1 }
					}
				)
			);
		}

		return {
			oldName,
			newName,
			renamed: true,
			taskCount,
			wasCurrentTag: isCurrentTag,
			isCurrentTag: isCurrentTag
		};
	} catch (error) {
		logFn.error(`Error renaming tag: ${error.message}`);
		throw error;
	}
}

/**
 * Copy an existing tag to create a new tag with the same tasks
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} sourceName - Name of the source tag to copy from
 * @param {string} targetName - Name of the new tag to create
 * @param {Object} options - Options object
 * @param {string} [options.description] - Optional description for the new tag
 * @param {Object} context - Context object containing session and projectRoot
 * @param {string} [context.projectRoot] - Project root path
 * @param {Object} [context.mcpLog] - MCP logger object (optional)
 * @param {string} outputFormat - Output format (text or json)
 * @returns {Promise<Object>} Result object with copy details
 */
async function copyTag(
	tasksPath,
	sourceName,
	targetName,
	options = {},
	context = {},
	outputFormat = 'text'
) {
	const { mcpLog, projectRoot } = context;
	const { description } = options;

	// Create a consistent logFn object regardless of context
	const logFn = mcpLog || {
		info: (...args) => log('info', ...args),
		warn: (...args) => log('warn', ...args),
		error: (...args) => log('error', ...args),
		debug: (...args) => log('debug', ...args),
		success: (...args) => log('success', ...args)
	};

	try {
		// Validate parameters
		if (!sourceName || typeof sourceName !== 'string') {
			throw new Error('Source tag name is required and must be a string');
		}
		if (!targetName || typeof targetName !== 'string') {
			throw new Error('Target tag name is required and must be a string');
		}

		// Validate target tag name format
		if (!/^[a-zA-Z0-9_-]+$/.test(targetName)) {
			throw new Error(
				'Target tag name can only contain letters, numbers, hyphens, and underscores'
			);
		}

		// Reserved tag names
		const reservedNames = ['master', 'main', 'default'];
		if (reservedNames.includes(targetName.toLowerCase())) {
			throw new Error(`"${targetName}" is a reserved tag name`);
		}

		logFn.info(`Copying tag from "${sourceName}" to "${targetName}"`);

		// Read current tasks data
		const data = readJSON(tasksPath, projectRoot);
		if (!data) {
			throw new Error(`Could not read tasks file at ${tasksPath}`);
		}

		// Use raw tagged data for tag operations
		const rawData = data._rawTaggedData || data;

		// Check if source tag exists
		if (!rawData[sourceName]) {
			throw new Error(`Source tag "${sourceName}" does not exist`);
		}

		// Check if target tag already exists
		if (rawData[targetName]) {
			throw new Error(`Target tag "${targetName}" already exists`);
		}

		// Get source tasks
		const sourceTasks = getTasksForTag(rawData, sourceName);

		// Create deep copy of the source tag data
		rawData[targetName] = {
			tasks: JSON.parse(JSON.stringify(sourceTasks)), // Deep copy tasks
			metadata: {
				created: new Date().toISOString(),
				updated: new Date().toISOString(),
				description:
					description ||
					`Copy of "${sourceName}" created on ${new Date().toLocaleDateString()}`,
				copiedFrom: {
					tag: sourceName,
					date: new Date().toISOString()
				}
			}
		};

		// Create clean data for writing (exclude _rawTaggedData to prevent corruption)
		const cleanData = {};
		for (const [key, value] of Object.entries(rawData)) {
			if (key !== '_rawTaggedData') {
				cleanData[key] = value;
			}
		}

		// Write the clean data back to file
		writeJSON(tasksPath, cleanData);

		logFn.success(
			`Successfully copied tag from "${sourceName}" to "${targetName}"`
		);

		// For JSON output, return structured data
		if (outputFormat === 'json') {
			return {
				sourceName,
				targetName,
				copied: true,
				description:
					description ||
					`Copy of "${sourceName}" created on ${new Date().toLocaleDateString()}`
			};
		}

		// For text output, display success message
		if (outputFormat === 'text') {
			console.log(
				boxen(
					chalk.green.bold('✓ Tag Copied Successfully') +
						`\n\nSource Tag: ${chalk.cyan(sourceName)}` +
						`\nTarget Tag: ${chalk.green.bold(targetName)}` +
						`\nTasks Copied: ${chalk.yellow(sourceTasks.length)}` +
						(description ? `\nDescription: ${chalk.gray(description)}` : ''),
					{
						padding: 1,
						borderColor: 'green',
						borderStyle: 'round',
						margin: { top: 1, bottom: 1 }
					}
				)
			);
		}

		return {
			sourceName,
			targetName,
			copied: true,
			description:
				description ||
				`Copy of "${sourceName}" created on ${new Date().toLocaleDateString()}`
		};
	} catch (error) {
		logFn.error(`Error copying tag: ${error.message}`);
		throw error;
	}
}

/**
 * Helper function to switch the current tag in state.json
 * @param {string} projectRoot - Project root directory
 * @param {string} tagName - Name of the tag to switch to
 * @returns {Promise<void>}
 */
async function switchCurrentTag(projectRoot, tagName) {
	try {
		const statePath = path.join(projectRoot, '.taskmaster', 'state.json');

		// Read current state or create default
		let state = {};
		if (fs.existsSync(statePath)) {
			const rawState = fs.readFileSync(statePath, 'utf8');
			state = JSON.parse(rawState);
		}

		// Update current tag and timestamp
		state.currentTag = tagName;
		state.lastSwitched = new Date().toISOString();

		// Ensure other required state properties exist
		if (!state.branchTagMapping) {
			state.branchTagMapping = {};
		}
		if (state.migrationNoticeShown === undefined) {
			state.migrationNoticeShown = false;
		}

		// Write updated state
		fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
	} catch (error) {
		log('warn', `Could not update current tag in state.json: ${error.message}`);
		// Don't throw - this is not critical for tag operations
	}
}

/**
 * Update branch-tag mapping in state.json
 * @param {string} projectRoot - Project root directory
 * @param {string} branchName - Git branch name
 * @param {string} tagName - Tag name to map to
 * @returns {Promise<void>}
 */
async function updateBranchTagMapping(projectRoot, branchName, tagName) {
	try {
		const statePath = path.join(projectRoot, '.taskmaster', 'state.json');

		// Read current state or create default
		let state = {};
		if (fs.existsSync(statePath)) {
			const rawState = fs.readFileSync(statePath, 'utf8');
			state = JSON.parse(rawState);
		}

		// Ensure branchTagMapping exists
		if (!state.branchTagMapping) {
			state.branchTagMapping = {};
		}

		// Update the mapping
		state.branchTagMapping[branchName] = tagName;

		// Write updated state
		fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
	} catch (error) {
		log('warn', `Could not update branch-tag mapping: ${error.message}`);
		// Don't throw - this is not critical for tag operations
	}
}

/**
 * Get tag name for a git branch from state.json mapping
 * @param {string} projectRoot - Project root directory
 * @param {string} branchName - Git branch name
 * @returns {Promise<string|null>} Mapped tag name or null if not found
 */
async function getTagForBranch(projectRoot, branchName) {
	try {
		const statePath = path.join(projectRoot, '.taskmaster', 'state.json');

		if (!fs.existsSync(statePath)) {
			return null;
		}

		const rawState = fs.readFileSync(statePath, 'utf8');
		const state = JSON.parse(rawState);

		return state.branchTagMapping?.[branchName] || null;
	} catch (error) {
		return null;
	}
}

/**
 * Create a tag from a git branch name
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} branchName - Git branch name to create tag from
 * @param {Object} options - Options object
 * @param {boolean} [options.copyFromCurrent] - Copy tasks from current tag
 * @param {string} [options.copyFromTag] - Copy tasks from specific tag
 * @param {string} [options.description] - Custom description for the tag
 * @param {boolean} [options.autoSwitch] - Automatically switch to the new tag
 * @param {Object} context - Context object containing session and projectRoot
 * @param {string} [context.projectRoot] - Project root path
 * @param {Object} [context.mcpLog] - MCP logger object (optional)
 * @param {string} outputFormat - Output format (text or json)
 * @returns {Promise<Object>} Result object with creation details
 */
async function createTagFromBranch(
	tasksPath,
	branchName,
	options = {},
	context = {},
	outputFormat = 'text'
) {
	const { mcpLog, projectRoot } = context;
	const { copyFromCurrent, copyFromTag, description, autoSwitch } = options;

	// Import git utilities
	const { sanitizeBranchNameForTag, isValidBranchForTag } = await import(
		'../utils/git-utils.js'
	);

	// Create a consistent logFn object regardless of context
	const logFn = mcpLog || {
		info: (...args) => log('info', ...args),
		warn: (...args) => log('warn', ...args),
		error: (...args) => log('error', ...args),
		debug: (...args) => log('debug', ...args),
		success: (...args) => log('success', ...args)
	};

	try {
		// Validate branch name
		if (!branchName || typeof branchName !== 'string') {
			throw new Error('Branch name is required and must be a string');
		}

		// Check if branch name is valid for tag creation
		if (!isValidBranchForTag(branchName)) {
			throw new Error(
				`Branch "${branchName}" cannot be converted to a valid tag name`
			);
		}

		// Sanitize branch name to create tag name
		const tagName = sanitizeBranchNameForTag(branchName);

		logFn.info(`Creating tag "${tagName}" from git branch "${branchName}"`);

		// Create the tag using existing createTag function
		const createResult = await createTag(
			tasksPath,
			tagName,
			{
				copyFromCurrent,
				copyFromTag,
				description:
					description || `Tag created from git branch "${branchName}"`
			},
			context,
			outputFormat
		);

		// Update branch-tag mapping
		await updateBranchTagMapping(projectRoot, branchName, tagName);
		logFn.info(`Updated branch-tag mapping: ${branchName} -> ${tagName}`);

		// Auto-switch to the new tag if requested
		if (autoSwitch) {
			await switchCurrentTag(projectRoot, tagName);
			logFn.info(`Automatically switched to tag "${tagName}"`);
		}

		// For JSON output, return structured data
		if (outputFormat === 'json') {
			return {
				...createResult,
				branchName,
				tagName,
				mappingUpdated: true,
				autoSwitched: autoSwitch || false
			};
		}

		// For text output, the createTag function already handles display
		return {
			branchName,
			tagName,
			created: true,
			mappingUpdated: true,
			autoSwitched: autoSwitch || false
		};
	} catch (error) {
		logFn.error(`Error creating tag from branch: ${error.message}`);
		throw error;
	}
}

/**
 * Automatically switch tag based on current git branch
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {Object} options - Options object
 * @param {boolean} [options.createIfMissing] - Create tag if it doesn't exist
 * @param {boolean} [options.copyFromCurrent] - Copy tasks when creating new tag
 * @param {Object} context - Context object containing session and projectRoot
 * @param {string} [context.projectRoot] - Project root path
 * @param {Object} [context.mcpLog] - MCP logger object (optional)
 * @param {string} outputFormat - Output format (text or json)
 * @returns {Promise<Object>} Result object with switch details
 */
async function autoSwitchTagForBranch(
	tasksPath,
	options = {},
	context = {},
	outputFormat = 'text'
) {
	const { mcpLog, projectRoot } = context;
	const { createIfMissing, copyFromCurrent } = options;

	// Import git utilities
	const {
		getCurrentBranch,
		isGitRepository,
		sanitizeBranchNameForTag,
		isValidBranchForTag
	} = await import('../utils/git-utils.js');

	// Create a consistent logFn object regardless of context
	const logFn = mcpLog || {
		info: (...args) => log('info', ...args),
		warn: (...args) => log('warn', ...args),
		error: (...args) => log('error', ...args),
		debug: (...args) => log('debug', ...args),
		success: (...args) => log('success', ...args)
	};

	try {
		// Check if we're in a git repository
		if (!(await isGitRepository(projectRoot))) {
			logFn.warn('Not in a git repository, cannot auto-switch tags');
			return { switched: false, reason: 'not_git_repo' };
		}

		// Get current git branch
		const currentBranch = await getCurrentBranch(projectRoot);
		if (!currentBranch) {
			logFn.warn('Could not determine current git branch');
			return { switched: false, reason: 'no_current_branch' };
		}

		logFn.info(`Current git branch: ${currentBranch}`);

		// Check if branch is valid for tag creation
		if (!isValidBranchForTag(currentBranch)) {
			logFn.info(`Branch "${currentBranch}" is not suitable for tag creation`);
			return {
				switched: false,
				reason: 'invalid_branch_for_tag',
				branchName: currentBranch
			};
		}

		// Check if there's already a mapping for this branch
		let tagName = await getTagForBranch(projectRoot, currentBranch);

		if (!tagName) {
			// No mapping exists, create tag name from branch
			tagName = sanitizeBranchNameForTag(currentBranch);
		}

		// Check if tag exists
		const data = readJSON(tasksPath, projectRoot);
		const rawData = data._rawTaggedData || data;
		const tagExists = rawData[tagName];

		if (!tagExists && createIfMissing) {
			// Create the tag from branch
			logFn.info(`Creating new tag "${tagName}" for branch "${currentBranch}"`);

			const createResult = await createTagFromBranch(
				tasksPath,
				currentBranch,
				{
					copyFromCurrent,
					autoSwitch: true
				},
				context,
				outputFormat
			);

			return {
				switched: true,
				created: true,
				branchName: currentBranch,
				tagName,
				...createResult
			};
		} else if (tagExists) {
			// Tag exists, switch to it
			logFn.info(
				`Switching to existing tag "${tagName}" for branch "${currentBranch}"`
			);

			const switchResult = await useTag(
				tasksPath,
				tagName,
				{},
				context,
				outputFormat
			);

			// Update mapping if it didn't exist
			if (!(await getTagForBranch(projectRoot, currentBranch))) {
				await updateBranchTagMapping(projectRoot, currentBranch, tagName);
			}

			return {
				switched: true,
				created: false,
				branchName: currentBranch,
				tagName,
				...switchResult
			};
		} else {
			// Tag doesn't exist and createIfMissing is false
			logFn.warn(
				`Tag "${tagName}" for branch "${currentBranch}" does not exist`
			);
			return {
				switched: false,
				reason: 'tag_not_found',
				branchName: currentBranch,
				tagName
			};
		}
	} catch (error) {
		logFn.error(`Error in auto-switch tag for branch: ${error.message}`);
		throw error;
	}
}

/**
 * Check git workflow configuration and perform auto-switch if enabled
 * @param {string} projectRoot - Project root directory
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {Object} context - Context object
 * @returns {Promise<Object|null>} Switch result or null if not enabled
 */
async function checkAndAutoSwitchTag(projectRoot, tasksPath, context = {}) {
	try {
		// Read configuration
		const configPath = path.join(projectRoot, '.taskmaster', 'config.json');
		if (!fs.existsSync(configPath)) {
			return null;
		}

		const rawConfig = fs.readFileSync(configPath, 'utf8');
		const config = JSON.parse(rawConfig);

		// Git workflow has been removed - return null to disable auto-switching
		return null;

		// Perform auto-switch
		return await autoSwitchTagForBranch(
			tasksPath,
			{ createIfMissing: true, copyFromCurrent: false },
			context,
			'json'
		);
	} catch (error) {
		// Silently fail - this is not critical
		return null;
	}
}

// Export all tag management functions
export {
	createTag,
	deleteTag,
	tags,
	useTag,
	renameTag,
	copyTag,
	switchCurrentTag,
	updateBranchTagMapping,
	getTagForBranch,
	createTagFromBranch,
	autoSwitchTagForBranch,
	checkAndAutoSwitchTag
};
