// web/utils.js - Simplified utilities without test mode directory logic
import path from 'path';
import fs from 'fs';

/**
 * Get the Task Master directory path
 * @param {string} projectRoot - Project root directory
 * @returns {string} - Task Master directory path
 */
export function getTaskMasterDirectory(projectRoot) {
	return path.join(projectRoot, '.taskmaster');
}

/**
 * Get the tasks file path
 * @param {string} projectRoot - Project root directory
 * @returns {string} - Tasks file path
 */
export function getTasksFilePath(projectRoot) {
	return path.join(getTaskMasterDirectory(projectRoot), 'tasks', 'tasks.json');
}

/**
 * Get the config file path
 * @param {string} projectRoot - Project root directory
 * @returns {string} - Config file path
 */
export function getConfigFilePath(projectRoot) {
	return path.join(getTaskMasterDirectory(projectRoot), 'config.json');
}

/**
 * Get the state file path
 * @param {string} projectRoot - Project root directory
 * @returns {string} - State file path
 */
export function getStateFilePath(projectRoot) {
	return path.join(getTaskMasterDirectory(projectRoot), 'state.json');
}

/**
 * Get the web server state file path
 * @param {string} projectRoot - Project root directory
 * @returns {string} - Web server state file path
 */
export function getWebServerStateFilePath(projectRoot) {
	return path.join(
		getTaskMasterDirectory(projectRoot),
		'web-server-state.json'
	);
}

/**
 * Get the reports directory path
 * @param {string} projectRoot - Project root directory
 * @returns {string} - Reports directory path
 */
export function getReportsDirectory(projectRoot) {
	return path.join(getTaskMasterDirectory(projectRoot), 'reports');
}

/**
 * Find project root by walking up the directory tree
 * Minimal implementation for web server only
 * @param {string} startDir - Directory to start searching from
 * @returns {string} - Project root path or current directory as fallback
 */
export function findWebServerProjectRoot(startDir = process.cwd()) {
	// Project markers to look for (in order of preference)
	const markers = [
		'.taskmaster', // Primary Task Master marker
		'tasks.json', // Legacy tasks file
		'.git', // Git repository
		'package.json', // Node.js project
		'yarn.lock', // Yarn project
		'package-lock.json', // NPM project
		'pnpm-lock.yaml' // PNPM project
	];

	let currentDir = path.resolve(startDir);
	const rootDir = path.parse(currentDir).root;

	// Walk up the directory tree
	while (currentDir !== rootDir) {
		// Check if any marker exists in current directory
		for (const marker of markers) {
			const markerPath = path.join(currentDir, marker);
			if (fs.existsSync(markerPath)) {
				console.log(`Found project root via ${marker}: ${currentDir}`);
				return currentDir;
			}
		}

		// Move up one directory
		currentDir = path.dirname(currentDir);
	}

	// Check root directory as well
	for (const marker of markers) {
		const markerPath = path.join(rootDir, marker);
		if (fs.existsSync(markerPath)) {
			console.log(`Found project root via ${marker} in root: ${rootDir}`);
			return rootDir;
		}
	}

	// Fallback to current directory with warning
	console.warn(
		`Warning: Could not find project root, using current directory: ${startDir}`
	);
	return startDir;
}

/**
 * Get project root with environment variable support
 * @param {string} [explicitRoot] - Explicit project root from command line
 * @returns {string} - Resolved project root path
 */
export function getWebServerProjectRoot(explicitRoot = null) {
	// 1. Check explicit project root from command line (highest priority)
	if (explicitRoot) {
		const resolvedRoot = path.isAbsolute(explicitRoot)
			? explicitRoot
			: path.resolve(process.cwd(), explicitRoot);

		console.log(
			`Using explicit project root from command line: ${resolvedRoot}`
		);
		return resolvedRoot;
	}

	// 2. Check TASK_MASTER_PROJECT_ROOT environment variable
	if (process.env.TASK_MASTER_PROJECT_ROOT) {
		const envRoot = process.env.TASK_MASTER_PROJECT_ROOT;
		const resolvedRoot = path.isAbsolute(envRoot)
			? envRoot
			: path.resolve(process.cwd(), envRoot);

		console.log(
			`Using project root from TASK_MASTER_PROJECT_ROOT: ${resolvedRoot}`
		);
		return resolvedRoot;
	}

	// 3. Fall back to directory tree walking
	return findWebServerProjectRoot();
}

/**
 * Ensure the Task Master directory structure exists
 * @param {string} projectRoot - Project root directory
 * @returns {void}
 */
export function ensureTaskMasterDirectoryStructure(projectRoot) {
	const taskMasterDir = getTaskMasterDirectory(projectRoot);
	const tasksDir = path.join(taskMasterDir, 'tasks');
	const reportsDir = path.join(taskMasterDir, 'reports');
	const tasksFile = path.join(tasksDir, 'tasks.json');

	// Create directories if they don't exist
	try {
		fs.mkdirSync(taskMasterDir, { recursive: true });
		fs.mkdirSync(tasksDir, { recursive: true });
		fs.mkdirSync(reportsDir, { recursive: true });

		// Create initial empty tasks.json file if it doesn't exist
		if (!fs.existsSync(tasksFile)) {
			const initialTasksData = {
				master: {
					tasks: [],
					metadata: {
						created: new Date().toISOString(),
						updated: new Date().toISOString(),
						description: 'Tasks for master context'
					}
				}
			};
			fs.writeFileSync(
				tasksFile,
				JSON.stringify(initialTasksData, null, 2),
				'utf8'
			);
		}
	} catch (error) {
		// Ignore errors if directories already exist
		if (error.code !== 'EEXIST') {
			throw error;
		}
	}
}
