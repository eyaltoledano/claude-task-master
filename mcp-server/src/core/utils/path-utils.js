/**
 * path-utils.js
 * Utility functions for file path operations in Task Master
 *
 * This module provides robust path resolution for both:
 * 1. PACKAGE PATH: Where task-master code is installed
 *    (global node_modules OR local ./node_modules/task-master OR direct from repo)
 * 2. PROJECT PATH: Where user's tasks.json resides (typically user's project root)
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';

// Store last found project root to improve performance on subsequent calls (primarily for CLI)
export let lastFoundProjectRoot = null;

// Project marker files that indicate a potential project root
export const PROJECT_MARKERS = [
	// Task Master specific
	'tasks.json',
	'tasks/tasks.json',

	// Common version control
	'.git',
	'.svn',

	// Common package files
	'package.json',
	'pyproject.toml',
	'Gemfile',
	'go.mod',
	'Cargo.toml',

	// Common IDE/editor folders
	'.cursor',
	'.vscode',
	'.idea',

	// Common dependency directories (check if directory)
	'node_modules',
	'venv',
	'.venv',

	// Common config files
	'.env',
	'.eslintrc',
	'tsconfig.json',
	'babel.config.js',
	'jest.config.js',
	'webpack.config.js',

	// Common CI/CD files
	'.github/workflows',
	'.gitlab-ci.yml',
	'.circleci/config.yml'
];

/**
 * Gets the path to the task-master package installation directory
 * NOTE: This might become unnecessary if CLI fallback in MCP utils is removed.
 * @returns {string} - Absolute path to the package installation directory
 */
export function getPackagePath() {
	// When running from source, __dirname is the directory containing this file
	// When running from npm, we need to find the package root
	const thisFilePath = fileURLToPath(import.meta.url);
	const thisFileDir = path.dirname(thisFilePath);

	// Navigate from core/utils up to the package root
	// In dev: /path/to/task-master/mcp-server/src/core/utils -> /path/to/task-master
	// In npm: /path/to/node_modules/task-master/mcp-server/src/core/utils -> /path/to/node_modules/task-master
	return path.resolve(thisFileDir, '../../../../');
}

/**
 * Finds the absolute path to the tasks.json file based on project root and arguments.
 * @param {Object} args - Command arguments, potentially including 'projectRoot' and 'file'.
 * @param {Object} log - Logger object.
 * @returns {string} - Absolute path to the tasks.json file.
 * @throws {Error} - If tasks.json cannot be found.
 */
export function findTasksJsonPath(args, log) {
	// PRECEDENCE ORDER for finding tasks.json:
	// 1. Explicitly provided `projectRoot` in args (Highest priority, expected in MCP context)
	// 2. Previously found/cached `lastFoundProjectRoot` (primarily for CLI performance)
	// 3. Search upwards from current working directory (`process.cwd()`) - CLI usage

	// 1. If project root is explicitly provided (e.g., from MCP session), use it directly
	if (args.projectRoot) {
		const projectRoot = args.projectRoot;
		log.info(`Using explicitly provided project root: ${projectRoot}`);
		try {
			// This will throw if tasks.json isn't found within this root
			return findTasksJsonInDirectory(projectRoot, args.file, log);
		} catch (error) {
			// Include debug info in error
			const debugInfo = {
				projectRoot,
				currentDir: process.cwd(),
				serverDir: path.dirname(process.argv[1]),
				possibleProjectRoot: path.resolve(
					path.dirname(process.argv[1]),
					'../..'
				),
				lastFoundProjectRoot,
				searchedPaths: error.message
			};

			error.message = `Tasks file not found in any of the expected locations relative to project root "${projectRoot}" (from session).\nDebug Info: ${JSON.stringify(debugInfo, null, 2)}`;
			throw error;
		}
	}

	// --- Fallback logic primarily for CLI or when projectRoot isn't passed ---

	// 2. If we have a last known project root that worked, try it first
	if (lastFoundProjectRoot) {
		log.info(`Trying last known project root: ${lastFoundProjectRoot}`);
		try {
			// Use the cached root
			const tasksPath = findTasksJsonInDirectory(
				lastFoundProjectRoot,
				args.file,
				log
			);
			return tasksPath; // Return if found in cached root
		} catch (error) {
			log.info(
				`Task file not found in last known project root, continuing search.`
			);
			// Continue with search if not found in cache
		}
	}

	// 3. Start search from current directory (most common CLI scenario)
	const startDir = process.cwd();
	log.info(
		`Searching for tasks.json starting from current directory: ${startDir}`
	);

	// Try to find tasks.json by walking up the directory tree from cwd
	try {
		// This will throw if not found in the CWD tree
		return findTasksJsonWithParentSearch(startDir, args.file, log);
	} catch (error) {
		// If all attempts fail, augment and throw the original error from CWD search
		error.message = `${error.message}\n\nPossible solutions:\n1. Run the command from your project directory containing tasks.json\n2. Use --project-root=/path/to/project to specify the project location (if using CLI)\n3. Ensure the project root is correctly passed from the client (if using MCP)\n\nCurrent working directory: ${startDir}\nLast known project root: ${lastFoundProjectRoot}\nProject root from args: ${args.projectRoot}`;
		throw error;
	}
}

/**
 * Check if a directory contains any project marker files or directories
 * @param {string} dirPath - Directory to check
 * @returns {boolean} - True if the directory contains any project markers
 */
function hasProjectMarkers(dirPath) {
	return PROJECT_MARKERS.some((marker) => {
		const markerPath = path.join(dirPath, marker);
		// Check if the marker exists as either a file or directory
		return fs.existsSync(markerPath);
	});
}

/**
 * Search for tasks.json in a specific directory
 * @param {string} dirPath - Directory to search in
 * @param {string} explicitFilePath - Optional explicit file path relative to dirPath
 * @param {Object} log - Logger object
 * @returns {string} - Absolute path to tasks.json
 * @throws {Error} - If tasks.json cannot be found
 */
function findTasksJsonInDirectory(dirPath, explicitFilePath, log) {
	const possiblePaths = [];

	// 1. If a file is explicitly provided relative to dirPath
	if (explicitFilePath) {
		possiblePaths.push(path.resolve(dirPath, explicitFilePath));
	}

	// 2. Check the standard locations relative to dirPath
	possiblePaths.push(
		path.join(dirPath, 'tasks.json'),
		path.join(dirPath, 'tasks', 'tasks.json')
	);

	log.info(`Checking potential task file paths: ${possiblePaths.join(', ')}`);

	// Find the first existing path
	for (const p of possiblePaths) {
		log.info(`Checking if exists: ${p}`);
		const exists = fs.existsSync(p);
		log.info(`Path ${p} exists: ${exists}`);

		if (exists) {
			log.info(`Found tasks file at: ${p}`);
			// Store the project root for future use
			lastFoundProjectRoot = dirPath;
			return p;
		}
	}

	// If no file was found, throw an error
	const error = new Error(
		`Tasks file not found in any of the expected locations relative to ${dirPath}: ${possiblePaths.join(', ')}`
	);
	error.code = 'TASKS_FILE_NOT_FOUND';
	throw error;
}

/**
 * Recursively search for tasks.json in the given directory and parent directories
 * Also looks for project markers to identify potential project roots
 * @param {string} startDir - Directory to start searching from
 * @param {string} explicitFilePath - Optional explicit file path
 * @param {Object} log - Logger object
 * @returns {string} - Absolute path to tasks.json
 * @throws {Error} - If tasks.json cannot be found in any parent directory
 */
function findTasksJsonWithParentSearch(startDir, explicitFilePath, log) {
	let currentDir = startDir;
	const rootDir = path.parse(currentDir).root;

	// Keep traversing up until we hit the root directory
	while (currentDir !== rootDir) {
		// First check for tasks.json directly
		try {
			return findTasksJsonInDirectory(currentDir, explicitFilePath, log);
		} catch (error) {
			// If tasks.json not found but the directory has project markers,
			// log it as a potential project root (helpful for debugging)
			if (hasProjectMarkers(currentDir)) {
				log.info(`Found project markers in ${currentDir}, but no tasks.json`);
			}

			// Move up to parent directory
			const parentDir = path.dirname(currentDir);

			// Check if we've reached the root
			if (parentDir === currentDir) {
				break;
			}

			log.info(
				`Tasks file not found in ${currentDir}, searching in parent directory: ${parentDir}`
			);
			currentDir = parentDir;
		}
	}

	// If we've searched all the way to the root and found nothing
	const error = new Error(
		`Tasks file not found in ${startDir} or any parent directory.`
	);
	error.code = 'TASKS_FILE_NOT_FOUND';
	throw error;
}

// Note: findTasksWithNpmConsideration is not used by findTasksJsonPath and might be legacy or used elsewhere.
// If confirmed unused, it could potentially be removed in a separate cleanup.
function findTasksWithNpmConsideration(startDir, log) {
	// First try our recursive parent search from cwd
	try {
		return findTasksJsonWithParentSearch(startDir, null, log);
	} catch (error) {
		// If that fails, try looking relative to the executable location
		const execPath = process.argv[1];
		const execDir = path.dirname(execPath);
		log.info(`Looking for tasks file relative to executable at: ${execDir}`);

		try {
			return findTasksJsonWithParentSearch(execDir, null, log);
		} catch (secondError) {
			// If that also fails, check standard locations in user's home directory
			const homeDir = os.homedir();
			log.info(`Looking for tasks file in home directory: ${homeDir}`);

			try {
				// Check standard locations in home dir
				return findTasksJsonInDirectory(
					path.join(homeDir, '.task-master'),
					null,
					log
				);
			} catch (thirdError) {
				// If all approaches fail, throw the original error
				throw error;
			}
		}
	}
}

/**
 * Finds potential PRD document files based on common naming patterns
 * @param {string} projectRoot - The project root directory
 * @param {string|null} explicitPath - Optional explicit path provided by the user
 * @param {Object} log - Logger object
 * @returns {string|null} - The path to the first found PRD file, or null if none found
 */
export function findPRDDocumentPath(projectRoot, explicitPath, log) {
	// If explicit path is provided, check if it exists
	if (explicitPath) {
		const fullPath = path.isAbsolute(explicitPath)
			? explicitPath
			: path.resolve(projectRoot, explicitPath);

		if (fs.existsSync(fullPath)) {
			log.info(`Using provided PRD document path: ${fullPath}`);
			return fullPath;
		} else {
			log.warn(
				`Provided PRD document path not found: ${fullPath}, will search for alternatives`
			);
		}
	}

	// Common locations and file patterns for PRD documents
	const commonLocations = [
		'', // Project root
		'scripts/'
	];

	const commonFileNames = ['PRD.md', 'prd.md', 'PRD.txt', 'prd.txt'];

	// Check all possible combinations
	for (const location of commonLocations) {
		for (const fileName of commonFileNames) {
			const potentialPath = path.join(projectRoot, location, fileName);
			if (fs.existsSync(potentialPath)) {
				log.info(`Found PRD document at: ${potentialPath}`);
				return potentialPath;
			}
		}
	}

	log.warn(`No PRD document found in common locations within ${projectRoot}`);
	return null;
}

/**
 * Resolves the tasks output directory path
 * @param {string} projectRoot - The project root directory
 * @param {string|null} explicitPath - Optional explicit output path provided by the user
 * @param {Object} log - Logger object
 * @returns {string} - The resolved tasks directory path
 */
export function resolveTasksOutputPath(projectRoot, explicitPath, log) {
	// If explicit path is provided, use it
	if (explicitPath) {
		const outputPath = path.isAbsolute(explicitPath)
			? explicitPath
			: path.resolve(projectRoot, explicitPath);

		log.info(`Using provided tasks output path: ${outputPath}`);
		return outputPath;
	}

	// Default output path: tasks/tasks.json in the project root
	const defaultPath = path.resolve(projectRoot, 'tasks', 'tasks.json');
	log.info(`Using default tasks output path: ${defaultPath}`);

	// Ensure the directory exists
	const outputDir = path.dirname(defaultPath);
	if (!fs.existsSync(outputDir)) {
		log.info(`Creating tasks directory: ${outputDir}`);
		fs.mkdirSync(outputDir, { recursive: true });
	}

	return defaultPath;
}

/**
 * Resolves various file paths needed for MCP operations based on project root
 * @param {string} projectRoot - The project root directory
 * @param {Object} args - Command arguments that may contain explicit paths
 * @param {Object} log - Logger object
 * @returns {Object} - An object containing resolved paths
 */
export function resolveProjectPaths(projectRoot, args, log) {
	const prdPath = findPRDDocumentPath(projectRoot, args.input, log);
	const tasksJsonPath = resolveTasksOutputPath(projectRoot, args.output, log);

	// You can add more path resolutions here as needed

	return {
		projectRoot,
		prdPath,
		tasksJsonPath
		// Add additional path properties as needed
	};
}
