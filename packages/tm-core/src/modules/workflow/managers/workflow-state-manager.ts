/**
 * @fileoverview WorkflowStateManager - Manages persistence of TDD workflow state
 *
 * Stores workflow state in global user directory (~/.taskmaster/{project-id}/sessions/)
 * to avoid git conflicts and support multiple worktrees.
 * Each project gets its own directory for organizing workflow-related data.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Writer } from 'steno';
import type { WorkflowState } from '../types.js';
import { getLogger } from '../../../common/logger/index.js';

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
	private readonly logger = getLogger('WorkflowStateManager');
	private writer: Writer | null = null;
	private writerInitPromise: Promise<void> | null = null;

	constructor(projectRoot: string, maxBackups = 5) {
		this.projectRoot = path.resolve(projectRoot);
		this.maxBackups = maxBackups;

		// Create project-specific directory in global .taskmaster
		// Structure: ~/.taskmaster/{project-id}/sessions/
		const projectId = this.getProjectIdentifier(this.projectRoot);
		const homeDir = os.homedir();
		const projectDir = path.join(homeDir, '.taskmaster', projectId);
		this.sessionDir = path.join(projectDir, 'sessions');

		this.statePath = path.join(this.sessionDir, 'workflow-state.json');
		this.backupDir = path.join(this.sessionDir, 'backups');
	}

	/**
	 * Generate a unique identifier for the project using full sanitized path
	 * Uses Claude Code's pattern: leading dash + full path with case preserved
	 * Example: /Volumes/Workspace/... -> -Volumes-Workspace-...
	 */
	private getProjectIdentifier(projectRoot: string): string {
		// Resolve to absolute path
		const absolutePath = path.resolve(projectRoot);

		// Sanitize path like Claude Code does:
		// - Add leading dash
		// - Replace path separators and non-alphanumeric chars with dashes
		// - Preserve case for readability
		// - Collapse multiple dashes
		const sanitized =
			'-' +
			absolutePath
				.replace(/^\//, '') // Remove leading slash before adding dash
				.replace(/[^a-zA-Z0-9]+/g, '-') // Replace sequences of non-alphanumeric with single dash
				.replace(/-+/g, '-') // Collapse multiple dashes
				.replace(/-+$/, ''); // Remove trailing dashes

		return sanitized;
	}

	/**
	 * Ensure the steno Writer is initialized
	 * This ensures the session directory exists before creating the writer
	 */
	private async ensureWriter(): Promise<void> {
		if (this.writer) {
			return;
		}

		// If another call is already initializing, wait for it
		if (this.writerInitPromise) {
			await this.writerInitPromise;
			return;
		}

		this.writerInitPromise = (async () => {
			// Ensure session directory exists before creating writer
			await fs.mkdir(this.sessionDir, { recursive: true });
			this.writer = new Writer(this.statePath);
		})();

		await this.writerInitPromise;
		this.writerInitPromise = null;
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
				throw new Error(`Workflow state file not found at ${this.statePath}`);
			}
			throw new Error(`Failed to load workflow state: ${error.message}`);
		}
	}

	/**
	 * Save workflow state to disk
	 * Uses steno for atomic writes and automatic queueing of concurrent saves
	 */
	async save(state: WorkflowState): Promise<void> {
		try {
			// Ensure writer is initialized (creates directory if needed)
			await this.ensureWriter();

			// Serialize and validate JSON
			const jsonContent = JSON.stringify(state, null, 2);

			// Validate that the JSON is well-formed by parsing it back
			try {
				JSON.parse(jsonContent);
			} catch (parseError) {
				this.logger.error('Generated invalid JSON:', jsonContent);
				throw new Error('Failed to generate valid JSON from workflow state');
			}

			// Write using steno (handles queuing and atomic writes automatically)
			await this.writer!.write(jsonContent + '\n');

			this.logger.debug(`Saved workflow state (${jsonContent.length} bytes)`);
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
			this.logger.warn(`Failed to prune backups: ${error.message}`);
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

	/**
	 * Get the path to the activity log file
	 * Activity log is stored next to workflow-state.json for correlation
	 */
	getActivityLogPath(): string {
		return path.join(this.sessionDir, 'activity.jsonl');
	}
}
