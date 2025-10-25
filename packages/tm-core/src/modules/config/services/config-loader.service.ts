/**
 * @fileoverview Configuration Loader Service
 * Responsible for loading configuration from various file sources
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { PartialConfiguration } from '../../../common/interfaces/configuration.interface.js';
import { DEFAULT_CONFIG_VALUES } from '../../../common/interfaces/configuration.interface.js';
import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';

/**
 * ConfigLoader handles loading configuration from files
 * Single responsibility: File-based configuration loading
 */
export class ConfigLoader {
	private localConfigPath: string;
	private globalConfigPath: string;

	constructor(projectRoot: string) {
		this.localConfigPath = path.join(projectRoot, '.taskmaster', 'config.json');
		this.globalConfigPath = path.join(
			process.env.HOME || '',
			'.taskmaster',
			'config.json'
		);
	}

	/**
	 * Get default configuration values
	 */
	getDefaultConfig(): PartialConfiguration {
		return {
			models: {
				main: DEFAULT_CONFIG_VALUES.MODELS.MAIN,
				fallback: DEFAULT_CONFIG_VALUES.MODELS.FALLBACK
			},
			workflow: {
				enableAutopilot: DEFAULT_CONFIG_VALUES.WORKFLOW.ENABLE_AUTOPILOT,
				maxPhaseAttempts: DEFAULT_CONFIG_VALUES.WORKFLOW.MAX_PHASE_ATTEMPTS,
				branchPattern: DEFAULT_CONFIG_VALUES.WORKFLOW.BRANCH_PATTERN,
				requireCleanWorkingTree:
					DEFAULT_CONFIG_VALUES.WORKFLOW.REQUIRE_CLEAN_WORKING_TREE,
				autoStageChanges: DEFAULT_CONFIG_VALUES.WORKFLOW.AUTO_STAGE_CHANGES,
				includeCoAuthor: DEFAULT_CONFIG_VALUES.WORKFLOW.INCLUDE_CO_AUTHOR,
				coAuthorName: DEFAULT_CONFIG_VALUES.WORKFLOW.CO_AUTHOR_NAME,
				coAuthorEmail: DEFAULT_CONFIG_VALUES.WORKFLOW.CO_AUTHOR_EMAIL,
				testThresholds: {
					minTests: DEFAULT_CONFIG_VALUES.WORKFLOW.MIN_TESTS,
					maxFailuresInGreen:
						DEFAULT_CONFIG_VALUES.WORKFLOW.MAX_FAILURES_IN_GREEN
				},
				commitMessageTemplate:
					DEFAULT_CONFIG_VALUES.WORKFLOW.COMMIT_MESSAGE_TEMPLATE,
				allowedCommitTypes: [
					...DEFAULT_CONFIG_VALUES.WORKFLOW.ALLOWED_COMMIT_TYPES
				],
				defaultCommitType: DEFAULT_CONFIG_VALUES.WORKFLOW.DEFAULT_COMMIT_TYPE,
				operationTimeout: DEFAULT_CONFIG_VALUES.WORKFLOW.OPERATION_TIMEOUT,
				enableActivityLogging:
					DEFAULT_CONFIG_VALUES.WORKFLOW.ENABLE_ACTIVITY_LOGGING,
				activityLogPath: DEFAULT_CONFIG_VALUES.WORKFLOW.ACTIVITY_LOG_PATH,
				enableStateBackup: DEFAULT_CONFIG_VALUES.WORKFLOW.ENABLE_STATE_BACKUP,
				maxStateBackups: DEFAULT_CONFIG_VALUES.WORKFLOW.MAX_STATE_BACKUPS,
				abortOnMaxAttempts: DEFAULT_CONFIG_VALUES.WORKFLOW.ABORT_ON_MAX_ATTEMPTS
			},
			storage: {
				type: DEFAULT_CONFIG_VALUES.STORAGE.TYPE,
				encoding: DEFAULT_CONFIG_VALUES.STORAGE.ENCODING,
				enableBackup: false,
				maxBackups: DEFAULT_CONFIG_VALUES.STORAGE.MAX_BACKUPS,
				enableCompression: false,
				atomicOperations: true
			},
			version: DEFAULT_CONFIG_VALUES.VERSION
		};
	}

	/**
	 * Load local project configuration
	 */
	async loadLocalConfig(): Promise<PartialConfiguration | null> {
		try {
			const configData = await fs.readFile(this.localConfigPath, 'utf-8');
			return JSON.parse(configData);
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				// File doesn't exist, return null
				console.debug('No local config.json found, using defaults');
				return null;
			}
			throw new TaskMasterError(
				'Failed to load local configuration',
				ERROR_CODES.CONFIG_ERROR,
				{ configPath: this.localConfigPath },
				error
			);
		}
	}

	/**
	 * Load global user configuration
	 * @future-implementation Full implementation pending
	 */
	async loadGlobalConfig(): Promise<PartialConfiguration | null> {
		// TODO: Implement in future PR
		// For now, return null to indicate no global config
		return null;

		// Future implementation:
		// try {
		//   const configData = await fs.readFile(this.globalConfigPath, 'utf-8');
		//   return JSON.parse(configData);
		// } catch (error: any) {
		//   if (error.code === 'ENOENT') {
		//     return null;
		//   }
		//   throw new TaskMasterError(
		//     'Failed to load global configuration',
		//     ERROR_CODES.CONFIG_ERROR,
		//     { configPath: this.globalConfigPath },
		//     error
		//   );
		// }
	}

	/**
	 * Check if local config exists
	 */
	async hasLocalConfig(): Promise<boolean> {
		try {
			await fs.access(this.localConfigPath);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Check if global config exists
	 */
	async hasGlobalConfig(): Promise<boolean> {
		try {
			await fs.access(this.globalConfigPath);
			return true;
		} catch {
			return false;
		}
	}
}
