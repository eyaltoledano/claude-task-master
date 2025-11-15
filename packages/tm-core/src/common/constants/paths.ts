/**
 * @fileoverview Path constants for Task Master Core
 * Defines all file paths and directory structure constants
 */

// .taskmaster directory structure paths
export const TASKMASTER_DIR = '.taskmaster';
export const TASKMASTER_TASKS_DIR = '.taskmaster/tasks';
export const TASKMASTER_DOCS_DIR = '.taskmaster/docs';
export const TASKMASTER_REPORTS_DIR = '.taskmaster/reports';
export const TASKMASTER_TEMPLATES_DIR = '.taskmaster/templates';

// Task Master configuration files
export const TASKMASTER_CONFIG_FILE = '.taskmaster/config.json';
export const TASKMASTER_STATE_FILE = '.taskmaster/state.json';
export const LEGACY_CONFIG_FILE = '.taskmasterconfig';

// Task Master report files
export const COMPLEXITY_REPORT_FILE =
	'.taskmaster/reports/task-complexity-report.json';
export const LEGACY_COMPLEXITY_REPORT_FILE =
	'scripts/task-complexity-report.json';

// Task Master PRD file paths
export const PRD_FILE = '.taskmaster/docs/prd.txt';
export const LEGACY_PRD_FILE = 'scripts/prd.txt';

// Task Master template files
export const EXAMPLE_PRD_FILE = '.taskmaster/templates/example_prd.txt';
export const LEGACY_EXAMPLE_PRD_FILE = 'scripts/example_prd.txt';

// Task Master task file paths
export const TASKMASTER_TASKS_FILE = '.taskmaster/tasks/tasks.json';
export const LEGACY_TASKS_FILE = 'tasks/tasks.json';

// General project files (not Task Master specific but commonly used)
export const ENV_EXAMPLE_FILE = '.env.example';
export const GITIGNORE_FILE = '.gitignore';

// Task file naming pattern
export const TASK_FILE_PREFIX = 'task_';
export const TASK_FILE_EXTENSION = '.txt';

/**
 * Task Master specific markers (absolute highest priority)
 * ONLY truly Task Master-specific markers that uniquely identify a Task Master project
 */
export const TASKMASTER_PROJECT_MARKERS = [
	'.taskmaster', // Task Master directory
	TASKMASTER_CONFIG_FILE, // .taskmaster/config.json
	TASKMASTER_TASKS_FILE, // .taskmaster/tasks/tasks.json
	LEGACY_CONFIG_FILE // .taskmasterconfig (legacy but still Task Master-specific)
] as const;

/**
 * Other project markers (only checked if no Task Master markers found)
 * Includes generic task files that could belong to any task runner/build system
 */
export const OTHER_PROJECT_MARKERS = [
	LEGACY_TASKS_FILE, // tasks/tasks.json (NOT Task Master-specific)
	'tasks.json', // Generic tasks file (NOT Task Master-specific)
	'.git', // Git repository
	'.svn', // SVN repository
	'package.json', // Node.js project
	'yarn.lock', // Yarn project
	'package-lock.json', // npm project
	'pnpm-lock.yaml', // pnpm project
	'Cargo.toml', // Rust project
	'go.mod', // Go project
	'pyproject.toml', // Python project
	'requirements.txt', // Python project
	'Gemfile', // Ruby project
	'composer.json' // PHP project
] as const;

/**
 * All project markers combined (for backward compatibility)
 * @deprecated Use TASKMASTER_PROJECT_MARKERS and OTHER_PROJECT_MARKERS separately
 */
export const PROJECT_MARKERS = [
	...TASKMASTER_PROJECT_MARKERS,
	...OTHER_PROJECT_MARKERS
] as const;
