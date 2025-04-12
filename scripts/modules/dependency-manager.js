/**
 * dependency-manager.js
 * Manages task dependencies and relationships
 */

import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import { Anthropic } from '@anthropic-ai/sdk';

import {
	log,
	readJSON,
	writeJSON,
	taskExists,
	formatTaskId,
	findCycles,
	isSilentMode
} from './utils.js';

import { displayBanner } from './ui.js';

// Initialize Anthropic client
const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Add a dependency to a task using a Task Provider.
 * @param {number|string} taskId - ID of the task to add dependency to.
 * @param {number|string} dependencyId - ID of the task to add as dependency.
 * @param {object} options - Options object.
 * @param {object} options.taskProvider - The task provider instance.
 * @param {object} [options.mcpLog] - Optional logger for MCP context.
 * @param {object} [options.session] - Optional session object for context.
 */
async function addDependency(taskId, dependencyId, options = {}) {
	const { taskProvider, mcpLog } = options;
	const report = mcpLog || log; // Use MCP log if available

	if (!taskProvider) {
		throw new Error("Task provider is required in options for addDependency.");
	}

	report('info', `Adding dependency ${dependencyId} to task ${taskId} via ${taskProvider.constructor.name}...`);

	// Fetch all tasks using the provider
	let allTasksData;
	try {
		allTasksData = await taskProvider.getTasks();
	} catch (error) {
		report('error', `Failed to fetch tasks using provider: ${error.message}`);
		// Decide how to handle errors - rethrow or return failure indication
		throw error; // Rethrow for now
	}

	if (!allTasksData || !allTasksData.tasks) {
		report('error', 'No valid tasks found via provider.');
		throw new Error('No valid tasks found via provider.');
	}
	const tasks = allTasksData.tasks; // Use the tasks array fetched via provider

	// Format the task and dependency IDs correctly
	const formattedTaskId =
		typeof taskId === 'string' && taskId.includes('.')
			? taskId
			: parseInt(taskId, 10);

	const formattedDependencyId = formatTaskId(dependencyId);

	// Check if the dependency task or subtask actually exists using the fetched tasks
	if (!taskExists(tasks, formattedDependencyId)) {
		const errorMsg = `Dependency target ${formattedDependencyId} does not exist.`;
		report('error', errorMsg);
		throw new Error(errorMsg); // Throw error instead of process.exit
	}

	// Find the task to update within the fetched tasks array
	let targetTask = null;
	let parentTaskForSubtask = null; // Keep track of parent if target is subtask
	let targetTaskIndex = -1;
	let targetSubtaskIndex = -1;

	if (typeof formattedTaskId === 'string' && formattedTaskId.includes('.')) {
		// Handle dot notation for subtasks (e.g., "1.2")
		const [parentId, subtaskIdNum] = formattedTaskId
			.split('.')
			.map((id) => parseInt(id, 10));
		
		const parentTaskIndex = tasks.findIndex((t) => t.id === parentId);
		if (parentTaskIndex === -1) {
			const errorMsg = `Parent task ${parentId} not found.`;
			report('error', errorMsg);
			throw new Error(errorMsg);
		}
		parentTaskForSubtask = tasks[parentTaskIndex];


		if (!parentTaskForSubtask.subtasks) {
			const errorMsg = `Parent task ${parentId} has no subtasks.`;
			report('error', errorMsg);
			throw new Error(errorMsg);
		}

		targetSubtaskIndex = parentTaskForSubtask.subtasks.findIndex((s) => s.id === subtaskIdNum);
		if (targetSubtaskIndex === -1) {
			const errorMsg = `Subtask ${formattedTaskId} not found.`;
			report('error', errorMsg);
			throw new Error(errorMsg);
		}
		targetTask = parentTaskForSubtask.subtasks[targetSubtaskIndex];

	} else {
		// Regular task (not a subtask)
		targetTaskIndex = tasks.findIndex((t) => t.id === formattedTaskId);
		if (targetTaskIndex === -1) {
			const errorMsg = `Task ${formattedTaskId} not found.`;
			report('error', errorMsg);
			throw new Error(errorMsg);
		}
		targetTask = tasks[targetTaskIndex];
	}

	// --- Dependency checks (using targetTask and fetched tasks) ---
	
	// Initialize dependencies array if it doesn't exist
	if (!targetTask.dependencies) {
		targetTask.dependencies = [];
	}

	// Check if dependency already exists
	if (
		targetTask.dependencies.some((d) => String(d) === String(formattedDependencyId))
	) {
		report('warn', `Dependency ${formattedDependencyId} already exists in task ${formattedTaskId}.`);
		return { success: false, message: 'Dependency already exists.' }; // Return info instead of exiting
	}

	// Check self-dependency
	if (String(formattedTaskId) === String(formattedDependencyId)) {
		const errorMsg = `Task ${formattedTaskId} cannot depend on itself.`;
		report('error', errorMsg);
		throw new Error(errorMsg);
	}

	// Check for circular dependencies: Does the new dependencyId eventually depend back on taskId?
	// Start the check from the dependencyId, initializing the chain with the taskId.
	// Pass a CLONE of tasks to prevent unexpected mutations affecting the check.
	if (isCircularDependency(JSON.parse(JSON.stringify(tasks)), formattedDependencyId, [formattedTaskId])) { 
		const errorMsg = `Cannot add dependency ${formattedDependencyId} to task ${formattedTaskId} as it would create a circular dependency.`;
		report('error', errorMsg);
		throw new Error(errorMsg);
	}
	
	// --- Add Dependency and Persist ---

	// Add the dependency to the targetTask object (in memory)
	targetTask.dependencies.push(formattedDependencyId);

	// Sort dependencies
	targetTask.dependencies.sort((a, b) => {
		if (typeof a === 'number' && typeof b === 'number') {
			return a - b;
		} else if (typeof a === 'string' && typeof b === 'string') {
			const [aParent, aChild] = a.split('.').map(Number);
			const [bParent, bChild] = b.split('.').map(Number);
			return aParent !== bParent ? aParent - bParent : aChild - bChild;
		} else if (typeof a === 'number') {
			return -1; // Numbers come before strings
		} else {
			return 1; // Strings come after numbers
		}
	});

	// Persist the change using the Task Provider's updateTask method
	try {
		// Pass the updated dependencies list to the provider
		// Note: The provider's updateTask needs to handle this field update.
		// For Jira, this might mean updating issue links.
		// For Local, it means finding the task/subtask and updating its dependencies array.
		await taskProvider.updateTask(formattedTaskId, { dependencies: targetTask.dependencies });

		report('success', `Added dependency ${formattedDependencyId} to task ${formattedTaskId} via ${taskProvider.constructor.name}`);

		// Display success message only if not in silent mode
		if (!isSilentMode()) {
			console.log(
				boxen(
					chalk.green(`Successfully added dependency:\\n\\n`) +
						`Task ${chalk.bold(formattedTaskId)} now depends on ${chalk.bold(formattedDependencyId)}`,
					{
						padding: 1,
						borderColor: 'green',
						borderStyle: 'round',
						margin: { top: 1 }
					}
				)
			);
		}

		// Generate updated task files ONLY for the local provider
		if (taskProvider && taskProvider.constructor.name === 'LocalTaskManager') {
			// Assuming LocalTaskManager exposes generateTaskFiles or we call it via provider interface
			try {
				report('info', 'Generating local task files after adding dependency...');
				// Assuming provider interface includes generateTaskFiles
				await taskProvider.generateTaskFiles(path.dirname(taskProvider.tasksPath), { mcpLog });
			} catch (genError) {
				report('warn', `Failed to regenerate task files: ${genError.message}`);
			}
		}
		
		return { success: true, message: 'Dependency added successfully.' };

	} catch (updateError) {
		report('error', `Failed to update task ${formattedTaskId} via provider: ${updateError.message}`);
		// Consider reverting the in-memory change if necessary, although it's complex.
		throw updateError; // Rethrow the error from the provider update
	}
} // End of addDependency function

/**
 * Remove a dependency from a task using a Task Provider.
 * @param {number|string} taskId - ID of the task to remove dependency from.
 * @param {number|string} dependencyId - ID of the task to remove as dependency.
 * @param {object} options - Options object.
 * @param {object} options.taskProvider - The task provider instance.
 * @param {object} [options.mcpLog] - Optional logger for MCP context.
 * @param {object} [options.session] - Optional session object for context.
 */
async function removeDependency(taskId, dependencyId, options = {}) {
	const { taskProvider, mcpLog } = options;
	const report = mcpLog || log; // Use MCP log if available

	if (!taskProvider) {
		throw new Error("Task provider is required in options for removeDependency.");
	}

	report('info', `Removing dependency ${dependencyId} from task ${taskId} via ${taskProvider.constructor.name}...`);

	// Fetch all tasks using the provider
	let allTasksData;
	try {
		allTasksData = await taskProvider.getTasks();
	} catch (error) {
		report('error', `Failed to fetch tasks using provider: ${error.message}`);
		throw error; // Rethrow for now
	}

	if (!allTasksData || !allTasksData.tasks) {
		report('error', 'No valid tasks found via provider.');
		throw new Error('No valid tasks found via provider.');
	}
	const tasks = allTasksData.tasks; // Use the tasks array fetched via provider

	// Format the task and dependency IDs correctly
	const formattedTaskId =
		typeof taskId === 'string' && taskId.includes('.')
			? taskId
			: parseInt(taskId, 10);

	const formattedDependencyId = formatTaskId(dependencyId);

	// Find the task to update within the fetched tasks array
	let targetTask = null;
	let parentTaskForSubtask = null;
	let isSubtask = false; // Track if the target is a subtask

	if (typeof formattedTaskId === 'string' && formattedTaskId.includes('.')) {
		// Handle dot notation for subtasks (e.g., "1.2")
		const [parentId, subtaskIdNum] = formattedTaskId
			.split('.')
			.map((id) => parseInt(id, 10));
		
		parentTaskForSubtask = tasks.find((t) => t.id === parentId);
		if (!parentTaskForSubtask) {
			const errorMsg = `Parent task ${parentId} not found.`;
			report('error', errorMsg);
			throw new Error(errorMsg);
		}

		if (!parentTaskForSubtask.subtasks) {
			const errorMsg = `Parent task ${parentId} has no subtasks.`;
			report('error', errorMsg);
			throw new Error(errorMsg);
		}

		targetTask = parentTaskForSubtask.subtasks.find((s) => s.id === subtaskIdNum);
		isSubtask = true;

		if (!targetTask) {
			const errorMsg = `Subtask ${formattedTaskId} not found.`;
			report('error', errorMsg);
			throw new Error(errorMsg);
		}
	} else {
		// Regular task (not a subtask)
		targetTask = tasks.find((t) => t.id === formattedTaskId);
		if (!targetTask) {
			const errorMsg = `Task ${formattedTaskId} not found.`;
			report('error', errorMsg);
			throw new Error(errorMsg);
		}
	}

	// Check if the task has any dependencies
	if (!targetTask.dependencies || targetTask.dependencies.length === 0) {
		report('info', `Task ${formattedTaskId} has no dependencies, nothing to remove.`);
		return { success: true, message: 'Task has no dependencies.' }; // Indicate success, nothing done
	}

	// Normalize the dependency ID for comparison
	const normalizedDependencyId = String(formattedDependencyId);

	// Find the index of the dependency to remove
	const dependencyIndex = targetTask.dependencies.findIndex((dep) => {
		let depStr = String(dep);
		// Handle numeric subtask refs within the same parent
		if (isSubtask && typeof dep === 'number' && dep < 100) {
			const [parentId] = formattedTaskId.split('.');
			depStr = `${parentId}.${dep}`;
		}
		return depStr === normalizedDependencyId;
	});

	if (dependencyIndex === -1) {
		report('info', `Task ${formattedTaskId} does not depend on ${formattedDependencyId}, no changes made.`);
		return { success: true, message: 'Dependency not found.' }; // Indicate success, nothing done
	}

	// Remove the dependency (in memory)
	targetTask.dependencies.splice(dependencyIndex, 1);

	// Persist the change using the Task Provider's updateTask method
	try {
		// Pass the updated (shorter) dependencies list
		await taskProvider.updateTask(formattedTaskId, { dependencies: targetTask.dependencies });

		report('success', `Removed dependency ${formattedDependencyId} from task ${formattedTaskId} via ${taskProvider.constructor.name}`);

		// Display success message only if not in silent mode
		if (!isSilentMode()) {
			console.log(
				boxen(
					chalk.green(`Successfully removed dependency:\\n\\n`) +
						`Task ${chalk.bold(formattedTaskId)} no longer depends on ${chalk.bold(formattedDependencyId)}`,
					{
						padding: 1,
						borderColor: 'green',
						borderStyle: 'round',
						margin: { top: 1 }
					}
				)
			);
		}

		// Regenerate task files ONLY for the local provider
		if (taskProvider && taskProvider.constructor.name === 'LocalTaskManager') {
			// Assuming LocalTaskManager exposes generateTaskFiles or we call it via provider interface
			try {
				report('info', 'Generating local task files after removing dependency...');
				// Assuming provider interface includes generateTaskFiles
				await taskProvider.generateTaskFiles(path.dirname(taskProvider.tasksPath), { mcpLog });
			} catch (genError) {
				report('warn', `Failed to regenerate task files: ${genError.message}`);
			}
		}
		
		return { success: true, message: 'Dependency removed successfully.' };

	} catch (updateError) {
		report('error', `Failed to update task ${formattedTaskId} via provider: ${updateError.message}`);
		// Consider reverting the in-memory change if necessary.
		throw updateError; // Rethrow the error
	}
}

/**
 * Check if adding a dependency would create a circular dependency
 * @param {Array} tasks - Array of all tasks
 * @param {number|string} taskId - ID of task to check
 * @param {Array} chain - Chain of dependencies to check
 * @returns {boolean} True if circular dependency would be created
 */
function isCircularDependency(tasks, taskId, chain = []) {
	// Convert taskId to string for comparison
	const taskIdStr = String(taskId);

	// If we've seen this task before in the chain, we have a circular dependency
	const foundInChain = chain.some((id) => String(id) === taskIdStr);
	if (foundInChain) {
		return true;
	}

	// Find the task or subtask
	let task = null;
	if (taskIdStr.includes('.')) {
		const [parentId, subtaskId] = taskIdStr.split('.').map(Number);
		const parentTask = tasks.find((t) => t.id === parentId);

		if (parentTask && parentTask.subtasks) {
			task = parentTask.subtasks.find((st) => st.id === subtaskId);
		}
	} else {
		// Regular task
		task = tasks.find((t) => String(t.id) === taskIdStr);
	}

	if (!task) {
		return false; // Task doesn't exist, can't create circular dependency
	}

	// No dependencies, can't create circular dependency
	if (!task.dependencies || task.dependencies.length === 0) {
		return false;
	}

	// Check each dependency recursively
	// Ensure the ID added to the chain is always a string to match the check
	const newChain = [...chain, String(taskId)]; 
	return task.dependencies.some((depId) =>
		isCircularDependency(tasks, depId, newChain)
	);
}

/**
 * Validate task dependencies using a Task Provider.
 * @param {object} options - Options object.
 * @param {object} options.taskProvider - The task provider instance.
 * @param {object} [options.mcpLog] - Optional logger for MCP context.
 */
async function validateTaskDependencies(options = {}) {
	const { taskProvider, mcpLog } = options;
	const report = mcpLog || log; // Use MCP log if available

	if (!taskProvider) {
		throw new Error("Task provider is required in options for validateTaskDependencies.");
	}

	report('info', `Validating dependencies via ${taskProvider.constructor.name}...`);

	// Fetch tasks using the provider
	let allTasksData;
	try {
		allTasksData = await taskProvider.getTasks();
	} catch (error) {
		report('error', `Failed to fetch tasks using provider: ${error.message}`);
		throw error;
	}

	if (!allTasksData || !allTasksData.tasks) {
		report('warn', 'No valid tasks found via provider to validate.');
		return { valid: true, issues: [] }; // Return valid if no tasks
	}
	const tasks = allTasksData.tasks;

	const issues = [];

	// Check each task's dependencies
	tasks.forEach((task) => {
		if (!task.dependencies) {
			return; // No dependencies to validate
		}

		task.dependencies.forEach((depId) => {
			// Check for self-dependencies
			if (String(depId) === String(task.id)) {
				issues.push({
					type: 'self',
					taskId: task.id,
					message: `Task ${task.id} depends on itself`
				});
				return;
			}

			// Check if dependency exists
			if (!taskExists(tasks, depId)) {
				issues.push({
					type: 'missing',
					taskId: task.id,
					dependencyId: depId,
					message: `Task ${task.id} depends on non-existent task ${depId}`
				});
			}
		});

		// Check for circular dependencies
		if (isCircularDependency(tasks, task.id)) {
			issues.push({
				type: 'circular',
				taskId: task.id,
				message: `Task ${task.id} is part of a circular dependency chain`
			});
		}

		// Check subtask dependencies if they exist
		if (task.subtasks && task.subtasks.length > 0) {
			task.subtasks.forEach((subtask) => {
				if (!subtask.dependencies) {
					return; // No dependencies to validate
				}

				// Create a full subtask ID for reference
				const fullSubtaskId = `${task.id}.${subtask.id}`;

				subtask.dependencies.forEach((depId) => {
					// Check for self-dependencies in subtasks
					if (
						String(depId) === String(fullSubtaskId) ||
						(typeof depId === 'number' && depId === subtask.id)
					) {
						issues.push({
							type: 'self',
							taskId: fullSubtaskId,
							message: `Subtask ${fullSubtaskId} depends on itself`
						});
						return;
					}

					// Check if dependency exists
					if (!taskExists(tasks, depId)) {
						issues.push({
							type: 'missing',
							taskId: fullSubtaskId,
							dependencyId: depId,
							message: `Subtask ${fullSubtaskId} depends on non-existent task/subtask ${depId}`
						});
					}
				});

				// Check for circular dependencies in subtasks
				if (isCircularDependency(tasks, fullSubtaskId)) {
					issues.push({
						type: 'circular',
						taskId: fullSubtaskId,
						message: `Subtask ${fullSubtaskId} is part of a circular dependency chain`
					});
				}
			});
		}
	});

	return {
		valid: issues.length === 0,
		issues
	};
}

/**
 * Validate dependencies in task files
 * @param {string} tasksPath - Path to tasks.json
 */
async function validateDependenciesCommand(options = {}) {
	const { taskProvider, mcpLog } = options;
	const report = mcpLog || log; // Use MCP log if available

	if (!taskProvider) {
		throw new Error("Task provider is required for validateDependenciesCommand.");
	}

	// Only display banner if not in silent mode
	if (!isSilentMode()) {
		displayBanner();
	}

	report('info', `Checking for invalid dependencies via ${taskProvider.constructor.name}...`);

	// Count of tasks and subtasks for reporting (fetch fresh count)
	let taskCount = 0;
	let subtaskCount = 0;
	try {
		const currentTasksData = await taskProvider.getTasks();
		if (currentTasksData && currentTasksData.tasks) {
			taskCount = currentTasksData.tasks.length;
			currentTasksData.tasks.forEach((task) => {
				if (task.subtasks && Array.isArray(task.subtasks)) {
					subtaskCount += task.subtasks.length;
				}
			});
		}
	} catch (fetchError) {
		report('warn', `Could not fetch task counts for reporting: ${fetchError.message}`);
	}

	report(
		'info',
		`Analyzing dependencies for ${taskCount} tasks and ${subtaskCount} subtasks...`
	);

	// Run validation using the provider
	try {
		const validationResult = await validateTaskDependencies({ taskProvider, mcpLog });

		// Report results
		if (validationResult.valid) {
			report('success', 'No invalid dependencies found - all dependencies are valid');
			// Show validation summary - only if not in silent mode
			if (!isSilentMode()) {
				console.log(
					boxen(
						chalk.green(`All Dependencies Are Valid\n\n`) +
							`${chalk.cyan('Tasks checked:')} ${taskCount}\n` +
							`${chalk.cyan('Subtasks checked:')} ${subtaskCount}\n` +
							`${chalk.cyan('Total dependencies verified:')} ${countAllDependencies(await taskProvider.getTasks().tasks || [])}`,
						{
							padding: 1,
							borderColor: 'green',
							borderStyle: 'round',
							margin: { top: 1, bottom: 1 }
						}
					)
				);
			}
		} else {
			report('warn', `Found ${validationResult.issues.length} dependency issues.`);
			// Display issues - only if not in silent mode
			if (!isSilentMode()) {
				console.log(chalk.yellow('\nDependency Issues Found:'));
				validationResult.issues.forEach(issue => {
					console.log(`  - Task ${chalk.bold(issue.taskId)}: ${issue.message} (${chalk.red(issue.type)})`);
				});
				console.log(chalk.yellow('\nRun `task-master fix-dependencies` to attempt automatic correction.'));
			}
		}
	} catch (error) {
		report('error', `Error validating dependencies via provider: ${error.message}`);
		// Decide how to handle - maybe rethrow for CLI/MCP
		throw error;
	}
}

/**
 * Helper function to count all dependencies across tasks and subtasks
 * @param {Array} tasks - All tasks
 * @returns {number} - Total number of dependencies
 */
function countAllDependencies(tasks) {
	let count = 0;

	tasks.forEach((task) => {
		// Count main task dependencies
		if (task.dependencies && Array.isArray(task.dependencies)) {
			count += task.dependencies.length;
		}

		// Count subtask dependencies
		if (task.subtasks && Array.isArray(task.subtasks)) {
			task.subtasks.forEach((subtask) => {
				if (subtask.dependencies && Array.isArray(subtask.dependencies)) {
					count += subtask.dependencies.length;
				}
			});
		}
	});

	return count;
}

/**
 * Fixes invalid dependencies using the configured Task Provider.
 * Currently, saving fixes is only supported for the LocalTaskManager.
 * @param {object} options - Options object.
 * @param {object} options.taskProvider - The Task Provider instance.
 * @param {object} [options.mcpLog] - Optional logger for MCP context.
 */
async function fixDependenciesCommand(options = {}) {
	const { taskProvider, mcpLog } = options;
	const report = mcpLog || log; // Use MCP log if available

	if (!taskProvider) {
		throw new Error("Task provider is required for fixDependenciesCommand.");
	}

	// Only display banner if not in silent mode
	if (!isSilentMode()) {
		displayBanner();
	}

	report('info', `Checking for and fixing invalid dependencies via ${taskProvider.constructor.name}...`);

	try {
		// Read tasks data via provider
		const data = await taskProvider.getTasks();
		if (!data || !data.tasks) {
			report('error', 'No valid tasks found via provider.');
			return { success: false, message: 'No tasks found.' };
		}

		// Create a deep copy of the original data for comparison
		const originalDataString = JSON.stringify(data); // Stringify for easy comparison later
		const workingData = JSON.parse(originalDataString); // Work on a copy

		// Track fixes for reporting
		const stats = {
			nonExistentDependenciesRemoved: 0,
			selfDependenciesRemoved: 0,
			duplicateDependenciesRemoved: 0,
			circularDependenciesFixed: 0,
			tasksFixed: 0,
			subtasksFixed: 0
		};

		// First phase: Remove duplicate dependencies (operates on workingData.tasks)
		workingData.tasks.forEach((task) => {
			if (task.dependencies && Array.isArray(task.dependencies)) {
				const uniqueDeps = new Set();
				const originalLength = task.dependencies.length;
				task.dependencies = task.dependencies.filter((depId) => {
					const depIdStr = String(depId);
					if (uniqueDeps.has(depIdStr)) {
						report(
							'info',
							`Removing duplicate dependency from task ${task.id}: ${depId}`
						);
						stats.duplicateDependenciesRemoved++;
						return false;
					}
					uniqueDeps.add(depIdStr);
					return true;
				});
				if (task.dependencies.length < originalLength) {
					stats.tasksFixed++;
				}
			}

			// Check for duplicates in subtasks
			if (task.subtasks && Array.isArray(task.subtasks)) {
				task.subtasks.forEach((subtask) => {
					if (subtask.dependencies && Array.isArray(subtask.dependencies)) {
						const uniqueDeps = new Set();
						const originalLength = subtask.dependencies.length;
						subtask.dependencies = subtask.dependencies.filter((depId) => {
							let depIdStr = String(depId);
							if (typeof depId === 'number' && depId < 100) {
								depIdStr = `${task.id}.${depId}`;
							}
							if (uniqueDeps.has(depIdStr)) {
								report(
									'info',
									`Removing duplicate dependency from subtask ${task.id}.${subtask.id}: ${depId}`
								);
								stats.duplicateDependenciesRemoved++;
								return false;
							}
							uniqueDeps.add(depIdStr);
							return true;
						});
						if (subtask.dependencies.length < originalLength) {
							stats.subtasksFixed++;
						}
					}
				});
			}
		});

		// Create validity maps based on workingData
		const validTaskIds = new Set(workingData.tasks.map((t) => t.id));
		const validSubtaskIds = new Set();
		workingData.tasks.forEach((task) => {
			if (task.subtasks && Array.isArray(task.subtasks)) {
				task.subtasks.forEach((subtask) => {
					validSubtaskIds.add(`${task.id}.${subtask.id}`);
				});
			}
		});

		// Second phase: Remove invalid task dependencies (operates on workingData.tasks)
		workingData.tasks.forEach((task) => {
			if (task.dependencies && Array.isArray(task.dependencies)) {
				const originalLength = task.dependencies.length;
				task.dependencies = task.dependencies.filter((depId) => {
					const isSubtask = typeof depId === 'string' && depId.includes('.');

					if (isSubtask) {
						// Check if the subtask exists
						if (!validSubtaskIds.has(depId)) {
							report(
								'info',
								`Removing invalid subtask dependency from task ${task.id}: ${depId} (subtask does not exist)`
							);
							stats.nonExistentDependenciesRemoved++;
							return false;
						}
						return true;
					} else {
						// Check if the task exists
						const numericId =
							typeof depId === 'string' ? parseInt(depId, 10) : depId;
						if (!validTaskIds.has(numericId)) {
							report(
								'info',
								`Removing invalid task dependency from task ${task.id}: ${depId} (task does not exist)`
							);
							stats.nonExistentDependenciesRemoved++;
							return false;
						}
						return true;
					}
				});

				if (task.dependencies.length < originalLength) {
					stats.tasksFixed++;
				}
			}

			// Check subtask dependencies for invalid references
			if (task.subtasks && Array.isArray(task.subtasks)) {
				task.subtasks.forEach((subtask) => {
					if (subtask.dependencies && Array.isArray(subtask.dependencies)) {
						const originalLength = subtask.dependencies.length;
						const subtaskId = `${task.id}.${subtask.id}`;

						// First check for self-dependencies
						const hasSelfDependency = subtask.dependencies.some((depId) => {
							if (typeof depId === 'string' && depId.includes('.')) {
								return depId === subtaskId;
							} else if (typeof depId === 'number' && depId < 100) {
								return depId === subtask.id;
							}
							return false;
						});

						if (hasSelfDependency) {
							subtask.dependencies = subtask.dependencies.filter((depId) => {
								const normalizedDepId =
									typeof depId === 'number' && depId < 100
										? `${task.id}.${depId}`
										: String(depId);

								if (normalizedDepId === subtaskId) {
									report(
										'info',
										`Removing self-dependency from subtask ${subtaskId}`
									);
									stats.selfDependenciesRemoved++;
									return false;
								}
								return true;
							});
						}

						// Then check for non-existent dependencies
						subtask.dependencies = subtask.dependencies.filter((depId) => {
							if (typeof depId === 'string' && depId.includes('.')) {
								if (!validSubtaskIds.has(depId)) {
									report(
										'info',
										`Removing invalid subtask dependency from subtask ${subtaskId}: ${depId} (subtask does not exist)`
									);
									stats.nonExistentDependenciesRemoved++;
									return false;
								}
								return true;
							}

							// Handle numeric dependencies
							const numericId =
								typeof depId === 'number' ? depId : parseInt(depId, 10);

							// Small numbers likely refer to subtasks in the same task
							if (numericId < 100) {
								const fullSubtaskId = `${task.id}.${numericId}`;

								if (!validSubtaskIds.has(fullSubtaskId)) {
									report(
										'info',
										`Removing invalid subtask dependency from subtask ${subtaskId}: ${numericId}`
									);
									stats.nonExistentDependenciesRemoved++;
									return false;
								}

								return true;
							}

							// Otherwise it's a task reference
							if (!validTaskIds.has(numericId)) {
								report(
									'info',
									`Removing invalid task dependency from subtask ${subtaskId}: ${numericId}`
								);
								stats.nonExistentDependenciesRemoved++;
								return false;
							}

							return true;
						});

						if (subtask.dependencies.length < originalLength) {
							stats.subtasksFixed++;
						}
					}
				});
			}
		});

		// Third phase: Check for circular dependencies (operates on workingData.tasks)
		report('info', 'Checking for circular dependencies...');

		// Build the dependency map for subtasks from workingData
		const subtaskDependencyMap = new Map();
		workingData.tasks.forEach((task) => {
			if (task.subtasks && Array.isArray(task.subtasks)) {
				task.subtasks.forEach((subtask) => {
					const subtaskId = `${task.id}.${subtask.id}`;

					if (subtask.dependencies && Array.isArray(subtask.dependencies)) {
						const normalizedDeps = subtask.dependencies.map((depId) => {
							if (typeof depId === 'string' && depId.includes('.')) {
								return depId;
							} else if (typeof depId === 'number' && depId < 100) {
								return `${task.id}.${depId}`;
							}
							return String(depId);
						});
						subtaskDependencyMap.set(subtaskId, normalizedDeps);
					} else {
						subtaskDependencyMap.set(subtaskId, []);
					}
				});
			}
		});

		// Check for and fix circular dependencies (operates on workingData.tasks)
		for (const [subtaskId, dependencies] of subtaskDependencyMap.entries()) {
			const visited = new Set();
			const recursionStack = new Set();

			// Detect cycles
			const cycleEdges = findCycles(
				subtaskId,
				subtaskDependencyMap,
				visited,
				recursionStack
			);

			if (cycleEdges.length > 0) {
				const [taskId, subtaskNum] = subtaskId
					.split('.')
					.map((part) => Number(part));
				const task = workingData.tasks.find((t) => t.id === taskId);

				if (task && task.subtasks) {
					const subtask = task.subtasks.find((st) => st.id === subtaskNum);

					if (subtask && subtask.dependencies) {
						const originalLength = subtask.dependencies.length;

						const edgesToRemove = cycleEdges.map((edge) => {
							if (edge.includes('.')) {
								const [depTaskId, depSubtaskId] = edge
									.split('.')
									.map((part) => Number(part));

								if (depTaskId === taskId) {
									return depSubtaskId;
								}

								return edge;
							}

							return Number(edge);
						});

						subtask.dependencies = subtask.dependencies.filter((depId) => {
							const normalizedDepId =
								typeof depId === 'number' && depId < 100
									? `${taskId}.${depId}`
									: String(depId);

							if (
								edgesToRemove.includes(depId) ||
								edgesToRemove.includes(normalizedDepId)
							) {
								report(
									'info',
									`Breaking circular dependency: Removing ${normalizedDepId} from subtask ${subtaskId}`
								);
								stats.circularDependenciesFixed++;
								return false;
							}
							return true;
						});

						if (subtask.dependencies.length < originalLength) {
							stats.subtasksFixed++;
						}
					}
				}
			}
		}

		// Check if any changes were made by comparing the modified workingData with original
		const dataChanged = JSON.stringify(workingData) !== originalDataString;

		if (dataChanged) {
			// --- Save Changes (Provider Specific) ---
			if (taskProvider && taskProvider.constructor.name === 'LocalTaskManager') {
				// For local provider, overwrite the tasks.json file
				const localTasksPath = taskProvider.tasksPath || path.join(taskProvider.projectRoot, 'tasks/tasks.json');
				try {
					writeJSON(localTasksPath, workingData);
					report('success', `Fixed dependency issues saved to ${localTasksPath}`);

					// Regenerate task files using the provider method
					report('info', 'Regenerating local task files...');
					await taskProvider.generateTaskFiles(path.dirname(localTasksPath), { mcpLog });
				} catch (writeError) {
					report('error', `Failed to save fixed tasks to ${localTasksPath}: ${writeError.message}`);
					// Decide if we should throw here or just report error
					throw writeError;
				}
			} else {
				// For other providers (like Jira), saving bulk fixes isn't directly supported yet.
				report('warn', `Dependency issues detected, but automatic saving of fixes is currently only supported for the Local file provider. Provider detected: ${taskProvider ? taskProvider.constructor.name : 'Unknown'}`);
				// We don't attempt to save via JiraTaskManager as it would require complex logic
			}
		} else {
			report('info', 'No changes needed to fix dependencies');
		}

		// Show detailed statistics report (using fetched task counts)
		const finalTaskCount = workingData.tasks.length;
		const finalSubtaskCount = workingData.tasks.reduce((sum, t) => sum + (t.subtasks?.length || 0), 0);
		const totalFixedAll =
			stats.nonExistentDependenciesRemoved +
			stats.selfDependenciesRemoved +
			stats.duplicateDependenciesRemoved +
			stats.circularDependenciesFixed;

		if (totalFixedAll > 0) {
			report('success', `Fixed ${totalFixedAll} dependency issues in total!`);

			console.log(
				boxen(
					chalk.green(`Dependency Fixes Summary:\n\n`) +
						`${chalk.cyan('Invalid dependencies removed:')} ${stats.nonExistentDependenciesRemoved}\n` +
						`${chalk.cyan('Self-dependencies removed:')} ${stats.selfDependenciesRemoved}\n` +
						`${chalk.cyan('Duplicate dependencies removed:')} ${stats.duplicateDependenciesRemoved}\n` +
						`${chalk.cyan('Circular dependencies fixed:')} ${stats.circularDependenciesFixed}\n\n` +
						`${chalk.cyan('Tasks fixed:')} ${stats.tasksFixed}\n` +
						`${chalk.cyan('Subtasks fixed:')} ${stats.subtasksFixed}\n`,
					{
						padding: 1,
						borderColor: 'green',
						borderStyle: 'round',
						margin: { top: 1, bottom: 1 }
					}
				)
			);
		} else {
			report(
				'success',
				'No dependency issues found - all dependencies are valid'
			);

			console.log(
				boxen(
					chalk.green(`All Dependencies Are Valid\n\n`) +
						`${chalk.cyan('Tasks checked:')} ${finalTaskCount}\n` +
						`${chalk.cyan('Total dependencies verified:')} ${countAllDependencies(workingData.tasks)}`,
					{
						padding: 1,
						borderColor: 'green',
						borderStyle: 'round',
						margin: { top: 1, bottom: 1 }
					}
				)
			);
		}

		return { success: true, changesMade: dataChanged, stats: totalFixedAll > 0 ? stats : null };

	} catch (error) {
		report('error', `Error in fix-dependencies command via provider: ${error.message}`);
		// Rethrow for CLI/MCP handling
		throw error;
	}
}

/**
 * Ensure at least one subtask in each task has no dependencies
 * @param {Object} tasksData - The tasks data object with tasks array
 * @returns {boolean} - True if any changes were made
 */
function ensureAtLeastOneIndependentSubtask(tasksData) {
	if (!tasksData || !tasksData.tasks || !Array.isArray(tasksData.tasks)) {
		return false;
	}

	let changesDetected = false;

	tasksData.tasks.forEach((task) => {
		if (
			!task.subtasks ||
			!Array.isArray(task.subtasks) ||
			task.subtasks.length === 0
		) {
			return;
		}

		// Check if any subtask has no dependencies
		const hasIndependentSubtask = task.subtasks.some(
			(st) =>
				!st.dependencies ||
				!Array.isArray(st.dependencies) ||
				st.dependencies.length === 0
		);

		if (!hasIndependentSubtask) {
			// Find the first subtask and clear its dependencies
			if (task.subtasks.length > 0) {
				const firstSubtask = task.subtasks[0];
				log(
					'debug',
					`Ensuring at least one independent subtask: Clearing dependencies for subtask ${task.id}.${firstSubtask.id}`
				);
				firstSubtask.dependencies = [];
				changesDetected = true;
			}
		}
	});

	return changesDetected;
}

/**
 * Validate and fix dependencies across all tasks and subtasks
 * This function is designed to be called after any task modification
 * @param {Object} tasksData - The tasks data object with tasks array
 * @param {string} tasksPath - Optional path to save the changes
 * @returns {boolean} - True if any changes were made
 */
function validateAndFixDependencies(tasksData, tasksPath = null) {
	if (!tasksData || !tasksData.tasks || !Array.isArray(tasksData.tasks)) {
		log('error', 'Invalid tasks data');
		return false;
	}

	log('debug', 'Validating and fixing dependencies...');

	// Create a deep copy for comparison
	const originalData = JSON.parse(JSON.stringify(tasksData));

	// 1. Remove duplicate dependencies from tasks and subtasks
	tasksData.tasks = tasksData.tasks.map((task) => {
		// Handle task dependencies
		if (task.dependencies) {
			const uniqueDeps = [...new Set(task.dependencies)];
			task.dependencies = uniqueDeps;
		}

		// Handle subtask dependencies
		if (task.subtasks) {
			task.subtasks = task.subtasks.map((subtask) => {
				if (subtask.dependencies) {
					const uniqueDeps = [...new Set(subtask.dependencies)];
					subtask.dependencies = uniqueDeps;
				}
				return subtask;
			});
		}
		return task;
	});

	// 2. Remove invalid task dependencies (non-existent tasks)
	tasksData.tasks.forEach((task) => {
		// Clean up task dependencies
		if (task.dependencies) {
			task.dependencies = task.dependencies.filter((depId) => {
				// Remove self-dependencies
				if (String(depId) === String(task.id)) {
					return false;
				}
				// Remove non-existent dependencies
				return taskExists(tasksData.tasks, depId);
			});
		}

		// Clean up subtask dependencies
		if (task.subtasks) {
			task.subtasks.forEach((subtask) => {
				if (subtask.dependencies) {
					subtask.dependencies = subtask.dependencies.filter((depId) => {
						// Handle numeric subtask references
						if (typeof depId === 'number' && depId < 100) {
							const fullSubtaskId = `${task.id}.${depId}`;
							return taskExists(tasksData.tasks, fullSubtaskId);
						}
						// Handle full task/subtask references
						return taskExists(tasksData.tasks, depId);
					});
				}
			});
		}
	});

	// 3. Ensure at least one subtask has no dependencies in each task
	tasksData.tasks.forEach((task) => {
		if (task.subtasks && task.subtasks.length > 0) {
			const hasIndependentSubtask = task.subtasks.some(
				(st) =>
					!st.dependencies ||
					!Array.isArray(st.dependencies) ||
					st.dependencies.length === 0
			);

			if (!hasIndependentSubtask) {
				task.subtasks[0].dependencies = [];
			}
		}
	});

	// Check if any changes were made by comparing with original data
	const changesDetected =
		JSON.stringify(tasksData) !== JSON.stringify(originalData);

	// Save changes if needed
	if (tasksPath && changesDetected) {
		try {
			writeJSON(tasksPath, tasksData);
			log('debug', 'Saved dependency fixes to tasks.json');
		} catch (error) {
			log('error', 'Failed to save dependency fixes to tasks.json', error);
		}
	}

	return changesDetected;
}

export {
	addDependency,
	removeDependency,
	isCircularDependency,
	validateTaskDependencies,
	validateDependenciesCommand,
	fixDependenciesCommand,
	ensureAtLeastOneIndependentSubtask,
	validateAndFixDependencies
};
