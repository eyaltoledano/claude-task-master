/**
 * @fileoverview Solo Mode Commands
 * Commands that only work with local file-based storage (Taskmaster standalone).
 */

// PRD parsing
export { parsePrd } from './parse-prd.js';
export { parsePrdWithResearch } from './parse-prd-with-research.js';

// Analysis
export { analyzeComplexity } from './analyze-complexity.js';
export { complexityReport } from './complexity-report.js';

// Task expansion
export { expandTask } from './expand-task.js';
export { expandAllTasks } from './expand-all-tasks.js';

// Task mutation
export { addTask } from './add-task.js';
export { addSubtask } from './add-subtask.js';
export { removeTask } from './remove-task.js';
export { removeSubtask } from './remove-subtask.js';
export { removeSubtasks } from './remove-subtasks.js';
export { removeAllSubtasks } from './remove-all-subtasks.js';
export { convertTaskToSubtask } from './convert-task-to-subtask.js';

// Dependencies
export { addDependency } from './add-dependency.js';
export { removeDependency } from './remove-dependency.js';
export { fixDependencies } from './fix-dependencies.js';
export { validateDependencies } from './validate-dependencies.js';

// Configuration
export { setupModels } from './setup-models.js';
export { viewModels } from './view-models.js';
export { installTaskmaster } from './install-taskmaster.js';
export { quickInstallTaskmaster } from './quick-install-taskmaster.js';

// Status (solo-only)
export { toReview } from './to-review.js';
export { toDeferred } from './to-deferred.js';
export { toCancelled } from './to-cancelled.js';

// Init
export { initProject } from './init-project.js';
export { initProjectQuick } from './init-project-quick.js';

// Generation
export { generateTasks } from './generate-tasks.js';
