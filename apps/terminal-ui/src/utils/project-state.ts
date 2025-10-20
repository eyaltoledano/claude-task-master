/**
 * @fileoverview Project State Detection Utility
 * Detects the current state of a Task Master project to determine onboarding flow
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Project state enum
 */
export enum ProjectState {
	/** .taskmaster directory doesn't exist */
	UNINITIALIZED = 'uninitialized',
	/** .taskmaster exists but no tasks.json or no tasks */
	NO_TASKS = 'no-tasks',
	/** .taskmaster exists with tasks */
	HAS_TASKS = 'has-tasks',
	/** Error detecting state */
	ERROR = 'error'
}

/**
 * Project state detection result
 */
export interface ProjectStateResult {
	state: ProjectState;
	projectPath: string;
	taskMasterPath: string;
	tasksJsonPath: string;
	taskCount?: number;
	error?: string;
}

/**
 * Detects the current state of a Task Master project
 * @param projectPath - Root path of the project (defaults to cwd)
 * @returns Project state detection result
 */
export function detectProjectState(
	projectPath: string = process.cwd()
): ProjectStateResult {
	const taskMasterPath = join(projectPath, '.taskmaster');
	const tasksJsonPath = join(taskMasterPath, 'tasks', 'tasks.json');

	const result: ProjectStateResult = {
		state: ProjectState.ERROR,
		projectPath,
		taskMasterPath,
		tasksJsonPath
	};

	try {
		// Check if .taskmaster directory exists
		if (!existsSync(taskMasterPath)) {
			result.state = ProjectState.UNINITIALIZED;
			return result;
		}

		// Check if tasks.json exists
		if (!existsSync(tasksJsonPath)) {
			result.state = ProjectState.NO_TASKS;
			return result;
		}

		// Try to read tasks.json and count tasks
		try {
			const tasksContent = readFileSync(tasksJsonPath, 'utf-8');
			const tasksData = JSON.parse(tasksContent);

			// Count tasks in the master tag (or default tag)
			const masterTasks = tasksData.master?.tasks || tasksData.tasks || [];
			result.taskCount = Array.isArray(masterTasks) ? masterTasks.length : 0;

			if (result.taskCount === 0) {
				result.state = ProjectState.NO_TASKS;
			} else {
				result.state = ProjectState.HAS_TASKS;
			}

			return result;
		} catch (parseError) {
			// tasks.json exists but couldn't be parsed
			result.state = ProjectState.ERROR;
			result.error = `Failed to parse tasks.json: ${parseError instanceof Error ? parseError.message : String(parseError)}`;
			return result;
		}
	} catch (error) {
		result.state = ProjectState.ERROR;
		result.error = `Failed to detect project state: ${error instanceof Error ? error.message : String(error)}`;
		return result;
	}
}

/**
 * Checks if a project is initialized
 * @param projectPath - Root path of the project
 * @returns true if project has .taskmaster directory
 */
export function isProjectInitialized(
	projectPath: string = process.cwd()
): boolean {
	const taskMasterPath = join(projectPath, '.taskmaster');
	return existsSync(taskMasterPath);
}

/**
 * Checks if a project has tasks
 * @param projectPath - Root path of the project
 * @returns true if project has tasks in tasks.json
 */
export function projectHasTasks(projectPath: string = process.cwd()): boolean {
	const result = detectProjectState(projectPath);
	return result.state === ProjectState.HAS_TASKS && (result.taskCount ?? 0) > 0;
}

/**
 * Gets project task count
 * @param projectPath - Root path of the project
 * @returns Number of tasks or 0 if unable to determine
 */
export function getProjectTaskCount(
	projectPath: string = process.cwd()
): number {
	const result = detectProjectState(projectPath);
	return result.taskCount ?? 0;
}
