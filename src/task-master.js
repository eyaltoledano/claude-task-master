/**
 * task-master.js
 * This module provides a centralized path management system for the Task Master application.
 * It exports the TaskMaster class and the initTaskMaster factory function to create a single,
 * authoritative source for all critical file and directory paths, resolving circular dependencies.
 */

import path from 'path';
import fs from 'fs';
import {
	TASKMASTER_DIR,
	TASKMASTER_TASKS_FILE,
	LEGACY_TASKS_FILE,
	TASKMASTER_DOCS_DIR,
	TASKMASTER_REPORTS_DIR,
	TASKMASTER_CONFIG_FILE,
	LEGACY_CONFIG_FILE
} from './constants/paths.js';

/**
 * TaskMaster class manages all the paths for the application.
 * An instance of this class is created by the initTaskMaster function.
 */
export class TaskMaster {
	#paths;

	/**
	 * The constructor is intended to be used only by the initTaskMaster factory function.
	 * @param {object} paths - A pre-resolved object of all application paths.
	 */
	constructor(paths) {
		this.#paths = Object.freeze({ ...paths });
	}

	/**
	 * @returns {string|null} The absolute path to the project root.
	 */
	getProjectRoot() {
		return this.#paths.projectRoot;
	}

	/**
	 * @returns {string|null} The absolute path to the .taskmaster directory.
	 */
	getTaskMasterDir() {
		return this.#paths.taskMasterDir;
	}

	/**
	 * @returns {string|null} The absolute path to the tasks.json file.
	 */
	getTasksPath() {
		return this.#paths.tasksPath;
	}

	/**
	 * @returns {string|null} The absolute path to the PRD file.
	 */
	getPrdPath() {
		return this.#paths.prdPath;
	}

	/**
	 * @returns {string|null} The absolute path to the complexity report.
	 */
	getComplexityReportPath() {
		return this.#paths.complexityReportPath;
	}

	/**
	 * @returns {string|null} The absolute path to the config.json file.
	 */
	getConfigPath() {
		return this.#paths.configPath;
	}

	/**
	 * @returns {string|null} The absolute path to the state.json file.
	 */
	getStatePath() {
		return this.#paths.statePath;
	}

	/**
	 * @returns {object} A frozen object containing all resolved paths.
	 */
	getAllPaths() {
		return this.#paths;
	}
}

/**
 * Initializes a TaskMaster instance with resolved paths.
 * This function centralizes path resolution logic.
 *
 * @param {object} [overrides={}] - An object with possible path overrides.
 * @param {string} [overrides.projectRoot]
 * @param {string} [overrides.tasksPath]
 * @param {string} [overrides.prdPath]
 * @param {string} [overrides.complexityReportPath]
 * @param {string} [overrides.configPath]
 * @param {string} [overrides.statePath]
 * @returns {TaskMaster} An initialized TaskMaster instance.
 */
export function initTaskMaster(overrides = {}) {
	const findProjectRoot = (startDir = process.cwd()) => {
		const projectMarkers = [TASKMASTER_DIR, LEGACY_CONFIG_FILE];
		let currentDir = path.resolve(startDir);
		const rootDir = path.parse(currentDir).root;
		while (currentDir !== rootDir) {
			for (const marker of projectMarkers) {
				const markerPath = path.join(currentDir, marker);
				if (fs.existsSync(markerPath)) {
					return currentDir;
				}
			}
			currentDir = path.dirname(currentDir);
		}
		return null;
	};

	const resolvePath = (
		pathType,
		override,
		defaultPaths = [],
		basePath = null
	) => {
		if (typeof override === 'string') {
			const resolvedPath = path.isAbsolute(override)
				? override
				: path.resolve(basePath || process.cwd(), override);

			if (!fs.existsSync(resolvedPath)) {
				throw new Error(
					`${pathType} override path does not exist: ${resolvedPath}`
				);
			}
			return resolvedPath;
		}

		if (override === true) {
			// Required path - search defaults and fail if not found
			for (const defaultPath of defaultPaths) {
				const fullPath = path.isAbsolute(defaultPath)
					? defaultPath
					: path.join(basePath || process.cwd(), defaultPath);
				if (fs.existsSync(fullPath)) {
					return fullPath;
				}
			}
			throw new Error(
				`Required ${pathType} not found. Searched: ${defaultPaths.join(', ')}`
			);
		}

		// Optional path (override === false/undefined) - search defaults, return null if not found
		for (const defaultPath of defaultPaths) {
			const fullPath = path.isAbsolute(defaultPath)
				? defaultPath
				: path.join(basePath || process.cwd(), defaultPath);
			if (fs.existsSync(fullPath)) {
				return fullPath;
			}
		}

		return null;
	};

	const paths = {};

	// Project Root
	if (overrides.projectRoot) {
		const resolvedOverride = path.resolve(overrides.projectRoot);
		if (!fs.existsSync(resolvedOverride)) {
			throw new Error(
				`Project root override path does not exist: ${resolvedOverride}`
			);
		}

		const hasTaskmasterDir = fs.existsSync(
			path.join(resolvedOverride, TASKMASTER_DIR)
		);
		const hasLegacyConfig = fs.existsSync(
			path.join(resolvedOverride, LEGACY_CONFIG_FILE)
		);

		if (!hasTaskmasterDir && !hasLegacyConfig) {
			throw new Error(
				`Project root override is not a valid taskmaster project: ${resolvedOverride}`
			);
		}

		paths.projectRoot = resolvedOverride;
	} else {
		const foundRoot = findProjectRoot();
		if (!foundRoot) {
			throw new Error(
				'Unable to find project root. No project markers found. Run "init" command first.'
			);
		}
		paths.projectRoot = foundRoot;
	}

	// TaskMaster Directory
	if ('taskMasterDir' in overrides) {
		paths.taskMasterDir = resolvePath(
			'taskmaster directory',
			overrides.taskMasterDir,
			[TASKMASTER_DIR],
			paths.projectRoot
		);
	} else {
		paths.taskMasterDir = resolvePath(
			'taskmaster directory',
			false,
			[TASKMASTER_DIR],
			paths.projectRoot
		);
	}

	// Always set default paths first
	// These can be overridden below if needed
	paths.configPath = path.join(paths.projectRoot, TASKMASTER_CONFIG_FILE);
	paths.statePath = path.join(
		paths.taskMasterDir || path.join(paths.projectRoot, TASKMASTER_DIR),
		'state.json'
	);
	paths.tasksPath = path.join(paths.projectRoot, TASKMASTER_TASKS_FILE);

	// Handle overrides - only validate/resolve if explicitly provided
	if ('configPath' in overrides) {
		paths.configPath = resolvePath(
			'config file',
			overrides.configPath,
			[TASKMASTER_CONFIG_FILE, LEGACY_CONFIG_FILE],
			paths.projectRoot
		);
	}

	if ('statePath' in overrides) {
		paths.statePath = resolvePath(
			'state file',
			overrides.statePath,
			['state.json'],
			paths.taskMasterDir
		);
	}

	if ('tasksPath' in overrides) {
		paths.tasksPath = resolvePath(
			'tasks file',
			overrides.tasksPath,
			[TASKMASTER_TASKS_FILE, LEGACY_TASKS_FILE],
			paths.projectRoot
		);
	}

	if ('prdPath' in overrides) {
		paths.prdPath = resolvePath(
			'PRD file',
			overrides.prdPath,
			[
				path.join(TASKMASTER_DOCS_DIR, 'PRD.md'),
				path.join(TASKMASTER_DOCS_DIR, 'prd.md'),
				path.join(TASKMASTER_DOCS_DIR, 'PRD.txt'),
				path.join(TASKMASTER_DOCS_DIR, 'prd.txt'),
				path.join('scripts', 'PRD.md'),
				path.join('scripts', 'prd.md'),
				path.join('scripts', 'PRD.txt'),
				path.join('scripts', 'prd.txt'),
				'PRD.md',
				'prd.md',
				'PRD.txt',
				'prd.txt'
			],
			paths.projectRoot
		);
	}

	if ('complexityReportPath' in overrides) {
		paths.complexityReportPath = resolvePath(
			'complexity report',
			overrides.complexityReportPath,
			[
				path.join(TASKMASTER_REPORTS_DIR, 'task-complexity-report.json'),
				path.join(TASKMASTER_REPORTS_DIR, 'complexity-report.json'),
				path.join('scripts', 'task-complexity-report.json'),
				path.join('scripts', 'complexity-report.json'),
				'task-complexity-report.json',
				'complexity-report.json'
			],
			paths.projectRoot
		);
	}

	return new TaskMaster(paths);
}
