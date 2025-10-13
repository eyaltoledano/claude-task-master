/**
 * @fileoverview WorkflowStateManager - Manages persistence of TDD workflow state
 *
 * Stores workflow state in global user directory (~/.taskmaster/sessions/)
 * to avoid git conflicts and support multiple worktrees.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import os from 'node:os';
import type { WorkflowState } from './types.js';

export interface WorkflowStateBackup {
	timestamp: string;
	state: WorkflowState;
}

/**
 * Manages workflow state persistence with backup support
 * Stores state in global user directory to avoid git noise
 */
export class WorkflowStateManager {
	private readonly projectRoot: string;
	private readonly statePath: string;
	private readonly backupDir: string;
	private readonly sessionDir: string;
	private maxBackups: number;

	constructor(projectRoot: string, maxBackups = 5) {
		this.projectRoot = path.resolve(projectRoot);
		this.maxBackups = maxBackups;

		// Create global session directory for this project
		const projectId = this.getProjectIdentifier(this.projectRoot);
		const homeDir = os.homedir();
		this.sessionDir = path.join(
			homeDir,
			'.taskmaster',
			'sessions',
			projectId
		);

		this.statePath = path.join(this.sessionDir, 'workflow-state.json');
		this.backupDir = path.join(this.sessionDir, 'backups');
	}

	/**
	 * Generate a unique identifier for the project
	 * Combines sanitized path with hash for uniqueness
	 */
	private getProjectIdentifier(projectRoot: string): string {
		// Create hash of absolute path
		const hash = createHash('sha256')
			.update(projectRoot)
			.digest('hex')
			.substring(0, 12);

		// Create human-readable sanitized name
		const basename = path.basename(projectRoot);
		const sanitized = basename
			.replace(/[^a-zA-Z0-9-]/g, '_')
			.toLowerCase()
			.substring(0, 50);

		return `${sanitized}-${hash}`;
	}

	/**
	 * Check if workflow state exists
	 */
	async exists(): Promise<boolean> {
		try {
			await fs.access(this.statePath);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Load workflow state from disk
	 */
	async load(): Promise<WorkflowState> {
		try {
			const content = await fs.readFile(this.statePath, 'utf-8');
			return JSON.parse(content) as WorkflowState;
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				throw new Error(
					`Workflow state file not found at ${this.statePath}`
				);
			}
			throw new Error(`Failed to load workflow state: ${error.message}`);
		}
	}

	/**
	 * Save workflow state to disk
	 */
	async save(state: WorkflowState): Promise<void> {
		try {
			// Ensure session directory exists
			await fs.mkdir(this.sessionDir, { recursive: true });

			// Write state atomically
			const tempPath = `${this.statePath}.tmp`;
			await fs.writeFile(tempPath, JSON.stringify(state, null, 2), 'utf-8');
			await fs.rename(tempPath, this.statePath);
		} catch (error: any) {
			throw new Error(`Failed to save workflow state: ${error.message}`);
		}
	}

	/**
	 * Create a backup of current state
	 */
	async createBackup(): Promise<void> {
		try {
			const exists = await this.exists();
			if (!exists) {
				return;
			}

			const state = await this.load();
			await fs.mkdir(this.backupDir, { recursive: true });

			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const backupPath = path.join(
				this.backupDir,
				`workflow-state-${timestamp}.json`
			);

			const backup: WorkflowStateBackup = {
				timestamp: new Date().toISOString(),
				state
			};

			await fs.writeFile(backupPath, JSON.stringify(backup, null, 2), 'utf-8');

			// Clean up old backups
			await this.pruneBackups();
		} catch (error: any) {
			throw new Error(`Failed to create backup: ${error.message}`);
		}
	}

	/**
	 * Delete workflow state file
	 */
	async delete(): Promise<void> {
		try {
			await fs.unlink(this.statePath);
		} catch (error: any) {
			if (error.code !== 'ENOENT') {
				throw new Error(`Failed to delete workflow state: ${error.message}`);
			}
		}
	}

	/**
	 * List available backups
	 */
	async listBackups(): Promise<string[]> {
		try {
			const files = await fs.readdir(this.backupDir);
			return files
				.filter((f) => f.startsWith('workflow-state-') && f.endsWith('.json'))
				.sort()
				.reverse();
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				return [];
			}
			throw new Error(`Failed to list backups: ${error.message}`);
		}
	}

	/**
	 * Restore from a backup
	 */
	async restoreBackup(backupFileName: string): Promise<void> {
		try {
			const backupPath = path.join(this.backupDir, backupFileName);
			const content = await fs.readFile(backupPath, 'utf-8');
			const backup: WorkflowStateBackup = JSON.parse(content);

			await this.save(backup.state);
		} catch (error: any) {
			throw new Error(`Failed to restore backup: ${error.message}`);
		}
	}

	/**
	 * Prune old backups to maintain max backup count
	 */
	private async pruneBackups(): Promise<void> {
		try {
			const backups = await this.listBackups();

			if (backups.length > this.maxBackups) {
				const toDelete = backups.slice(this.maxBackups);

				for (const backup of toDelete) {
					await fs.unlink(path.join(this.backupDir, backup));
				}
			}
		} catch (error: any) {
			// Non-critical error, log but don't throw
			console.warn(`Failed to prune backups: ${error.message}`);
		}
	}

	/**
	 * Get the path to the state file (for debugging/testing)
	 */
	getStatePath(): string {
		return this.statePath;
	}

	/**
	 * Get the path to the backup directory (for debugging/testing)
	 */
	getBackupDir(): string {
		return this.backupDir;
	}

	/**
	 * Get the session directory path (for debugging/testing)
	 */
	getSessionDir(): string {
		return this.sessionDir;
	}

	/**
	 * Get the project root this manager is for
	 */
	getProjectRoot(): string {
		return this.projectRoot;
	}
}
