/**
 * @fileoverview Configuration Loader Service
 * Responsible for loading configuration from various file sources
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { PartialConfiguration } from '../../interfaces/configuration.interface.js';
import { DEFAULT_CONFIG_VALUES } from '../../interfaces/configuration.interface.js';
import {
	ERROR_CODES,
	TaskMasterError
} from '../../errors/task-master-error.js';

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
