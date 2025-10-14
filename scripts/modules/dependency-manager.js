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
	traverseDependencies,
	isSilentMode
} from './utils.js';

import { displayBanner } from './ui.js';

import generateTaskFiles from './task-manager/generate-task-files.js';

/**
 * Structured error class for dependency operations
 */
class DependencyError extends Error {
	constructor(code, message, data = {}) {
		super(message);
		this.name = 'DependencyError';
		this.code = code;
		this.data = data;
	}
}

/**
 * Error codes for dependency operations
 */
const DEPENDENCY_ERROR_CODES = {
	CANNOT_MOVE_SUBTASK: 'CANNOT_MOVE_SUBTASK',
	INVALID_TASK_ID: 'INVALID_TASK_ID',
	INVALID_SOURCE_TAG: 'INVALID_SOURCE_TAG',
	INVALID_TARGET_TAG: 'INVALID_TARGET_TAG'
};

/**
 * Add a dependency to a task
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number|string} taskId - ID of the task to add dependency to
 * @param {number|string} dependencyId - ID of the task to add as dependency
 * @param {Object} context - Context object containing projectRoot and tag information
 * @param {string} [context.projectRoot] - Project root path
 * @param {string} [context.tag] - Tag for the task
 */
async function addDependency(tasksPath, taskId, dependencyId, context = {}) {
	log('info', `Adding dependency ${dependencyId} to task ${taskId}...`);

	const data = readJSON(tasksPath, context.projectRoot, context.tag);
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
	const dependencyChain = [formattedTaskId];
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
		writeJSON(tasksPath, data, context.projectRoot, context.tag);
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
		// await generateTaskFiles(tasksPath, path.dirname(tasksPath));

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
 * Remove a dependency from a task
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number|string} taskId - ID of the task to remove dependency from
 * @param {number|string} dependencyId - ID of the task to remove as dependency
 * @param {Object} context - Context object containing projectRoot and tag information
 * @param {string} [context.projectRoot] - Project root path
 * @param {string} [context.tag] - Tag for the task
 */
async function removeDependency(tasksPath, taskId, dependencyId, context = {}) {
	log('info', `Removing dependency ${dependencyId} from task ${taskId}...`);

	// Read tasks file
	const data = readJSON(tasksPath, context.projectRoot, context.tag);
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
		// Direct string comparison (handles both numeric IDs and dot notation)
		const depStr = String(dep);
		if (depStr === normalizedDependencyId) {
			return true;
		}

		// For subtasks: handle numeric dependencies that might be references to other subtasks
		// in the same parent (e.g., subtask 1.2 depending on subtask 1.1 stored as just "1")
		if (typeof dep === 'number' && dep < 100 && isSubtask) {
			const [parentId] = formattedTaskId.split('.');
			const fullSubtaskRef = `${parentId}.${dep}`;
			if (fullSubtaskRef === normalizedDependencyId) {
				return true;
			}
		}

		return false;
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
	writeJSON(tasksPath, data, context.projectRoot, context.tag);

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
	// await generateTaskFiles(tasksPath, path.dirname(tasksPath));
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
		// Regular task - handle both string and numeric task IDs
		const taskIdNum = parseInt(taskIdStr, 10);
		task = tasks.find((t) => t.id === taskIdNum || String(t.id) === taskIdStr);
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
 * @param {Object} options - Options object, including context
 */
async function validateDependenciesCommand(tasksPath, options = {}) {
	const { context = {} } = options;
	log('info', 'Checking for invalid dependencies in task files...');

	// Read tasks data
	const data = readJSON(tasksPath, context.projectRoot, context.tag);
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
 * @param {Object} options - Options object, including context
 */
async function fixDependenciesCommand(tasksPath, options = {}) {
	const { context = {} } = options;
	log('info', 'Checking for and fixing invalid dependencies in tasks.json...');

	try {
		// Read tasks data
		const data = readJSON(tasksPath, context.projectRoot, context.tag);
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
			writeJSON(tasksPath, data, context.projectRoot, context.tag);
			log('success', 'Fixed dependency issues in tasks.json');

			// Regenerate task files
			log('info', 'Regenerating task files to reflect dependency changes...');
			// await generateTaskFiles(tasksPath, path.dirname(tasksPath));
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
 * @param {string} projectRoot - Optional project root for tag context
 * @param {string} tag - Optional tag for tag context
 * @returns {boolean} - True if any changes were made
 */
function validateAndFixDependencies(
	tasksData,
	tasksPath = null,
	projectRoot = null,
	tag = null
) {
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
			writeJSON(tasksPath, tasksData, projectRoot, tag);
			log('debug', 'Saved dependency fixes to tasks.json');
		} catch (error) {
			log('error', 'Failed to save dependency fixes to tasks.json', error);
		}
	}

	return changesDetected;
}

/**
 * Recursively find all dependencies for a set of tasks with depth limiting
 * Recursively find all dependencies for a set of tasks with depth limiting
 *
 * @note This function depends on the traverseDependencies utility from utils.js
 * for the actual dependency traversal logic.
 *
 * @param {Array} sourceTasks - Array of source tasks to find dependencies for
 * @param {Array} allTasks - Array of all available tasks
 * @param {Object} options - Options object
 * @param {number} options.maxDepth - Maximum recursion depth (default: 50)
 * @param {boolean} options.includeSelf - Whether to include self-references (default: false)
 * @returns {Array} Array of all dependency task IDs
 */
function findAllDependenciesRecursively(sourceTasks, allTasks, options = {}) {
	if (!Array.isArray(sourceTasks)) {
		throw new Error('Source tasks parameter must be an array');
	}
	if (!Array.isArray(allTasks)) {
		throw new Error('All tasks parameter must be an array');
	}
	return traverseDependencies(sourceTasks, allTasks, {
		...options,
		direction: 'forward',
		logger: { warn: log.warn || console.warn }
	});
}

/**
 * Find dependency task by ID, handling various ID formats
 * @param {string|number} depId - Dependency ID to find
 * @param {string} taskId - ID of the task that has this dependency
 * @param {Array} allTasks - Array of all tasks to search
 * @returns {Object|null} Found dependency task or null
 */
/**
 * Find a subtask within a parent task's subtasks array
 * @param {string} parentId - The parent task ID
 * @param {string|number} subtaskId - The subtask ID to find
 * @param {Array} allTasks - Array of all tasks to search in
 * @param {boolean} useStringComparison - Whether to use string comparison for subtaskId
 * @returns {Object|null} The found subtask with full ID or null if not found
 */
function findSubtaskInParent(
	parentId,
	subtaskId,
	allTasks,
	useStringComparison = false
) {
	// Convert parentId to numeric for proper comparison with top-level task IDs
	const numericParentId = parseInt(parentId, 10);
	const parentTask = allTasks.find((t) => t.id === numericParentId);

	if (parentTask && parentTask.subtasks && Array.isArray(parentTask.subtasks)) {
		const foundSubtask = parentTask.subtasks.find((subtask) =>
			useStringComparison
				? String(subtask.id) === String(subtaskId)
				: subtask.id === subtaskId
		);
		if (foundSubtask) {
			// Return a task-like object that represents the subtask with full ID
			return {
				...foundSubtask,
				id: `${parentId}.${foundSubtask.id}`
			};
		}
	}

	return null;
}

function findDependencyTask(depId, taskId, allTasks) {
	if (!depId) {
		return null;
	}

	// Convert depId to string for consistent comparison
	const depIdStr = String(depId);

	// Find the dependency task - handle both top-level and subtask IDs
	let depTask = null;

	// First try exact match (for top-level tasks)
	depTask = allTasks.find((t) => String(t.id) === depIdStr);

	// If not found and it's a subtask reference (contains dot), find the parent task first
	if (!depTask && depIdStr.includes('.')) {
		const [parentId, subtaskId] = depIdStr.split('.');
		depTask = findSubtaskInParent(parentId, subtaskId, allTasks, true);
	}

	// If still not found, try numeric comparison for relative subtask references
	if (!depTask && !isNaN(depId)) {
		const numericId = parseInt(depId, 10);
		// For subtasks, this might be a relative reference within the same parent
		if (taskId && typeof taskId === 'string' && taskId.includes('.')) {
			const [parentId] = taskId.split('.');
			depTask = findSubtaskInParent(parentId, numericId, allTasks, false);
		}
	}

	return depTask;
}

/**
 * Check if a task has cross-tag dependencies
 * @param {Object} task - Task to check
 * @param {string} targetTag - Target tag name
 * @param {Array} allTasks - Array of all tasks from all tags
 * @returns {Array} Array of cross-tag dependency conflicts
 */
function findTaskCrossTagConflicts(task, targetTag, allTasks) {
	const conflicts = [];

	// Validate task.dependencies is an array before processing
	if (!Array.isArray(task.dependencies) || task.dependencies.length === 0) {
		return conflicts;
	}

	// Filter out null/undefined dependencies and check each valid dependency
	const validDependencies = task.dependencies.filter((depId) => depId != null);

	validDependencies.forEach((depId) => {
		const depTask = findDependencyTask(depId, task.id, allTasks);

		if (depTask && depTask.tag !== targetTag) {
			conflicts.push({
				taskId: task.id,
				dependencyId: depId,
				dependencyTag: depTask.tag,
				message: `Task ${task.id} depends on ${depId} (in ${depTask.tag})`
			});
		}
	});

	return conflicts;
}

function validateCrossTagMove(task, sourceTag, targetTag, allTasks) {
	// Parameter validation
	if (!task || typeof task !== 'object') {
		throw new Error('Task parameter must be a valid object');
	}

	if (!sourceTag || typeof sourceTag !== 'string') {
		throw new Error('Source tag must be a valid string');
	}

	if (!targetTag || typeof targetTag !== 'string') {
		throw new Error('Target tag must be a valid string');
	}

	if (!Array.isArray(allTasks)) {
		throw new Error('All tasks parameter must be an array');
	}

	const conflicts = findTaskCrossTagConflicts(task, targetTag, allTasks);

	return {
		canMove: conflicts.length === 0,
		conflicts
	};
}

/**
 * Find all cross-tag dependencies for a set of tasks
 * @param {Array} sourceTasks - Array of tasks to check
 * @param {string} sourceTag - Source tag name
 * @param {string} targetTag - Target tag name
 * @param {Array} allTasks - Array of all tasks from all tags
 * @returns {Array} Array of cross-tag dependency conflicts
 */
function findCrossTagDependencies(sourceTasks, sourceTag, targetTag, allTasks) {
	// Parameter validation
	if (!Array.isArray(sourceTasks)) {
		throw new Error('Source tasks parameter must be an array');
	}

	if (!sourceTag || typeof sourceTag !== 'string') {
		throw new Error('Source tag must be a valid string');
	}

	if (!targetTag || typeof targetTag !== 'string') {
		throw new Error('Target tag must be a valid string');
	}

	if (!Array.isArray(allTasks)) {
		throw new Error('All tasks parameter must be an array');
	}

	const conflicts = [];

	sourceTasks.forEach((task) => {
		// Validate task object and dependencies array
		if (
			!task ||
			typeof task !== 'object' ||
			!Array.isArray(task.dependencies) ||
			task.dependencies.length === 0
		) {
			return;
		}

		// Use the shared helper function to find conflicts for this task
		const taskConflicts = findTaskCrossTagConflicts(task, targetTag, allTasks);
		conflicts.push(...taskConflicts);
	});

	return conflicts;
}

/**
 * Helper function to find all tasks that depend on a given task (reverse dependencies)
 * @param {string|number} taskId - The task ID to find dependencies for
 * @param {Array} allTasks - Array of all tasks to search
 * @param {Set} dependentTaskIds - Set to add found dependencies to
 */
function findTasksThatDependOn(taskId, allTasks, dependentTaskIds) {
	// Find the task object for the given ID
	const sourceTask = allTasks.find((t) => t.id === taskId);
	if (!sourceTask) {
		return;
	}

	// Use the shared utility for reverse dependency traversal
	const reverseDeps = traverseDependencies([sourceTask], allTasks, {
		direction: 'reverse',
		includeSelf: false,
		logger: { warn: log.warn || console.warn }
	});

	// Add all found reverse dependencies to the dependentTaskIds set
	reverseDeps.forEach((depId) => dependentTaskIds.add(depId));
}

/**
 * Helper function to check if a task depends on a source task
 * @param {Object} task - Task to check for dependencies
 * @param {Object} sourceTask - Source task to check dependency against
 * @returns {boolean} True if task depends on source task
 */
function taskDependsOnSource(task, sourceTask) {
	if (!task || !Array.isArray(task.dependencies)) {
		return false;
	}

	const sourceTaskIdStr = String(sourceTask.id);

	return task.dependencies.some((depId) => {
		if (!depId) return false;

		const depIdStr = String(depId);

		// Exact match
		if (depIdStr === sourceTaskIdStr) {
			return true;
		}

		// Handle subtask references
		if (
			sourceTaskIdStr &&
			typeof sourceTaskIdStr === 'string' &&
			sourceTaskIdStr.includes('.')
		) {
			// If source is a subtask, check if dependency references the parent
			const [parentId] = sourceTaskIdStr.split('.');
			if (depIdStr === parentId) {
				return true;
			}
		}

		// Handle relative subtask references
		if (
			depIdStr &&
			typeof depIdStr === 'string' &&
			depIdStr.includes('.') &&
			sourceTaskIdStr &&
			typeof sourceTaskIdStr === 'string' &&
			sourceTaskIdStr.includes('.')
		) {
			const [depParentId] = depIdStr.split('.');
			const [sourceParentId] = sourceTaskIdStr.split('.');
			if (depParentId === sourceParentId) {
				// Both are subtasks of the same parent, check if they reference each other
				const depSubtaskNum = parseInt(depIdStr.split('.')[1], 10);
				const sourceSubtaskNum = parseInt(sourceTaskIdStr.split('.')[1], 10);
				if (depSubtaskNum === sourceSubtaskNum) {
					return true;
				}
			}
		}

		return false;
	});
}

/**
 * Helper function to check if any subtasks of a task depend on source tasks
 * @param {Object} task - Task to check subtasks of
 * @param {Array} sourceTasks - Array of source tasks to check dependencies against
 * @returns {boolean} True if any subtasks depend on source tasks
 */
function subtasksDependOnSource(task, sourceTasks) {
	if (!task.subtasks || !Array.isArray(task.subtasks)) {
		return false;
	}

	return task.subtasks.some((subtask) => {
		// Check if this subtask depends on any source task
		const subtaskDependsOnSource = sourceTasks.some((sourceTask) =>
			taskDependsOnSource(subtask, sourceTask)
		);

		if (subtaskDependsOnSource) {
			return true;
		}

		// Recursively check if any nested subtasks depend on source tasks
		if (subtask.subtasks && Array.isArray(subtask.subtasks)) {
			return subtasksDependOnSource(subtask, sourceTasks);
		}

		return false;
	});
}

/**
 * Get all dependent task IDs for a set of cross-tag dependencies
 * @param {Array} sourceTasks - Array of source tasks
 * @param {Array} crossTagDependencies - Array of cross-tag dependency conflicts
 * @param {Array} allTasks - Array of all tasks from all tags
 * @returns {Array} Array of dependent task IDs to move
 */
function getDependentTaskIds(sourceTasks, crossTagDependencies, allTasks) {
	// Enhanced parameter validation
	if (!Array.isArray(sourceTasks)) {
		throw new Error('Source tasks parameter must be an array');
	}

	if (!Array.isArray(crossTagDependencies)) {
		throw new Error('Cross tag dependencies parameter must be an array');
	}

	if (!Array.isArray(allTasks)) {
		throw new Error('All tasks parameter must be an array');
	}

	// Use the shared recursive dependency finder
	const dependentTaskIds = new Set(
		findAllDependenciesRecursively(sourceTasks, allTasks, {
			includeSelf: false
		})
	);

	// Add immediate dependency IDs from conflicts and find their dependencies recursively
	const conflictTasksToProcess = [];
	crossTagDependencies.forEach((conflict) => {
		if (conflict && conflict.dependencyId) {
			const depId =
				typeof conflict.dependencyId === 'string'
					? parseInt(conflict.dependencyId, 10)
					: conflict.dependencyId;
			if (!isNaN(depId)) {
				dependentTaskIds.add(depId);
				// Find the task object for recursive dependency finding
				const depTask = allTasks.find((t) => t.id === depId);
				if (depTask) {
					conflictTasksToProcess.push(depTask);
				}
			}
		}
	});

	// Find dependencies of conflict tasks
	if (conflictTasksToProcess.length > 0) {
		const conflictDependencies = findAllDependenciesRecursively(
			conflictTasksToProcess,
			allTasks,
			{ includeSelf: false }
		);
		conflictDependencies.forEach((depId) => dependentTaskIds.add(depId));
	}

	// For --with-dependencies, we also need to find all dependencies of the source tasks
	sourceTasks.forEach((sourceTask) => {
		if (sourceTask && sourceTask.id) {
			// Find all tasks that this source task depends on (forward dependencies) - already handled above

			// Find all tasks that depend on this source task (reverse dependencies)
			findTasksThatDependOn(sourceTask.id, allTasks, dependentTaskIds);
		}
	});

	// Also include any tasks that depend on the source tasks
	sourceTasks.forEach((sourceTask) => {
		if (!sourceTask || typeof sourceTask !== 'object' || !sourceTask.id) {
			return; // Skip invalid source tasks
		}

		allTasks.forEach((task) => {
			// Validate task and dependencies array
			if (
				!task ||
				typeof task !== 'object' ||
				!Array.isArray(task.dependencies)
			) {
				return;
			}

			// Check if this task depends on the source task
			const hasDependency = taskDependsOnSource(task, sourceTask);

			// Check if any subtasks of this task depend on the source task
			const subtasksHaveDependency = subtasksDependOnSource(task, [sourceTask]);

			if (hasDependency || subtasksHaveDependency) {
				dependentTaskIds.add(task.id);
			}
		});
	});

	return Array.from(dependentTaskIds);
}

/**
 * Validate subtask movement - block direct cross-tag subtask moves
 * @param {string} taskId - Task ID to validate
 * @param {string} sourceTag - Source tag name
 * @param {string} targetTag - Target tag name
 * @throws {Error} If subtask movement is attempted
 */
function validateSubtaskMove(taskId, sourceTag, targetTag) {
	// Parameter validation
	if (!taskId || typeof taskId !== 'string') {
		throw new DependencyError(
			DEPENDENCY_ERROR_CODES.INVALID_TASK_ID,
			'Task ID must be a valid string'
		);
	}

	if (!sourceTag || typeof sourceTag !== 'string') {
		throw new DependencyError(
			DEPENDENCY_ERROR_CODES.INVALID_SOURCE_TAG,
			'Source tag must be a valid string'
		);
	}

	if (!targetTag || typeof targetTag !== 'string') {
		throw new DependencyError(
			DEPENDENCY_ERROR_CODES.INVALID_TARGET_TAG,
			'Target tag must be a valid string'
		);
	}

	if (taskId.includes('.')) {
		throw new DependencyError(
			DEPENDENCY_ERROR_CODES.CANNOT_MOVE_SUBTASK,
			`Cannot move subtask ${taskId} directly between tags.

First promote it to a full task using:
  task-master remove-subtask --id=${taskId} --convert`,
			{
				taskId,
				sourceTag,
				targetTag
			}
		);
	}
}

/**
 * Check if a task can be moved with its dependencies
 * @param {string} taskId - Task ID to check
 * @param {string} sourceTag - Source tag name
 * @param {string} targetTag - Target tag name
 * @param {Array} allTasks - Array of all tasks from all tags
 * @returns {Object} Object with canMove boolean and dependentTaskIds array
 */
function canMoveWithDependencies(taskId, sourceTag, targetTag, allTasks) {
	// Parameter validation
	if (!taskId || typeof taskId !== 'string') {
		throw new Error('Task ID must be a valid string');
	}

	if (!sourceTag || typeof sourceTag !== 'string') {
		throw new Error('Source tag must be a valid string');
	}

	if (!targetTag || typeof targetTag !== 'string') {
		throw new Error('Target tag must be a valid string');
	}

	if (!Array.isArray(allTasks)) {
		throw new Error('All tasks parameter must be an array');
	}

	// Enhanced task lookup to handle subtasks properly
	let sourceTask = null;

	// Check if it's a subtask ID (e.g., "1.2")
	if (taskId.includes('.')) {
		const [parentId, subtaskId] = taskId
			.split('.')
			.map((id) => parseInt(id, 10));
		const parentTask = allTasks.find(
			(t) => t.id === parentId && t.tag === sourceTag
		);

		if (
			parentTask &&
			parentTask.subtasks &&
			Array.isArray(parentTask.subtasks)
		) {
			const subtask = parentTask.subtasks.find((st) => st.id === subtaskId);
			if (subtask) {
				// Create a copy of the subtask with parent context
				sourceTask = {
					...subtask,
					parentTask: {
						id: parentTask.id,
						title: parentTask.title,
						status: parentTask.status
					},
					isSubtask: true
				};
			}
		}
	} else {
		// Regular task lookup - handle both string and numeric IDs
		sourceTask = allTasks.find((t) => {
			const taskIdNum = parseInt(taskId, 10);
			return (t.id === taskIdNum || t.id === taskId) && t.tag === sourceTag;
		});
	}

	if (!sourceTask) {
		return {
			canMove: false,
			dependentTaskIds: [],
			conflicts: [],
			error: 'Task not found'
		};
	}

	const validation = validateCrossTagMove(
		sourceTask,
		sourceTag,
		targetTag,
		allTasks
	);

	// Fix contradictory logic: return canMove: false when conflicts exist
	if (validation.canMove) {
		return {
			canMove: true,
			dependentTaskIds: [],
			conflicts: []
		};
	}

	// When conflicts exist, return canMove: false with conflicts and dependent task IDs
	const dependentTaskIds = getDependentTaskIds(
		[sourceTask],
		validation.conflicts,
		allTasks
	);

	return {
		canMove: false,
		dependentTaskIds,
		conflicts: validation.conflicts
	};
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
	findDependencyTask,
	findTaskCrossTagConflicts,
	validateCrossTagMove,
	findCrossTagDependencies,
	getDependentTaskIds,
	validateSubtaskMove,
	canMoveWithDependencies,
	findAllDependenciesRecursively,
	DependencyError,
	DEPENDENCY_ERROR_CODES
};
