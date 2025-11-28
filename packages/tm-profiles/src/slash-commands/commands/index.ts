/**
 * @fileoverview Slash Commands Index
 * Exports all TaskMaster slash commands.
 */

// Static commands
import { expandAllTasks } from './expand-all-tasks.js';
import { fixDependencies } from './fix-dependencies.js';
import { installTaskmaster } from './install-taskmaster.js';
import { listTasksWithSubtasks } from './list-tasks-with-subtasks.js';
import { quickInstallTaskmaster } from './quick-install-taskmaster.js';
import { removeAllSubtasks } from './remove-all-subtasks.js';
import { setupModels } from './setup-models.js';
import { tmMain } from './tm-main.js';
import { validateDependencies } from './validate-dependencies.js';
import { viewModels } from './view-models.js';

// Dynamic commands
import { addDependency } from './add-dependency.js';
import { addSubtask } from './add-subtask.js';
import { addTask } from './add-task.js';
import { analyzeComplexity } from './analyze-complexity.js';
import { analyzeProject } from './analyze-project.js';
import { autoImplementTasks } from './auto-implement-tasks.js';
import { commandPipeline } from './command-pipeline.js';
import { complexityReport } from './complexity-report.js';
import { convertTaskToSubtask } from './convert-task-to-subtask.js';
import { expandTask } from './expand-task.js';
import { goham } from './goham.js';
import { help } from './help.js';
import { initProject } from './init-project.js';
import { initProjectQuick } from './init-project-quick.js';
import { learn } from './learn.js';
import { listTasks } from './list-tasks.js';
import { listTasksByStatus } from './list-tasks-by-status.js';
import { nextTask } from './next-task.js';
import { parsePrd } from './parse-prd.js';
import { parsePrdWithResearch } from './parse-prd-with-research.js';
import { projectStatus } from './project-status.js';
import { removeDependency } from './remove-dependency.js';
import { removeSubtask } from './remove-subtask.js';
import { removeSubtasks } from './remove-subtasks.js';
import { removeTask } from './remove-task.js';
import { showTask } from './show-task.js';
import { smartWorkflow } from './smart-workflow.js';
import { syncReadme } from './sync-readme.js';
import { toCancelled } from './to-cancelled.js';
import { toDeferred } from './to-deferred.js';
import { toDone } from './to-done.js';
import { toInProgress } from './to-in-progress.js';
import { toPending } from './to-pending.js';
import { toReview } from './to-review.js';
import { updateSingleTask } from './update-single-task.js';
import { updateTask } from './update-task.js';
import { updateTasksFromId } from './update-tasks-from-id.js';

/**
 * All TaskMaster slash commands
 * Add new commands here to have them automatically distributed to all profiles.
 */
export const allCommands = [
	// Static commands
	expandAllTasks,
	fixDependencies,
	installTaskmaster,
	listTasksWithSubtasks,
	quickInstallTaskmaster,
	removeAllSubtasks,
	setupModels,
	tmMain,
	validateDependencies,
	viewModels,

	// Dynamic commands
	addDependency,
	addSubtask,
	addTask,
	analyzeComplexity,
	analyzeProject,
	autoImplementTasks,
	commandPipeline,
	complexityReport,
	convertTaskToSubtask,
	expandTask,
	goham,
	help,
	initProject,
	initProjectQuick,
	learn,
	listTasks,
	listTasksByStatus,
	nextTask,
	parsePrd,
	parsePrdWithResearch,
	projectStatus,
	removeDependency,
	removeSubtask,
	removeSubtasks,
	removeTask,
	showTask,
	smartWorkflow,
	syncReadme,
	toCancelled,
	toDeferred,
	toDone,
	toInProgress,
	toPending,
	toReview,
	updateSingleTask,
	updateTask,
	updateTasksFromId
];

// Named exports for direct access
export {
	// Static commands
	expandAllTasks,
	fixDependencies,
	installTaskmaster,
	listTasksWithSubtasks,
	quickInstallTaskmaster,
	removeAllSubtasks,
	setupModels,
	tmMain,
	validateDependencies,
	viewModels,
	// Dynamic commands
	addDependency,
	addSubtask,
	addTask,
	analyzeComplexity,
	analyzeProject,
	autoImplementTasks,
	commandPipeline,
	complexityReport,
	convertTaskToSubtask,
	expandTask,
	goham,
	help,
	initProject,
	initProjectQuick,
	learn,
	listTasks,
	listTasksByStatus,
	nextTask,
	parsePrd,
	parsePrdWithResearch,
	projectStatus,
	removeDependency,
	removeSubtask,
	removeSubtasks,
	removeTask,
	showTask,
	smartWorkflow,
	syncReadme,
	toCancelled,
	toDeferred,
	toDone,
	toInProgress,
	toPending,
	toReview,
	updateSingleTask,
	updateTask,
	updateTasksFromId
};
