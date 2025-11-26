/**
 * task-manager.js
 * Task management functions for the Task Master CLI
 */

import addSubtask from './task-manager/add-subtask.js';
import addTask from './task-manager/add-task.js';
import analyzeTaskComplexity from './task-manager/analyze-task-complexity.js';
import clearSubtasks from './task-manager/clear-subtasks.js';
import expandAllTasks from './task-manager/expand-all-tasks.js';
import expandTask from './task-manager/expand-task.js';
import findNextTask from './task-manager/find-next-task.js';
import isTaskDependentOn from './task-manager/is-task-dependent.js';
import listTasks from './task-manager/list-tasks.js';
import { migrateProject } from './task-manager/migrate.js';
import moveTask from './task-manager/move-task.js';
import parsePRD from './task-manager/parse-prd/index.js';
import removeSubtask from './task-manager/remove-subtask.js';
import removeTask from './task-manager/remove-task.js';
import { performResearch } from './task-manager/research.js';
import setResponseLanguage from './task-manager/response-language.js';
import {
	scopeDownTask,
	scopeUpTask,
	validateStrength
} from './task-manager/scope-adjustment.js';
import setTaskStatus from './task-manager/set-task-status.js';
import taskExists from './task-manager/task-exists.js';
import updateSingleTaskStatus from './task-manager/update-single-task-status.js';
import updateSubtaskById from './task-manager/update-subtask-by-id.js';
import updateTaskById from './task-manager/update-task-by-id.js';
import updateTasks from './task-manager/update-tasks.js';
import { findTaskById } from './utils.js';
import { readComplexityReport } from './utils.js';

// Export task manager functions
export {
	parsePRD,
	updateTasks,
	updateTaskById,
	updateSubtaskById,
	setTaskStatus,
	updateSingleTaskStatus,
	listTasks,
	expandTask,
	expandAllTasks,
	clearSubtasks,
	addTask,
	addSubtask,
	removeSubtask,
	findNextTask,
	analyzeTaskComplexity,
	removeTask,
	findTaskById,
	taskExists,
	isTaskDependentOn,
	setResponseLanguage,
	moveTask,
	readComplexityReport,
	migrateProject,
	performResearch,
	scopeUpTask,
	scopeDownTask,
	validateStrength
};
