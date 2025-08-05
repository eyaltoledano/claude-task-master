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
	LEGACY_CONFIG_FILE,
	COMPLEXITY_REPORT_FILE
} from './constants/paths.js';
import { findProjectRoot } from './utils/path-utils.js';

/**
 * TaskMaster class manages all the paths for the application.
 * An instance of this class is created by the initTaskMaster function.
 */
export class TaskMaster {
	#paths;
	#tag;

	/**
	 * The constructor is intended to be used only by the initTaskMaster factory function.
	 * @param {object} paths - A pre-resolved object of all application paths.
	 * @param {string|undefined} tag - The current tag.
	 */
	constructor(paths, tag) {
		this.#paths = Object.freeze({ ...paths });
		this.#tag = tag;
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
		if (this.#paths.complexityReportPath) {
			return this.#paths.complexityReportPath;
		}

		const complexityReportFile =
			this.getCurrentTag() !== 'master'
				? COMPLEXITY_REPORT_FILE.replace(
						'.json',
						`_${this.getCurrentTag()}.json`
					)
				: COMPLEXITY_REPORT_FILE;

		return path.join(this.#paths.projectRoot, complexityReportFile);
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

	/**
	 * Gets the current tag from state.json or falls back to defaultTag from config
	 * @returns {string} The current tag name
	 */
	getCurrentTag() {
		if (this.#tag) {
			return this.#tag;
		}

		try {
			// Try to read current tag from state.json using fs directly
			if (fs.existsSync(this.#paths.statePath)) {
				const rawState = fs.readFileSync(this.#paths.statePath, 'utf8');
				const stateData = JSON.parse(rawState);
				if (stateData && stateData.currentTag) {
					return stateData.currentTag;
				}
			}
		} catch (error) {
			// Ignore errors, fall back to default
		}

		// Fall back to defaultTag from config using fs directly
		try {
			if (fs.existsSync(this.#paths.configPath)) {
				const rawConfig = fs.readFileSync(this.#paths.configPath, 'utf8');
				const configData = JSON.parse(rawConfig);
				if (configData && configData.global && configData.global.defaultTag) {
					return configData.global.defaultTag;
				}
			}
		} catch (error) {
			// Ignore errors, use hardcoded default
		}

		// Final fallback
		return 'master';
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
 * @param {string} [overrides.tag]
 * @returns {TaskMaster} An initialized TaskMaster instance.
 */
export function initTaskMaster(overrides = {}) {
	const resolvePath = (
		pathType,
		override,
		defaultPaths = [],
		basePath = null,
		createParentDirs = false
	) => {
		if (typeof override === 'string') {
			const resolvedPath = path.isAbsolute(override)
				? override
				: path.resolve(basePath || process.cwd(), override);

			if (createParentDirs) {
				// For output paths, create parent directory if it doesn't exist
				const parentDir = path.dirname(resolvedPath);
				if (!fs.existsSync(parentDir)) {
					try {
						fs.mkdirSync(parentDir, { recursive: true });
					} catch (error) {
						throw new Error(
							`Could not create directory for ${pathType}: ${parentDir}. Error: ${error.message}`
						);
					}
				}
			} else {
				// Original validation logic
				if (!fs.existsSync(resolvedPath)) {
					throw new Error(
						`${pathType} override path does not exist: ${resolvedPath}`
					);
				}
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
		// findProjectRoot now always returns a value (fallback to cwd)
		paths.projectRoot = findProjectRoot();
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
			paths.projectRoot,
			true // Enable parent directory creation for output paths
		);
	}

	return new TaskMaster(paths, overrides.tag);
}
