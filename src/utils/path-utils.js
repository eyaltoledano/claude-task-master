/**
 * Path utility functions for Task Master
 * Provides centralized path resolution logic for both CLI and MCP use cases
 */

import path from 'path';
import fs from 'fs';
import {
	TASKMASTER_TASKS_FILE,
	LEGACY_TASKS_FILE,
	TASKMASTER_DOCS_DIR,
	TASKMASTER_REPORTS_DIR,
	COMPLEXITY_REPORT_FILE,
	TASKMASTER_CONFIG_FILE,
	LEGACY_CONFIG_FILE
} from '../constants/paths.js';
import { getLoggerOrDefault } from './logger-utils.js';

/**
 * Normalize project root to ensure it doesn't end with .taskmaster
 * This prevents double .taskmaster paths when using constants that include .taskmaster
 * @param {string} projectRoot - The project root path to normalize
 * @returns {string} - Normalized project root path
 */
export function normalizeProjectRoot(projectRoot) {
	if (!projectRoot) return projectRoot;

	// Split the path into segments
	const segments = projectRoot.split(path.sep);

	// Find the index of .taskmaster segment
	const taskmasterIndex = segments.findIndex(
		(segment) => segment === '.taskmaster'
	);

	if (taskmasterIndex !== -1) {
		// If .taskmaster is found, return everything up to but not including .taskmaster
		const normalizedSegments = segments.slice(0, taskmasterIndex);
		return normalizedSegments.join(path.sep) || path.sep;
	}

	return projectRoot;
}

/**
 * Find the project root directory by looking for project markers
 * @param {string} startDir - Directory to start searching from
 * @returns {string|null} - Project root path or null if not found
 */
export function findProjectRoot(startDir = process.cwd()) {
	const projectMarkers = [
		'.taskmaster',
		TASKMASTER_TASKS_FILE,
		'tasks.json',
		LEGACY_TASKS_FILE,
		'.git',
		'.svn',
		'package.json',
		'yarn.lock',
		'package-lock.json',
		'pnpm-lock.yaml'
	];

	let currentDir = path.resolve(startDir);
	const rootDir = path.parse(currentDir).root;

	while (currentDir !== rootDir) {
		// Check if current directory contains any project markers
		for (const marker of projectMarkers) {
			const markerPath = path.join(currentDir, marker);
			if (fs.existsSync(markerPath)) {
				return currentDir;
			}
		}
		currentDir = path.dirname(currentDir);
	}

	return null;
}

/**
 * Find the tasks.json file path with fallback logic
 * @param {string|null} explicitPath - Explicit path provided by user (highest priority)
 * @param {Object|null} args - Args object from MCP args (optional)
 * @param {Object|null} log - Logger object (optional)
 * @returns {string|null} - Resolved tasks.json path or null if not found
 */
export function findTasksPath(explicitPath = null, args = null, log = null) {
	// Use the passed logger if available, otherwise use the default logger
	const logger = getLoggerOrDefault(log);

	// 1. First determine project root to use as base for all path resolution
	const rawProjectRoot = args?.projectRoot || findProjectRoot();

	if (!rawProjectRoot) {
		logger.warn?.('Could not determine project root directory');
		return null;
	}

	// 2. Normalize project root to prevent double .taskmaster paths
	const projectRoot = normalizeProjectRoot(rawProjectRoot);

	// 3. If explicit path is provided, resolve it relative to project root (highest priority)
	if (explicitPath) {
		const resolvedPath = path.isAbsolute(explicitPath)
			? explicitPath
			: path.resolve(projectRoot, explicitPath);

		if (fs.existsSync(resolvedPath)) {
			logger.info?.(`Using explicit tasks path: ${resolvedPath}`);
			return resolvedPath;
		} else {
			logger.warn?.(
				`Explicit tasks path not found: ${resolvedPath}, trying fallbacks`
			);
		}
	}

	// 4. Check possible locations in order of preference
	const possiblePaths = [
		path.join(projectRoot, TASKMASTER_TASKS_FILE), // .taskmaster/tasks/tasks.json (NEW)
		path.join(projectRoot, LEGACY_TASKS_FILE) // tasks/tasks.json (LEGACY)
	];

	for (const tasksPath of possiblePaths) {
		if (fs.existsSync(tasksPath)) {
			logger.info?.(`Found tasks file at: ${tasksPath}`);

			// Issue deprecation warning for legacy paths
			if (
				tasksPath.includes('tasks/tasks.json') &&
				!tasksPath.includes('.taskmaster')
			) {
				logger.warn?.(
					`⚠️  DEPRECATION WARNING: Found tasks.json in legacy location '${tasksPath}'. Please migrate to the new .taskmaster directory structure. Run 'task-master migrate' to automatically migrate your project.`
				);
			} else if (
				tasksPath.endsWith('tasks.json') &&
				!tasksPath.includes('.taskmaster') &&
				!tasksPath.includes('tasks/')
			) {
				logger.warn?.(
					`⚠️  DEPRECATION WARNING: Found tasks.json in legacy root location '${tasksPath}'. Please migrate to the new .taskmaster directory structure. Run 'task-master migrate' to automatically migrate your project.`
				);
			}

			return tasksPath;
		}
	}

	logger.warn?.(`No tasks.json found in project: ${projectRoot}`);
	return null;
}

/**
 * Find the PRD document file path with fallback logic
 * @param {string|null} explicitPath - Explicit path provided by user (highest priority)
 * @param {Object|null} args - Args object for MCP context (optional)
 * @param {Object|null} log - Logger object (optional)
 * @returns {string|null} - Resolved PRD document path or null if not found
 */
export function findPRDPath(explicitPath = null, args = null, log = null) {
	const logger = getLoggerOrDefault(log);

	// 1. If explicit path is provided, use it (highest priority)
	if (explicitPath) {
		const resolvedPath = path.isAbsolute(explicitPath)
			? explicitPath
			: path.resolve(process.cwd(), explicitPath);

		if (fs.existsSync(resolvedPath)) {
			logger.info?.(`Using explicit PRD path: ${resolvedPath}`);
			return resolvedPath;
		} else {
			logger.warn?.(
				`Explicit PRD path not found: ${resolvedPath}, trying fallbacks`
			);
		}
	}

	// 2. Try to get project root from args (MCP) or find it
	const rawProjectRoot = args?.projectRoot || findProjectRoot();

	if (!rawProjectRoot) {
		logger.warn?.('Could not determine project root directory');
		return null;
	}

	// 3. Normalize project root to prevent double .taskmaster paths
	const projectRoot = normalizeProjectRoot(rawProjectRoot);

	// 4. Check possible locations in order of preference
	const locations = [
		TASKMASTER_DOCS_DIR, // .taskmaster/docs/ (NEW)
		'scripts/', // Legacy location
		'' // Project root
	];

	const fileNames = ['PRD.md', 'prd.md', 'PRD.txt', 'prd.txt'];

	for (const location of locations) {
		for (const fileName of fileNames) {
			const prdPath = path.join(projectRoot, location, fileName);
			if (fs.existsSync(prdPath)) {
				logger.info?.(`Found PRD document at: ${prdPath}`);

				// Issue deprecation warning for legacy paths
				if (location === 'scripts/' || location === '') {
					logger.warn?.(
						`⚠️  DEPRECATION WARNING: Found PRD file in legacy location '${prdPath}'. Please migrate to .taskmaster/docs/ directory. Run 'task-master migrate' to automatically migrate your project.`
					);
				}

				return prdPath;
			}
		}
	}

	logger.warn?.(`No PRD document found in project: ${projectRoot}`);
	return null;
}

/**
 * Find the complexity report file path with fallback logic
 * @param {string|null} explicitPath - Explicit path provided by user (highest priority)
 * @param {Object|null} args - Args object for MCP context (optional)
 * @param {Object|null} log - Logger object (optional)
 * @returns {string|null} - Resolved complexity report path or null if not found
 */
export function findComplexityReportPath(
	explicitPath = null,
	args = null,
	log = null
) {
	const logger = getLoggerOrDefault(log);

	// 1. If explicit path is provided, use it (highest priority)
	if (explicitPath) {
		const resolvedPath = path.isAbsolute(explicitPath)
			? explicitPath
			: path.resolve(process.cwd(), explicitPath);

		if (fs.existsSync(resolvedPath)) {
			logger.info?.(`Using explicit complexity report path: ${resolvedPath}`);
			return resolvedPath;
		} else {
			logger.warn?.(
				`Explicit complexity report path not found: ${resolvedPath}, trying fallbacks`
			);
		}
	}

	// 2. Try to get project root from args (MCP) or find it
	const rawProjectRoot = args?.projectRoot || findProjectRoot();

	if (!rawProjectRoot) {
		logger.warn?.('Could not determine project root directory');
		return null;
	}

	// 3. Normalize project root to prevent double .taskmaster paths
	const projectRoot = normalizeProjectRoot(rawProjectRoot);

	// 4. Check possible locations in order of preference
	const locations = [
		TASKMASTER_REPORTS_DIR, // .taskmaster/reports/ (NEW)
		'scripts/', // Legacy location
		'' // Project root
	];

	const fileNames = ['task-complexity-report.json', 'complexity-report.json'];

	for (const location of locations) {
		for (const fileName of fileNames) {
			const reportPath = path.join(projectRoot, location, fileName);
			if (fs.existsSync(reportPath)) {
				logger.info?.(`Found complexity report at: ${reportPath}`);

				// Issue deprecation warning for legacy paths
				if (location === 'scripts/' || location === '') {
					logger.warn?.(
						`⚠️  DEPRECATION WARNING: Found complexity report in legacy location '${reportPath}'. Please migrate to .taskmaster/reports/ directory. Run 'task-master migrate' to automatically migrate your project.`
					);
				}

				return reportPath;
			}
		}
	}

	logger.warn?.(`No complexity report found in project: ${projectRoot}`);
	return null;
}

/**
 * Resolve output path for tasks.json (create if needed)
 * @param {string|null} explicitPath - Explicit output path provided by user
 * @param {Object|null} args - Args object for MCP context (optional)
 * @param {Object|null} log - Logger object (optional)
 * @returns {string} - Resolved output path for tasks.json
 */
export function resolveTasksOutputPath(
	explicitPath = null,
	args = null,
	log = null
) {
	const logger = getLoggerOrDefault(log);

	// 1. If explicit path is provided, use it
	if (explicitPath) {
		const resolvedPath = path.isAbsolute(explicitPath)
			? explicitPath
			: path.resolve(process.cwd(), explicitPath);

		logger.info?.(`Using explicit output path: ${resolvedPath}`);
		return resolvedPath;
	}

	// 2. Try to get project root from args (MCP) or find it
	const rawProjectRoot =
		args?.projectRoot || findProjectRoot() || process.cwd();

	// 3. Normalize project root to prevent double .taskmaster paths
	const projectRoot = normalizeProjectRoot(rawProjectRoot);

	// 4. Use new .taskmaster structure by default
	const defaultPath = path.join(projectRoot, TASKMASTER_TASKS_FILE);
	logger.info?.(`Using default output path: ${defaultPath}`);

	// Ensure the directory exists
	const outputDir = path.dirname(defaultPath);
	if (!fs.existsSync(outputDir)) {
		logger.info?.(`Creating tasks directory: ${outputDir}`);
		fs.mkdirSync(outputDir, { recursive: true });
	}

	return defaultPath;
}

/**
 * Resolve output path for complexity report (create if needed)
 * @param {string|null} explicitPath - Explicit output path provided by user
 * @param {Object|null} args - Args object for MCP context (optional)
 * @param {Object|null} log - Logger object (optional)
 * @returns {string} - Resolved output path for complexity report
 */
export function resolveComplexityReportOutputPath(
	explicitPath = null,
	args = null,
	log = null
) {
	const logger = getLoggerOrDefault(log);

	// 1. If explicit path is provided, use it
	if (explicitPath) {
		const resolvedPath = path.isAbsolute(explicitPath)
			? explicitPath
			: path.resolve(process.cwd(), explicitPath);

		logger.info?.(
			`Using explicit complexity report output path: ${resolvedPath}`
		);
		return resolvedPath;
	}

	// 2. Try to get project root from args (MCP) or find it
	const rawProjectRoot =
		args?.projectRoot || findProjectRoot() || process.cwd();

	// 3. Normalize project root to prevent double .taskmaster paths
	const projectRoot = normalizeProjectRoot(rawProjectRoot);

	// 4. Use new .taskmaster structure by default
	const defaultPath = path.join(projectRoot, COMPLEXITY_REPORT_FILE);
	logger.info?.(`Using default complexity report output path: ${defaultPath}`);

	// Ensure the directory exists
	const outputDir = path.dirname(defaultPath);
	if (!fs.existsSync(outputDir)) {
		logger.info?.(`Creating reports directory: ${outputDir}`);
		fs.mkdirSync(outputDir, { recursive: true });
	}

	return defaultPath;
}

/**
 * Find the configuration file path with fallback logic
 * @param {string|null} explicitPath - Explicit path provided by user (highest priority)
 * @param {Object|null} args - Args object for MCP context (optional)
 * @param {Object|null} log - Logger object (optional)
 * @returns {string|null} - Resolved config file path or null if not found
 */
export function findConfigPath(explicitPath = null, args = null, log = null) {
	const logger = getLoggerOrDefault(log);

	// 1. If explicit path is provided, use it (highest priority)
	if (explicitPath) {
		const resolvedPath = path.isAbsolute(explicitPath)
			? explicitPath
			: path.resolve(process.cwd(), explicitPath);

		if (fs.existsSync(resolvedPath)) {
			logger.info?.(`Using explicit config path: ${resolvedPath}`);
			return resolvedPath;
		} else {
			logger.warn?.(
				`Explicit config path not found: ${resolvedPath}, trying fallbacks`
			);
		}
	}

	// 2. Try to get project root from args (MCP) or find it
	const rawProjectRoot = args?.projectRoot || findProjectRoot();

	if (!rawProjectRoot) {
		logger.warn?.('Could not determine project root directory');
		return null;
	}

	// 3. Normalize project root to prevent double .taskmaster paths
	const projectRoot = normalizeProjectRoot(rawProjectRoot);

	// 4. Check possible locations in order of preference
	const possiblePaths = [
		path.join(projectRoot, TASKMASTER_CONFIG_FILE), // NEW location
		path.join(projectRoot, LEGACY_CONFIG_FILE) // LEGACY location
	];

	for (const configPath of possiblePaths) {
		if (fs.existsSync(configPath)) {
			// Issue deprecation warning for legacy paths
			if (configPath?.endsWith(LEGACY_CONFIG_FILE)) {
				logger.warn?.(
					`⚠️  DEPRECATION WARNING: Found configuration in legacy location '${configPath}'. Please migrate to .taskmaster/config.json. Run 'task-master migrate' to automatically migrate your project.`
				);
			}

			return configPath;
		}
	}

	logger.warn?.(`No configuration file found in project: ${projectRoot}`);
	return null;
}
