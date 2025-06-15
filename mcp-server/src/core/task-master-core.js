/**
 * task-master-core.js
 * Central module that imports and re-exports all direct function implementations
 * for improved organization and maintainability.
 */

// Import direct function implementations
import { listTasksDirect } from './direct-functions/list-tasks.js';
import { getCacheStatsDirect } from './direct-functions/cache-stats.js';
import { parsePRDDirect } from './direct-functions/parse-prd.js';
import { updateTasksDirect } from './direct-functions/update-tasks.js';
import { updateTaskByIdDirect } from './direct-functions/update-task-by-id.js';
import { updateSubtaskByIdDirect } from './direct-functions/update-subtask-by-id.js';
import { generateTaskFilesDirect } from './direct-functions/generate-task-files.js';
import { setTaskStatusDirect } from './direct-functions/set-task-status.js';
import { showTaskDirect } from './direct-functions/show-task.js';
import { nextTaskDirect } from './direct-functions/next-task.js';
import { expandTaskDirect } from './direct-functions/expand-task.js';
import { addTaskDirect } from './direct-functions/add-task.js';
import { addSubtaskDirect } from './direct-functions/add-subtask.js';
import { removeSubtaskDirect } from './direct-functions/remove-subtask.js';
import { analyzeTaskComplexityDirect } from './direct-functions/analyze-task-complexity.js';
import { clearSubtasksDirect } from './direct-functions/clear-subtasks.js';
import { expandAllTasksDirect } from './direct-functions/expand-all-tasks.js';
import { removeDependencyDirect } from './direct-functions/remove-dependency.js';
import { validateDependenciesDirect } from './direct-functions/validate-dependencies.js';
import { fixDependenciesDirect } from './direct-functions/fix-dependencies.js';
import { complexityReportDirect } from './direct-functions/complexity-report.js';
import { addDependencyDirect } from './direct-functions/add-dependency.js';
import { removeTaskDirect } from './direct-functions/remove-task.js';
import { initializeProjectDirect } from './direct-functions/initialize-project.js';
import { modelsDirect } from './direct-functions/models.js';
import { moveTaskDirect } from './direct-functions/move-task.js';
import { researchDirect } from './direct-functions/research.js';
import { addTagDirect } from './direct-functions/add-tag.js';
import { deleteTagDirect } from './direct-functions/delete-tag.js';
import { listTagsDirect } from './direct-functions/list-tags.js';
import { useTagDirect } from './direct-functions/use-tag.js';
import { renameTagDirect } from './direct-functions/rename-tag.js';
import { copyTagDirect } from './direct-functions/copy-tag.js';

// Re-export utility functions
export { findTasksPath } from './utils/path-utils.js';

// Use Map for potential future enhancements like introspection or dynamic dispatch
export const directFunctions = new Map([
	['listTasksDirect', listTasksDirect],
	['getCacheStatsDirect', getCacheStatsDirect],
	['parsePRDDirect', parsePRDDirect],
	['updateTasksDirect', updateTasksDirect],
	['updateTaskByIdDirect', updateTaskByIdDirect],
	['updateSubtaskByIdDirect', updateSubtaskByIdDirect],
	['generateTaskFilesDirect', generateTaskFilesDirect],
	['setTaskStatusDirect', setTaskStatusDirect],
	['showTaskDirect', showTaskDirect],
	['nextTaskDirect', nextTaskDirect],
	['expandTaskDirect', expandTaskDirect],
	['addTaskDirect', addTaskDirect],
	['addSubtaskDirect', addSubtaskDirect],
	['removeSubtaskDirect', removeSubtaskDirect],
	['analyzeTaskComplexityDirect', analyzeTaskComplexityDirect],
	['clearSubtasksDirect', clearSubtasksDirect],
	['expandAllTasksDirect', expandAllTasksDirect],
	['removeDependencyDirect', removeDependencyDirect],
	['validateDependenciesDirect', validateDependenciesDirect],
	['fixDependenciesDirect', fixDependenciesDirect],
	['complexityReportDirect', complexityReportDirect],
	['addDependencyDirect', addDependencyDirect],
	['removeTaskDirect', removeTaskDirect],
	['initializeProjectDirect', initializeProjectDirect],
	['modelsDirect', modelsDirect],
	['moveTaskDirect', moveTaskDirect],
	['researchDirect', researchDirect],
	['addTagDirect', addTagDirect],
	['deleteTagDirect', deleteTagDirect],
	['listTagsDirect', listTagsDirect],
	['useTagDirect', useTagDirect],
	['renameTagDirect', renameTagDirect],
	['copyTagDirect', copyTagDirect]
]);

// Re-export all direct function implementations
export {
	listTasksDirect,
	getCacheStatsDirect,
	parsePRDDirect,
	updateTasksDirect,
	updateTaskByIdDirect,
	updateSubtaskByIdDirect,
	generateTaskFilesDirect,
	setTaskStatusDirect,
	showTaskDirect,
	nextTaskDirect,
	expandTaskDirect,
	addTaskDirect,
	addSubtaskDirect,
	removeSubtaskDirect,
	analyzeTaskComplexityDirect,
	clearSubtasksDirect,
	expandAllTasksDirect,
	removeDependencyDirect,
	validateDependenciesDirect,
	fixDependenciesDirect,
	complexityReportDirect,
	addDependencyDirect,
	removeTaskDirect,
	initializeProjectDirect,
	modelsDirect,
	moveTaskDirect,
	researchDirect,
	addTagDirect,
	deleteTagDirect,
	listTagsDirect,
	useTagDirect,
	renameTagDirect,
	copyTagDirect
};
