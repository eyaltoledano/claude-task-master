/**
 * Path constants for Task Master application
 */

// .taskmaster directory structure paths
export const TASKMASTER_DIR = '.taskmaster';
export const TASKMASTER_TASKS_DIR = '.taskmaster/tasks';
export const TASKMASTER_DOCS_DIR = '.taskmaster/docs';
export const TASKMASTER_REPORTS_DIR = '.taskmaster/reports';
export const TASKMASTER_TEMPLATES_DIR = '.taskmaster/templates';

// Specific file paths
export const TASKMASTER_CONFIG_FILE = '.taskmaster/config.json';
export const LEGACY_CONFIG_FILE = '.taskmasterconfig';
export const COMPLEXITY_REPORT_FILE =
	'.taskmaster/reports/task-complexity-report.json';
export const LEGACY_COMPLEXITY_REPORT_FILE =
	'scripts/task-complexity-report.json';

// PRD file paths
export const PRD_FILE = '.taskmaster/docs/prd.txt';
export const LEGACY_PRD_FILE = 'scripts/prd.txt';

// Template files
export const EXAMPLE_PRD_FILE = '.taskmaster/templates/example_prd.txt';
export const LEGACY_EXAMPLE_PRD_FILE = 'scripts/example_prd.txt';

// Task file paths
export const TASKMASTER_TASKS_FILE = '.taskmaster/tasks/tasks.json';
export const LEGACY_TASKS_FILE = 'tasks/tasks.json';

// Task file naming pattern
export const TASK_FILE_PREFIX = 'task_';
export const TASK_FILE_EXTENSION = '.txt';
