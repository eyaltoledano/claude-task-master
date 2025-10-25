/**
 * @fileoverview Configuration Persistence Service
 * Handles saving and backup of configuration files
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { PartialConfiguration } from '../../../common/interfaces/configuration.interface.js';
import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';
import { getLogger } from '../../../common/logger/index.js';

/**
 * Persistence options
 */
export interface PersistenceOptions {
	/** Enable backup before saving */
	createBackup?: boolean;
	/** Maximum number of backups to keep */
	maxBackups?: number;
	/** Use atomic write operations */
	atomic?: boolean;
}

/**
 * ConfigPersistence handles all configuration file I/O operations
 * Single responsibility: Configuration persistence
 */
export class ConfigPersistence {
	private localConfigPath: string;
	private backupDir: string;
	private readonly logger = getLogger('ConfigPersistence');

	constructor(projectRoot: string) {
		this.localConfigPath = path.join(projectRoot, '.taskmaster', 'config.json');
		this.backupDir = path.join(projectRoot, '.taskmaster', 'backups');
	}

	/**
	 * Save configuration to file
	 */
	async saveConfig(
		config: PartialConfiguration,
		options: PersistenceOptions = {}
	): Promise<void> {
		const { createBackup = false, atomic = true } = options;

		try {
			// Create backup if requested
			if (createBackup && (await this.configExists())) {
				await this.createBackup();
			}

			// Ensure directory exists
			const configDir = path.dirname(this.localConfigPath);
			await fs.mkdir(configDir, { recursive: true });

			const jsonContent = JSON.stringify(config, null, 2);

			if (atomic) {
				// Atomic write: write to temp file then rename
				const tempPath = `${this.localConfigPath}.tmp`;
				await fs.writeFile(tempPath, jsonContent, 'utf-8');
				await fs.rename(tempPath, this.localConfigPath);
			} else {
				// Direct write
				await fs.writeFile(this.localConfigPath, jsonContent, 'utf-8');
			}
		} catch (error) {
			throw new TaskMasterError(
				'Failed to save configuration',
				ERROR_CODES.CONFIG_ERROR,
				{ configPath: this.localConfigPath },
				error as Error
			);
		}
	}

	/**
	 * Create a backup of the current configuration
	 */
	private async createBackup(): Promise<string> {
		try {
			await fs.mkdir(this.backupDir, { recursive: true });

			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const backupPath = path.join(this.backupDir, `config-${timestamp}.json`);

			const configContent = await fs.readFile(this.localConfigPath, 'utf-8');
			await fs.writeFile(backupPath, configContent, 'utf-8');

			// Clean old backups
			await this.cleanOldBackups();

			return backupPath;
		} catch (error) {
			this.logger.warn('Failed to create backup:', error);
			throw error;
		}
	}

	/**
	 * Clean old backup files
	 */
	private async cleanOldBackups(maxBackups = 5): Promise<void> {
		try {
			const files = await fs.readdir(this.backupDir);
			const backupFiles = files
				.filter((f) => f.startsWith('config-') && f.endsWith('.json'))
				.sort()
				.reverse();

			// Remove old backups
			const toDelete = backupFiles.slice(maxBackups);
			for (const file of toDelete) {
				await fs.unlink(path.join(this.backupDir, file));
			}
		} catch (error) {
			this.logger.warn('Failed to clean old backups:', error);
		}
	}

	/**
	 * Check if config file exists
	 */
	async configExists(): Promise<boolean> {
		try {
			await fs.access(this.localConfigPath);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Delete configuration file
	 */
	async deleteConfig(): Promise<void> {
		try {
			await fs.unlink(this.localConfigPath);
		} catch (error: any) {
			if (error.code !== 'ENOENT') {
				throw new TaskMasterError(
					'Failed to delete configuration',
					ERROR_CODES.CONFIG_ERROR,
					{ configPath: this.localConfigPath },
					error
				);
			}
		}
	}

	/**
	 * Get list of available backups
	 */
	async getBackups(): Promise<string[]> {
		try {
			const files = await fs.readdir(this.backupDir);
			return files
				.filter((f) => f.startsWith('config-') && f.endsWith('.json'))
				.sort()
				.reverse();
		} catch {
			return [];
		}
	}

	/**
	 * Restore from a backup
	 */
	async restoreFromBackup(backupFile: string): Promise<void> {
		const backupPath = path.join(this.backupDir, backupFile);

		try {
			const backupContent = await fs.readFile(backupPath, 'utf-8');
			await fs.writeFile(this.localConfigPath, backupContent, 'utf-8');
		} catch (error) {
			throw new TaskMasterError(
				'Failed to restore from backup',
				ERROR_CODES.CONFIG_ERROR,
				{ backupPath },
				error as Error
			);
		}
	}
}
