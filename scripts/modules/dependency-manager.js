/**
 * dependency-manager.js
 * Manages task dependencies and relationships
 */

import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';

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

import { generateTaskFiles } from './task-manager.js';

/**
 * Add dependencies to task(s). Supports single IDs, ranges, and comma-separated lists.
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number|string} taskId - Task ID(s) (e.g., "7", "7-10", "7,8,9")
 * @param {number|string} dependencyId - Dependency ID(s) (e.g., "1", "1-5", "1,3,5")
 */
async function addDependency(tasksPath, taskId, dependencyId) {
	// Check if we're dealing with multiple IDs by attempting to parse them
	try {
		const taskIds = parseBulkTaskIds(String(taskId));
		const dependencyIds = parseBulkTaskIds(String(dependencyId));

		// If either has multiple IDs, use bulk processing
		if (taskIds.length > 1 || dependencyIds.length > 1) {
			log(
				'info',
				`Adding dependencies in bulk: ${dependencyIds.join(', ')} to tasks ${taskIds.join(', ')}...`
			);

			const result = await bulkAddDependencies(
				tasksPath,
				String(taskId),
				String(dependencyId),
				{
					silent: false
				}
			);

			if (!result.success) {
				log('error', `Bulk add dependencies failed: ${result.error}`);
				process.exit(1);
			}

			return;
		}

		// Single IDs - use the original logic with first elements
		taskId = taskIds[0];
		dependencyId = dependencyIds[0];
	} catch (error) {
		// If parsing fails, treat as single IDs (original behavior)
		// This maintains backward compatibility for non-bulk format IDs
	}

	// Original single-task logic
	log('info', `Adding dependency ${dependencyId} to task ${taskId}...`);

	const data = readJSON(tasksPath);
	if (!data || !data.tasks) {
		log('error', 'No valid tasks found in tasks.json');
		process.exit(1);
	}

	// Format the task and dependency IDs correctly
	const formattedTaskId =
		typeof taskId === 'string' && taskId.includes('.')
			? taskId
			: parseInt(taskId, 10);

	const formattedDependencyId = formatTaskId(dependencyId);

	// Check if the dependency task or subtask actually exists
	if (!taskExists(data.tasks, formattedDependencyId)) {
		log(
			'error',
			`Dependency target ${formattedDependencyId} does not exist in tasks.json`
		);
		process.exit(1);
	}

	// Find the task to update
	let targetTask = null;
	let isSubtask = false;

	if (typeof formattedTaskId === 'string' && formattedTaskId.includes('.')) {
		// Handle dot notation for subtasks (e.g., "1.2")
		const [parentId, subtaskId] = formattedTaskId
			.split('.')
			.map((id) => parseInt(id, 10));
		const parentTask = data.tasks.find((t) => t.id === parentId);

		if (!parentTask) {
			log('error', `Parent task ${parentId} not found.`);
			process.exit(1);
		}

		if (!parentTask.subtasks) {
			log('error', `Parent task ${parentId} has no subtasks.`);
			process.exit(1);
		}

		targetTask = parentTask.subtasks.find((s) => s.id === subtaskId);
		isSubtask = true;

		if (!targetTask) {
			log('error', `Subtask ${formattedTaskId} not found.`);
			process.exit(1);
		}
	} else {
		// Regular task (not a subtask)
		targetTask = data.tasks.find((t) => t.id === formattedTaskId);

		if (!targetTask) {
			log('error', `Task ${formattedTaskId} not found.`);
			process.exit(1);
		}
	}

	// Initialize dependencies array if it doesn't exist
	if (!targetTask.dependencies) {
		targetTask.dependencies = [];
	}

	// Check if dependency already exists
	if (
		targetTask.dependencies.some((d) => {
			// Convert both to strings for comparison to handle both numeric and string IDs
			return String(d) === String(formattedDependencyId);
		})
	) {
		log(
			'warn',
			`Dependency ${formattedDependencyId} already exists in task ${formattedTaskId}.`
		);
		return;
	}

	// Check if the task is trying to depend on itself - compare full IDs (including subtask parts)
	if (String(formattedTaskId) === String(formattedDependencyId)) {
		log('error', `Task ${formattedTaskId} cannot depend on itself.`);
		process.exit(1);
	}

	// For subtasks of the same parent, we need to make sure we're not treating it as a self-dependency
	// Check if we're dealing with subtasks with the same parent task
	let isSelfDependency = false;

	if (
		typeof formattedTaskId === 'string' &&
		typeof formattedDependencyId === 'string' &&
		formattedTaskId.includes('.') &&
		formattedDependencyId.includes('.')
	) {
		const [taskParentId] = formattedTaskId.split('.');
		const [depParentId] = formattedDependencyId.split('.');

		// Only treat it as a self-dependency if both the parent ID and subtask ID are identical
		isSelfDependency = formattedTaskId === formattedDependencyId;

		// Log for debugging
		log(
			'debug',
			`Adding dependency between subtasks: ${formattedTaskId} depends on ${formattedDependencyId}`
		);
		log(
			'debug',
			`Parent IDs: ${taskParentId} and ${depParentId}, Self-dependency check: ${isSelfDependency}`
		);
	}

	if (isSelfDependency) {
		log('error', `Subtask ${formattedTaskId} cannot depend on itself.`);
		process.exit(1);
	}

	// Check for circular dependencies
	let dependencyChain = [formattedTaskId];
	if (
		!isCircularDependency(data.tasks, formattedDependencyId, dependencyChain)
	) {
		// Add the dependency
		targetTask.dependencies.push(formattedDependencyId);

		// Sort dependencies numerically or by parent task ID first, then subtask ID
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

		// Save changes
		writeJSON(tasksPath, data);
		log(
			'success',
			`Added dependency ${formattedDependencyId} to task ${formattedTaskId}`
		);

		// Display a more visually appealing success message
		if (!isSilentMode()) {
			console.log(
				boxen(
					chalk.green(`Successfully added dependency:\n\n`) +
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

		// Generate updated task files
		await generateTaskFiles(tasksPath, path.dirname(tasksPath));

		log('info', 'Task files regenerated with updated dependencies.');
	} else {
		log(
			'error',
			`Cannot add dependency ${formattedDependencyId} to task ${formattedTaskId} as it would create a circular dependency.`
		);
		process.exit(1);
	}
}

/**
 * Remove dependencies from task(s). Supports single IDs, ranges, and comma-separated lists.
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number|string} taskId - Task ID(s) (e.g., "7", "7-10", "7,8,9")
 * @param {number|string} dependencyId - Dependency ID(s) (e.g., "1", "1-5", "1,3,5")
 */
async function removeDependency(tasksPath, taskId, dependencyId) {
	// Check if we're dealing with multiple IDs by attempting to parse them
	try {
		const taskIds = parseBulkTaskIds(String(taskId));
		const dependencyIds = parseBulkTaskIds(String(dependencyId));

		// If either has multiple IDs, use bulk processing
		if (taskIds.length > 1 || dependencyIds.length > 1) {
			log(
				'info',
				`Removing dependencies in bulk: ${dependencyIds.join(', ')} from tasks ${taskIds.join(', ')}...`
			);

			const result = await bulkRemoveDependencies(
				tasksPath,
				String(taskId),
				String(dependencyId),
				{
					silent: false
				}
			);

			if (!result.success) {
				log('error', `Bulk remove dependencies failed: ${result.error}`);
				process.exit(1);
			}

			return;
		}

		// Single IDs - use the original logic with first elements
		taskId = taskIds[0];
		dependencyId = dependencyIds[0];
	} catch (error) {
		// If parsing fails, treat as single IDs (original behavior)
		// This maintains backward compatibility for non-bulk format IDs
	}

	// Original single-task logic
	log('info', `Removing dependency ${dependencyId} from task ${taskId}...`);

	// Read tasks file
	const data = readJSON(tasksPath);
	if (!data || !data.tasks) {
		log('error', 'No valid tasks found.');
		process.exit(1);
	}

	// Format the task and dependency IDs correctly
	const formattedTaskId =
		typeof taskId === 'string' && taskId.includes('.')
			? taskId
			: parseInt(taskId, 10);

	const formattedDependencyId = formatTaskId(dependencyId);

	// Find the task to update
	let targetTask = null;
	let isSubtask = false;

	if (typeof formattedTaskId === 'string' && formattedTaskId.includes('.')) {
		// Handle dot notation for subtasks (e.g., "1.2")
		const [parentId, subtaskId] = formattedTaskId
			.split('.')
			.map((id) => parseInt(id, 10));
		const parentTask = data.tasks.find((t) => t.id === parentId);

		if (!parentTask) {
			log('error', `Parent task ${parentId} not found.`);
			process.exit(1);
		}

		if (!parentTask.subtasks) {
			log('error', `Parent task ${parentId} has no subtasks.`);
			process.exit(1);
		}

		targetTask = parentTask.subtasks.find((s) => s.id === subtaskId);
		isSubtask = true;

		if (!targetTask) {
			log('error', `Subtask ${formattedTaskId} not found.`);
			process.exit(1);
		}
	} else {
		// Regular task (not a subtask)
		targetTask = data.tasks.find((t) => t.id === formattedTaskId);

		if (!targetTask) {
			log('error', `Task ${formattedTaskId} not found.`);
			process.exit(1);
		}
	}

	// Check if the task has any dependencies
	if (!targetTask.dependencies || targetTask.dependencies.length === 0) {
		log(
			'info',
			`Task ${formattedTaskId} has no dependencies, nothing to remove.`
		);
		return;
	}

	// Normalize the dependency ID for comparison to handle different formats
	const normalizedDependencyId = String(formattedDependencyId);

	// Check if the dependency exists by comparing string representations
	const dependencyIndex = targetTask.dependencies.findIndex((dep) => {
		// Convert both to strings for comparison
		let depStr = String(dep);

		// Special handling for numeric IDs that might be subtask references
		if (typeof dep === 'number' && dep < 100 && isSubtask) {
			// It's likely a reference to another subtask in the same parent task
			// Convert to full format for comparison (e.g., 2 -> "1.2" for a subtask in task 1)
			const [parentId] = formattedTaskId.split('.');
			depStr = `${parentId}.${dep}`;
		}

		return depStr === normalizedDependencyId;
	});

	if (dependencyIndex === -1) {
		log(
			'info',
			`Task ${formattedTaskId} does not depend on ${formattedDependencyId}, no changes made.`
		);
		return;
	}

	// Remove the dependency
	targetTask.dependencies.splice(dependencyIndex, 1);

	// Save the updated tasks
	writeJSON(tasksPath, data);

	// Success message
	log(
		'success',
		`Removed dependency: Task ${formattedTaskId} no longer depends on ${formattedDependencyId}`
	);

	if (!isSilentMode()) {
		// Display a more visually appealing success message
		console.log(
			boxen(
				chalk.green(`Successfully removed dependency:\n\n`) +
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

	// Regenerate task files
	await generateTaskFiles(tasksPath, path.dirname(tasksPath));
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
	if (chain.some((id) => String(id) === taskIdStr)) {
		return true;
	}

	// Find the task or subtask
	let task = null;
	let parentIdForSubtask = null;

	// Check if this is a subtask reference (e.g., "1.2")
	if (taskIdStr.includes('.')) {
		const [parentId, subtaskId] = taskIdStr.split('.').map(Number);
		const parentTask = tasks.find((t) => t.id === parentId);
		parentIdForSubtask = parentId; // Store parent ID if it's a subtask

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
	const newChain = [...chain, taskIdStr]; // Use taskIdStr for consistency
	return task.dependencies.some((depId) => {
		let normalizedDepId = String(depId);
		// Normalize relative subtask dependencies
		if (typeof depId === 'number' && parentIdForSubtask !== null) {
			// If the current task is a subtask AND the dependency is a number,
			// assume it refers to a sibling subtask.
			normalizedDepId = `${parentIdForSubtask}.${depId}`;
		}
		// Pass the normalized ID to the recursive call
		return isCircularDependency(tasks, normalizedDepId, newChain);
	});
}

/**
 * Validate task dependencies
 * @param {Array} tasks - Array of all tasks
 * @returns {Object} Validation result with valid flag and issues array
 */
function validateTaskDependencies(tasks) {
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
 * Remove duplicate dependencies from tasks
 * @param {Object} tasksData - Tasks data object with tasks array
 * @returns {Object} Updated tasks data with duplicates removed
 */
function removeDuplicateDependencies(tasksData) {
	const tasks = tasksData.tasks.map((task) => {
		if (!task.dependencies) {
			return task;
		}

		// Convert to Set and back to array to remove duplicates
		const uniqueDeps = [...new Set(task.dependencies)];
		return {
			...task,
			dependencies: uniqueDeps
		};
	});

	return {
		...tasksData,
		tasks
	};
}

/**
 * Clean up invalid subtask dependencies
 * @param {Object} tasksData - Tasks data object with tasks array
 * @returns {Object} Updated tasks data with invalid subtask dependencies removed
 */
function cleanupSubtaskDependencies(tasksData) {
	const tasks = tasksData.tasks.map((task) => {
		// Handle task's own dependencies
		if (task.dependencies) {
			task.dependencies = task.dependencies.filter((depId) => {
				// Keep only dependencies that exist
				return taskExists(tasksData.tasks, depId);
			});
		}

		// Handle subtask dependencies
		if (task.subtasks) {
			task.subtasks = task.subtasks.map((subtask) => {
				if (!subtask.dependencies) {
					return subtask;
				}

				// Filter out dependencies to non-existent subtasks
				subtask.dependencies = subtask.dependencies.filter((depId) => {
					return taskExists(tasksData.tasks, depId);
				});

				return subtask;
			});
		}

		return task;
	});

	return {
		...tasksData,
		tasks
	};
}

/**
 * Validate dependencies in task files
 * @param {string} tasksPath - Path to tasks.json
 */
async function validateDependenciesCommand(tasksPath, options = {}) {
	// Only display banner if not in silent mode
	if (!isSilentMode()) {
		displayBanner();
	}

	log('info', 'Checking for invalid dependencies in task files...');

	// Read tasks data
	const data = readJSON(tasksPath);
	if (!data || !data.tasks) {
		log('error', 'No valid tasks found in tasks.json');
		process.exit(1);
	}

	// Count of tasks and subtasks for reporting
	const taskCount = data.tasks.length;
	let subtaskCount = 0;
	data.tasks.forEach((task) => {
		if (task.subtasks && Array.isArray(task.subtasks)) {
			subtaskCount += task.subtasks.length;
		}
	});

	log(
		'info',
		`Analyzing dependencies for ${taskCount} tasks and ${subtaskCount} subtasks...`
	);

	try {
		// Directly call the validation function
		const validationResult = validateTaskDependencies(data.tasks);

		if (!validationResult.valid) {
			log(
				'error',
				`Dependency validation failed. Found ${validationResult.issues.length} issue(s):`
			);
			validationResult.issues.forEach((issue) => {
				let errorMsg = `  [${issue.type.toUpperCase()}] Task ${issue.taskId}: ${issue.message}`;
				if (issue.dependencyId) {
					errorMsg += ` (Dependency: ${issue.dependencyId})`;
				}
				log('error', errorMsg); // Log each issue as an error
			});

			// Optionally exit if validation fails, depending on desired behavior
			// process.exit(1); // Uncomment if validation failure should stop the process

			// Display summary box even on failure, showing issues found
			if (!isSilentMode()) {
				console.log(
					boxen(
						chalk.red(`Dependency Validation FAILED\n\n`) +
							`${chalk.cyan('Tasks checked:')} ${taskCount}\n` +
							`${chalk.cyan('Subtasks checked:')} ${subtaskCount}\n` +
							`${chalk.red('Issues found:')} ${validationResult.issues.length}`, // Display count from result
						{
							padding: 1,
							borderColor: 'red',
							borderStyle: 'round',
							margin: { top: 1, bottom: 1 }
						}
					)
				);
			}
		} else {
			log(
				'success',
				'No invalid dependencies found - all dependencies are valid'
			);

			// Show validation summary - only if not in silent mode
			if (!isSilentMode()) {
				console.log(
					boxen(
						chalk.green(`All Dependencies Are Valid\n\n`) +
							`${chalk.cyan('Tasks checked:')} ${taskCount}\n` +
							`${chalk.cyan('Subtasks checked:')} ${subtaskCount}\n` +
							`${chalk.cyan('Total dependencies verified:')} ${countAllDependencies(data.tasks)}`,
						{
							padding: 1,
							borderColor: 'green',
							borderStyle: 'round',
							margin: { top: 1, bottom: 1 }
						}
					)
				);
			}
		}
	} catch (error) {
		log('error', 'Error validating dependencies:', error);
		process.exit(1);
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
 * Fixes invalid dependencies in tasks.json
 * @param {string} tasksPath - Path to tasks.json
 * @param {Object} options - Options object
 */
async function fixDependenciesCommand(tasksPath, options = {}) {
	// Only display banner if not in silent mode
	if (!isSilentMode()) {
		displayBanner();
	}

	log('info', 'Checking for and fixing invalid dependencies in tasks.json...');

	try {
		// Read tasks data
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			log('error', 'No valid tasks found in tasks.json');
			process.exit(1);
		}

		// Create a deep copy of the original data for comparison
		const originalData = JSON.parse(JSON.stringify(data));

		// Track fixes for reporting
		const stats = {
			nonExistentDependenciesRemoved: 0,
			selfDependenciesRemoved: 0,
			duplicateDependenciesRemoved: 0,
			circularDependenciesFixed: 0,
			tasksFixed: 0,
			subtasksFixed: 0
		};

		// First phase: Remove duplicate dependencies in tasks
		data.tasks.forEach((task) => {
			if (task.dependencies && Array.isArray(task.dependencies)) {
				const uniqueDeps = new Set();
				const originalLength = task.dependencies.length;
				task.dependencies = task.dependencies.filter((depId) => {
					const depIdStr = String(depId);
					if (uniqueDeps.has(depIdStr)) {
						log(
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
								log(
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

		// Create validity maps for tasks and subtasks
		const validTaskIds = new Set(data.tasks.map((t) => t.id));
		const validSubtaskIds = new Set();
		data.tasks.forEach((task) => {
			if (task.subtasks && Array.isArray(task.subtasks)) {
				task.subtasks.forEach((subtask) => {
					validSubtaskIds.add(`${task.id}.${subtask.id}`);
				});
			}
		});

		// Second phase: Remove invalid task dependencies (non-existent tasks)
		data.tasks.forEach((task) => {
			if (task.dependencies && Array.isArray(task.dependencies)) {
				const originalLength = task.dependencies.length;
				task.dependencies = task.dependencies.filter((depId) => {
					const isSubtask = typeof depId === 'string' && depId.includes('.');

					if (isSubtask) {
						// Check if the subtask exists
						if (!validSubtaskIds.has(depId)) {
							log(
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
							log(
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
									log(
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
									log(
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
									log(
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
								log(
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

		// Third phase: Check for circular dependencies
		log('info', 'Checking for circular dependencies...');

		// Build the dependency map for subtasks
		const subtaskDependencyMap = new Map();
		data.tasks.forEach((task) => {
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

		// Check for and fix circular dependencies
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
				const task = data.tasks.find((t) => t.id === taskId);

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
								log(
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

		// Check if any changes were made by comparing with original data
		const dataChanged = JSON.stringify(data) !== JSON.stringify(originalData);

		if (dataChanged) {
			// Save the changes
			writeJSON(tasksPath, data);
			log('success', 'Fixed dependency issues in tasks.json');

			// Regenerate task files
			log('info', 'Regenerating task files to reflect dependency changes...');
			await generateTaskFiles(tasksPath, path.dirname(tasksPath));
		} else {
			log('info', 'No changes needed to fix dependencies');
		}

		// Show detailed statistics report
		const totalFixedAll =
			stats.nonExistentDependenciesRemoved +
			stats.selfDependenciesRemoved +
			stats.duplicateDependenciesRemoved +
			stats.circularDependenciesFixed;

		if (!isSilentMode()) {
			if (totalFixedAll > 0) {
				log('success', `Fixed ${totalFixedAll} dependency issues in total!`);

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
				log(
					'success',
					'No dependency issues found - all dependencies are valid'
				);

				console.log(
					boxen(
						chalk.green(`All Dependencies Are Valid\n\n`) +
							`${chalk.cyan('Tasks checked:')} ${data.tasks.length}\n` +
							`${chalk.cyan('Total dependencies verified:')} ${countAllDependencies(data.tasks)}`,
						{
							padding: 1,
							borderColor: 'green',
							borderStyle: 'round',
							margin: { top: 1, bottom: 1 }
						}
					)
				);
			}
		}
	} catch (error) {
		log('error', 'Error in fix-dependencies command:', error);
		process.exit(1);
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

/**
 * Parse bulk task ID specification (ranges and comma-separated lists)
 * Supports formats like "7-10", "11,12,15-16", "1.2-1.5", etc.
 * @param {string} taskSpec - Task specification string
 * @returns {Array} Array of task IDs (numbers or strings for subtasks)
 */
function parseBulkTaskIds(taskSpec) {
	if (!taskSpec || typeof taskSpec !== 'string') {
		throw new Error('Task specification must be a non-empty string');
	}

	const taskIds = [];
	const parts = taskSpec.split(',').map((part) => part.trim());

	for (const part of parts) {
		if (part.includes('-')) {
			// Handle range (e.g., "7-10" or "1.2-1.5")
			const [start, end] = part.split('-').map((p) => p.trim());

			if (!start || !end) {
				throw new Error(
					`Invalid range format: "${part}". Expected format: "start-end"`
				);
			}

			// Check if this is a subtask range (contains dots)
			if (start.includes('.') || end.includes('.')) {
				// Subtask range handling
				if (!start.includes('.') || !end.includes('.')) {
					throw new Error(
						`Mixed task/subtask range not supported: "${part}". Both start and end must be subtasks.`
					);
				}

				const [startParent, startSub] = start.split('.').map(Number);
				const [endParent, endSub] = end.split('.').map(Number);

				if (startParent !== endParent) {
					throw new Error(
						`Subtask ranges must be within the same parent task: "${part}"`
					);
				}

				if (isNaN(startParent) || isNaN(startSub) || isNaN(endSub)) {
					throw new Error(
						`Invalid subtask range: "${part}". Expected format: "parent.start-parent.end"`
					);
				}

				for (let i = startSub; i <= endSub; i++) {
					taskIds.push(`${startParent}.${i}`);
				}
			} else {
				// Regular task range
				const startNum = parseInt(start, 10);
				const endNum = parseInt(end, 10);

				if (isNaN(startNum) || isNaN(endNum)) {
					throw new Error(
						`Invalid task range: "${part}". Both start and end must be numbers.`
					);
				}

				if (startNum > endNum) {
					throw new Error(
						`Invalid range: "${part}". Start must be less than or equal to end.`
					);
				}

				for (let i = startNum; i <= endNum; i++) {
					taskIds.push(i);
				}
			}
		} else {
			// Single task ID
			if (part.includes('.')) {
				// Subtask ID
				const [parent, sub] = part.split('.').map(Number);
				if (isNaN(parent) || isNaN(sub)) {
					throw new Error(
						`Invalid subtask ID: "${part}". Expected format: "parent.subtask"`
					);
				}
				taskIds.push(part);
			} else {
				// Regular task ID
				const taskId = parseInt(part, 10);
				if (isNaN(taskId)) {
					throw new Error(`Invalid task ID: "${part}". Must be a number.`);
				}
				taskIds.push(taskId);
			}
		}
	}

	// Remove duplicates while preserving order
	const uniqueTaskIds = [...new Set(taskIds.map((id) => String(id)))].map(
		(id) => {
			return id.includes('.') ? id : parseInt(id, 10);
		}
	);

	return uniqueTaskIds;
}

/**
 * Add dependencies to multiple tasks in bulk
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} taskSpec - Task specification (e.g., "7-10", "11,12,15-16")
 * @param {string} dependencySpec - Dependency specification (e.g., "1-5", "8,9")
 * @param {Object} options - Options object
 * @param {boolean} options.dryRun - If true, only validate and show what would be done
 * @param {boolean} options.silent - If true, suppress console output
 * @returns {Object} Result object with success status and operation details
 */
async function bulkAddDependencies(
	tasksPath,
	taskSpec,
	dependencySpec,
	options = {}
) {
	const { dryRun = false, silent = false } = options;

	try {
		if (!silent) {
			log('info', `Starting bulk dependency addition...`);
		}

		// Parse task and dependency specifications
		const taskIds = parseBulkTaskIds(taskSpec);
		const dependencyIds = parseBulkTaskIds(dependencySpec);

		if (!silent) {
			log(
				'info',
				`Parsed ${taskIds.length} tasks and ${dependencyIds.length} dependencies`
			);
		}

		// Read tasks data
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error('No valid tasks found in tasks.json');
		}

		// Validation phase
		const validationErrors = [];
		const operations = [];

		// Validate all tasks exist
		for (const taskId of taskIds) {
			if (!taskExists(data.tasks, taskId)) {
				validationErrors.push(`Task ${taskId} does not exist`);
				continue;
			}

			// Find the target task/subtask
			let targetTask = null;
			let taskPath = [];

			if (typeof taskId === 'string' && taskId.includes('.')) {
				const [parentId, subtaskId] = taskId.split('.').map(Number);
				const parentTask = data.tasks.find((t) => t.id === parentId);
				if (parentTask && parentTask.subtasks) {
					targetTask = parentTask.subtasks.find((s) => s.id === subtaskId);
					taskPath = [
						'tasks',
						data.tasks.indexOf(parentTask),
						'subtasks',
						parentTask.subtasks.indexOf(targetTask)
					];
				}
			} else {
				targetTask = data.tasks.find((t) => t.id === taskId);
				taskPath = ['tasks', data.tasks.indexOf(targetTask)];
			}

			if (!targetTask) {
				validationErrors.push(`Cannot find task object for ${taskId}`);
				continue;
			}

			// Check each dependency
			for (const dependencyId of dependencyIds) {
				// Validate dependency exists
				if (!taskExists(data.tasks, dependencyId)) {
					validationErrors.push(`Dependency ${dependencyId} does not exist`);
					continue;
				}

				// Check for self-dependency
				if (String(taskId) === String(dependencyId)) {
					validationErrors.push(`Task ${taskId} cannot depend on itself`);
					continue;
				}

				// Check if dependency already exists
				if (
					targetTask.dependencies &&
					targetTask.dependencies.some(
						(d) => String(d) === String(dependencyId)
					)
				) {
					if (!silent) {
						log(
							'warn',
							`Dependency ${dependencyId} already exists for task ${taskId}, skipping`
						);
					}
					continue;
				}

				// Check for circular dependencies (simulate adding the dependency)
				const tempData = JSON.parse(JSON.stringify(data));
				const tempTargetTask = getTaskFromPath(tempData, taskPath);
				if (!tempTargetTask.dependencies) tempTargetTask.dependencies = [];
				tempTargetTask.dependencies.push(dependencyId);

				if (isCircularDependency(tempData.tasks, dependencyId, [taskId])) {
					validationErrors.push(
						`Adding dependency ${dependencyId} to task ${taskId} would create a circular dependency`
					);
					continue;
				}

				// Operation is valid, add to operations list
				operations.push({
					taskId,
					dependencyId,
					taskPath
				});
			}
		}

		// Report validation results
		const totalPossibleOperations = taskIds.length * dependencyIds.length;
		const validOperations = operations.length;

		if (!silent) {
			log(
				'info',
				`Validation complete: ${validOperations}/${totalPossibleOperations} operations are valid`
			);

			if (validationErrors.length > 0) {
				log('warn', `Found ${validationErrors.length} validation errors:`);
				validationErrors.forEach((error) => log('warn', `  - ${error}`));
			}
		}

		// If there are validation errors and we're not in dry-run mode, decide whether to continue
		if (validationErrors.length > 0 && !dryRun) {
			const errorRatio = validationErrors.length / totalPossibleOperations;
			if (errorRatio > 0.5) {
				throw new Error(
					`Too many validation errors (${validationErrors.length}/${totalPossibleOperations}). Aborting bulk operation.`
				);
			}
		}

		// Dry-run mode: just report what would be done
		if (dryRun) {
			const report = {
				success: true,
				dryRun: true,
				summary: {
					totalTasks: taskIds.length,
					totalDependencies: dependencyIds.length,
					validOperations: validOperations,
					errors: validationErrors.length
				},
				operations: operations.map((op) => ({
					task: op.taskId,
					dependency: op.dependencyId
				})),
				errors: validationErrors
			};

			if (!silent && !isSilentMode()) {
				console.log(
					boxen(
						chalk.blue(`Bulk Dependency Addition - DRY RUN\n\n`) +
							`${chalk.cyan('Tasks:')} ${taskIds.join(', ')}\n` +
							`${chalk.cyan('Dependencies:')} ${dependencyIds.join(', ')}\n\n` +
							`${chalk.cyan('Valid operations:')} ${validOperations}\n` +
							`${chalk.cyan('Validation errors:')} ${validationErrors.length}\n\n` +
							`${chalk.yellow('Use --confirm to apply changes')}`,
						{
							padding: 1,
							borderColor: 'blue',
							borderStyle: 'round',
							margin: { top: 1 }
						}
					)
				);
			}

			return report;
		}

		// Execute operations atomically
		if (validOperations === 0) {
			if (!silent) {
				log('info', 'No valid operations to perform');
			}
			return {
				success: true,
				summary: {
					operationsPerformed: 0,
					errors: validationErrors.length
				},
				errors: validationErrors
			};
		}

		// Create a backup of the original data for rollback
		const originalData = JSON.parse(JSON.stringify(data));

		try {
			// Apply all operations
			for (const operation of operations) {
				const targetTask = getTaskFromPath(data, operation.taskPath);
				if (!targetTask.dependencies) {
					targetTask.dependencies = [];
				}
				targetTask.dependencies.push(operation.dependencyId);

				// Sort dependencies
				targetTask.dependencies.sort((a, b) => {
					if (typeof a === 'number' && typeof b === 'number') {
						return a - b;
					} else if (typeof a === 'string' && typeof b === 'string') {
						const [aParent, aChild] = a.split('.').map(Number);
						const [bParent, bChild] = b.split('.').map(Number);
						return aParent !== bParent ? aParent - bParent : aChild - bChild;
					} else if (typeof a === 'number') {
						return -1;
					} else {
						return 1;
					}
				});
			}

			// Save changes
			writeJSON(tasksPath, data);

			// Generate updated task files
			await generateTaskFiles(tasksPath, path.dirname(tasksPath));

			if (!silent) {
				log(
					'success',
					`Successfully added ${validOperations} dependency relationships`
				);

				if (!isSilentMode()) {
					console.log(
						boxen(
							chalk.green(`Bulk Dependencies Added Successfully\n\n`) +
								`${chalk.cyan('Operations performed:')} ${validOperations}\n` +
								`${chalk.cyan('Tasks affected:')} ${[...new Set(operations.map((op) => op.taskId))].length}\n` +
								`${chalk.cyan('Dependencies added:')} ${[...new Set(operations.map((op) => op.dependencyId))].length}`,
							{
								padding: 1,
								borderColor: 'green',
								borderStyle: 'round',
								margin: { top: 1 }
							}
						)
					);
				}
			}

			return {
				success: true,
				summary: {
					operationsPerformed: validOperations,
					tasksAffected: [...new Set(operations.map((op) => op.taskId))].length,
					dependenciesAdded: [
						...new Set(operations.map((op) => op.dependencyId))
					].length,
					errors: validationErrors.length
				},
				operations: operations.map((op) => ({
					task: op.taskId,
					dependency: op.dependencyId
				})),
				errors: validationErrors
			};
		} catch (error) {
			// Rollback on error
			writeJSON(tasksPath, originalData);
			throw new Error(
				`Bulk operation failed and was rolled back: ${error.message}`
			);
		}
	} catch (error) {
		if (!silent) {
			log('error', `Bulk add dependencies failed: ${error.message}`);
		}
		return {
			success: false,
			error: error.message
		};
	}
}

/**
 * Helper function to get a task/subtask object from a data structure using a path
 * @param {Object} data - The data structure
 * @param {Array} path - Array representing the path to the object
 * @returns {Object} The target task/subtask object
 */
function getTaskFromPath(data, path) {
	let current = data;
	for (const segment of path) {
		current = current[segment];
	}
	return current;
}

/**
 * Remove dependencies from multiple tasks in bulk
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} taskSpec - Task specification (e.g., "7-10", "11,12,15-16")
 * @param {string} dependencySpec - Dependency specification (e.g., "1-5", "8,9")
 * @param {Object} options - Options object
 * @param {boolean} options.dryRun - If true, only validate and show what would be done
 * @param {boolean} options.silent - If true, suppress console output
 * @returns {Object} Result object with success status and operation details
 */
async function bulkRemoveDependencies(
	tasksPath,
	taskSpec,
	dependencySpec,
	options = {}
) {
	const { dryRun = false, silent = false } = options;

	try {
		if (!silent) {
			log('info', `Starting bulk dependency removal...`);
		}

		// Parse task and dependency specifications
		const taskIds = parseBulkTaskIds(taskSpec);
		const dependencyIds = parseBulkTaskIds(dependencySpec);

		if (!silent) {
			log(
				'info',
				`Parsed ${taskIds.length} tasks and ${dependencyIds.length} dependencies`
			);
		}

		// Read tasks data
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error('No valid tasks found in tasks.json');
		}

		// Validation phase
		const validationErrors = [];
		const operations = [];

		// Validate all tasks exist and find dependencies to remove
		for (const taskId of taskIds) {
			if (!taskExists(data.tasks, taskId)) {
				validationErrors.push(`Task ${taskId} does not exist`);
				continue;
			}

			// Find the target task/subtask
			let targetTask = null;
			let taskPath = [];

			if (typeof taskId === 'string' && taskId.includes('.')) {
				const [parentId, subtaskId] = taskId.split('.').map(Number);
				const parentTask = data.tasks.find((t) => t.id === parentId);
				if (parentTask && parentTask.subtasks) {
					targetTask = parentTask.subtasks.find((s) => s.id === subtaskId);
					taskPath = [
						'tasks',
						data.tasks.indexOf(parentTask),
						'subtasks',
						parentTask.subtasks.indexOf(targetTask)
					];
				}
			} else {
				targetTask = data.tasks.find((t) => t.id === taskId);
				taskPath = ['tasks', data.tasks.indexOf(targetTask)];
			}

			if (!targetTask) {
				validationErrors.push(`Cannot find task object for ${taskId}`);
				continue;
			}

			// Check if task has any dependencies
			if (!targetTask.dependencies || targetTask.dependencies.length === 0) {
				if (!silent) {
					log('warn', `Task ${taskId} has no dependencies to remove`);
				}
				continue;
			}

			// Check each dependency to remove
			for (const dependencyId of dependencyIds) {
				// Check if dependency exists in this task
				const dependencyIndex = targetTask.dependencies.findIndex((dep) => {
					if (typeof dependencyId === 'string' && dependencyId.includes('.')) {
						// String dependency (subtask)
						return String(dep) === String(dependencyId);
					} else {
						// Numeric dependency - handle potential format differences
						return String(dep) === String(dependencyId);
					}
				});

				if (dependencyIndex === -1) {
					if (!silent) {
						log(
							'warn',
							`Task ${taskId} does not depend on ${dependencyId}, skipping`
						);
					}
					continue;
				}

				// Operation is valid, add to operations list
				operations.push({
					taskId,
					dependencyId,
					taskPath,
					dependencyIndex
				});
			}
		}

		// Report validation results
		const totalPossibleOperations = taskIds.length * dependencyIds.length;
		const validOperations = operations.length;

		if (!silent) {
			log(
				'info',
				`Validation complete: ${validOperations}/${totalPossibleOperations} operations are valid`
			);

			if (validationErrors.length > 0) {
				log('warn', `Found ${validationErrors.length} validation errors:`);
				validationErrors.forEach((error) => log('warn', `  - ${error}`));
			}
		}

		// Dry-run mode: just report what would be done
		if (dryRun) {
			const report = {
				success: true,
				dryRun: true,
				summary: {
					totalTasks: taskIds.length,
					totalDependencies: dependencyIds.length,
					validOperations: validOperations,
					errors: validationErrors.length
				},
				operations: operations.map((op) => ({
					task: op.taskId,
					dependency: op.dependencyId
				})),
				errors: validationErrors
			};

			if (!silent && !isSilentMode()) {
				console.log(
					boxen(
						chalk.blue(`Bulk Dependency Removal - DRY RUN\n\n`) +
							`${chalk.cyan('Tasks:')} ${taskIds.join(', ')}\n` +
							`${chalk.cyan('Dependencies to remove:')} ${dependencyIds.join(', ')}\n\n` +
							`${chalk.cyan('Valid operations:')} ${validOperations}\n` +
							`${chalk.cyan('Validation errors:')} ${validationErrors.length}\n\n` +
							`${chalk.yellow('Use --confirm to apply changes')}`,
						{
							padding: 1,
							borderColor: 'blue',
							borderStyle: 'round',
							margin: { top: 1 }
						}
					)
				);
			}

			return report;
		}

		// Execute operations atomically
		if (validOperations === 0) {
			if (!silent) {
				log('info', 'No valid operations to perform');
			}
			return {
				success: true,
				summary: {
					operationsPerformed: 0,
					errors: validationErrors.length
				},
				errors: validationErrors
			};
		}

		// Create a backup of the original data for rollback
		const originalData = JSON.parse(JSON.stringify(data));

		try {
			// Group operations by task to handle multiple dependency removals efficiently
			const operationsByTask = {};
			operations.forEach((op) => {
				if (!operationsByTask[op.taskId]) {
					operationsByTask[op.taskId] = [];
				}
				operationsByTask[op.taskId].push(op);
			});

			// Apply all operations, removing dependencies
			for (const [taskId, taskOperations] of Object.entries(operationsByTask)) {
				const targetTask = getTaskFromPath(data, taskOperations[0].taskPath);

				// Remove dependencies (sort indices in descending order to avoid index shifting issues)
				const dependenciesToRemove = taskOperations
					.map((op) => op.dependencyId)
					.sort() // Sort for consistent removal order
					.reverse(); // Reverse to remove from end first

				// Remove each dependency
				dependenciesToRemove.forEach((depId) => {
					const index = targetTask.dependencies.findIndex(
						(dep) => String(dep) === String(depId)
					);
					if (index !== -1) {
						targetTask.dependencies.splice(index, 1);
					}
				});
			}

			// Save changes
			writeJSON(tasksPath, data);

			// Generate updated task files
			await generateTaskFiles(tasksPath, path.dirname(tasksPath));

			if (!silent) {
				log(
					'success',
					`Successfully removed ${validOperations} dependency relationships`
				);

				if (!isSilentMode()) {
					console.log(
						boxen(
							chalk.green(`Bulk Dependencies Removed Successfully\n\n`) +
								`${chalk.cyan('Operations performed:')} ${validOperations}\n` +
								`${chalk.cyan('Tasks affected:')} ${[...new Set(operations.map((op) => op.taskId))].length}\n` +
								`${chalk.cyan('Dependencies removed:')} ${[...new Set(operations.map((op) => op.dependencyId))].length}`,
							{
								padding: 1,
								borderColor: 'green',
								borderStyle: 'round',
								margin: { top: 1 }
							}
						)
					);
				}
			}

			return {
				success: true,
				summary: {
					operationsPerformed: validOperations,
					tasksAffected: [...new Set(operations.map((op) => op.taskId))].length,
					dependenciesRemoved: [
						...new Set(operations.map((op) => op.dependencyId))
					].length,
					errors: validationErrors.length
				},
				operations: operations.map((op) => ({
					task: op.taskId,
					dependency: op.dependencyId
				})),
				errors: validationErrors
			};
		} catch (error) {
			// Rollback on error
			writeJSON(tasksPath, originalData);
			throw new Error(
				`Bulk operation failed and was rolled back: ${error.message}`
			);
		}
	} catch (error) {
		if (!silent) {
			log('error', `Bulk remove dependencies failed: ${error.message}`);
		}
		return {
			success: false,
			error: error.message
		};
	}
}

export {
	addDependency,
	removeDependency,
	isCircularDependency,
	validateTaskDependencies,
	validateDependenciesCommand,
	fixDependenciesCommand,
	removeDuplicateDependencies,
	cleanupSubtaskDependencies,
	ensureAtLeastOneIndependentSubtask,
	validateAndFixDependencies,
	parseBulkTaskIds,
	bulkAddDependencies,
	bulkRemoveDependencies
};
