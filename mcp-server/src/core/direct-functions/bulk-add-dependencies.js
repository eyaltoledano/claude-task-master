/**
 * bulk-add-dependencies.js
 * Direct function implementation for adding dependencies to multiple tasks in bulk
 */
import { bulkAddDependencies } from '../../../../scripts/modules/dependency-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import { findTasksJsonPath } from '../utils/path-utils.js';
import { log } from '../../../../scripts/modules/log.js';
import chalk from 'chalk';
import path from 'path';

/**
 * Direct function for bulk adding dependencies.
 * This function is called by the MCP tool and directly invokes the core logic.
 *
 * @param {Object} params - The parameters for the function.
 * @param {string} params.taskSpec - Task specification (e.g., "7-10", "11,12,15-16").
 * @param {string} params.dependencySpec - Dependency specification (e.g., "1-5", "8,9").
 * @param {string} [params.tasksFile='tasks/tasks.json'] - Optional path to the tasks file.
 * @param {boolean} [params.dryRun=false] - If true, only validate and show what would be done.
 * @param {string} [params.projectRoot=process.cwd()] - The root directory of the project.
 * @returns {Promise<Object>} A promise that resolves with the result of the bulk operation.
 */
export async function bulkAddDependenciesDirect({
	taskSpec,
	dependencySpec,
	tasksFile,
	dryRun = false,
	projectRoot = process.cwd()
}) {
	if (!taskSpec || !dependencySpec) {
		return {
			success: false,
			error: 'Both taskSpec and dependencySpec are required parameters.'
		};
	}

	enableSilentMode(); // Ensure core functions don't log to console during MCP operation

	try {
		const tasksFilePath = await findTasksJsonPath(projectRoot, tasksFile);
		if (!tasksFilePath) {
			return {
				success: false,
				error: `Tasks file not found using tasksFile: ${tasksFile} from projectRoot: ${projectRoot}`
			};
		}

		const result = await bulkAddDependencies(
			tasksFilePath,
			taskSpec,
			dependencySpec,
			{
				dryRun,
				silent: true // Always silent for direct functions
			}
		);

		if (!result.success) {
			log(
				'error',
				`[MCP Direct] Bulk add dependencies failed: ${result.error}`
			);
			return {
				success: false,
				error: result.error,
				details: result // Include full result for more context if needed
			};
		}

		let message = '';
		if (dryRun) {
			message = `Dry run: Would add ${result.summary.validOperations} dependency relationships.`;
			if (result.summary.errors > 0) {
				message += ` ${result.summary.errors} validation errors encountered.`;
			}
			// Provide a snippet of operations for dry run
			const operationsPreview = result.operations
				.slice(0, 5)
				.map((op) => `Task ${op.task} -> Dependency ${op.dependency}`)
				.join('; ');
			message += ` Preview: ${operationsPreview}${result.operations.length > 5 ? '...' : ''}`;
		} else {
			message = `Successfully added ${result.summary.operationsPerformed} dependency relationships.`;
			if (result.summary.errors > 0) {
				message += ` ${result.summary.errors} validation errors were ignored for other operations.`;
			}
		}

		log(
			'info',
			`[MCP Direct] Bulk add dependencies complete. Task Spec: "${taskSpec}", Dependency Spec: "${dependencySpec}", Result: ${message}`
		);

		return {
			success: true,
			message,
			data: result // Return the full result object from the core function
		};
	} catch (error) {
		log(
			'error',
			`[MCP Direct] Critical error in bulkAddDependenciesDirect: ${error.message} for taskSpec: ${taskSpec}, dependencySpec: ${dependencySpec}`
		);
		console.error(
			chalk.red(
				`Critical error in bulkAddDependenciesDirect: ${error.message}`
			),
			error.stack
		);
		return {
			success: false,
			error: `An unexpected error occurred: ${error.message}`
		};
	} finally {
		disableSilentMode();
	}
}
