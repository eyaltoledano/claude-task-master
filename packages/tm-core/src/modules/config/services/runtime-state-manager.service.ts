/**
 * @fileoverview Runtime State Manager Service
 * Manages runtime state separate from configuration
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';
import { DEFAULT_CONFIG_VALUES } from '../../../common/interfaces/configuration.interface.js';
import { getLogger } from '../../../common/logger/index.js';

/**
 * Runtime state data structure
 */
export interface RuntimeState {
	/** Currently active tag */
	currentTag: string;
	/** Last updated timestamp */
	lastUpdated?: string;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * RuntimeStateManager handles runtime state persistence
 * Single responsibility: Runtime state management (separate from config)
 */
export class RuntimeStateManager {
	private stateFilePath: string;
	private currentState: RuntimeState;
	private readonly logger = getLogger('RuntimeStateManager');

	constructor(projectRoot: string) {
		this.stateFilePath = path.join(projectRoot, '.taskmaster', 'state.json');
		this.currentState = {
			currentTag: DEFAULT_CONFIG_VALUES.TAGS.DEFAULT_TAG
		};
	}

	/**
	 * Load runtime state from disk
	 */
	async loadState(): Promise<RuntimeState> {
		try {
			const stateData = await fs.readFile(this.stateFilePath, 'utf-8');
			const rawState = JSON.parse(stateData);

			// Map legacy field names to current interface
			const state: RuntimeState = {
				currentTag:
					rawState.currentTag ||
					rawState.activeTag ||
					DEFAULT_CONFIG_VALUES.TAGS.DEFAULT_TAG,
				lastUpdated: rawState.lastUpdated,
				metadata: rawState.metadata
			};

			// Apply environment variable override for current tag
			if (process.env.TASKMASTER_TAG) {
				state.currentTag = process.env.TASKMASTER_TAG;
			}

			this.currentState = state;
			return state;
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				// State file doesn't exist, use defaults
				this.logger.debug('No state.json found, using default state');

				// Check environment variable
				if (process.env.TASKMASTER_TAG) {
					this.currentState.currentTag = process.env.TASKMASTER_TAG;
				}

				return this.currentState;
			}

			// Failed to load, use defaults
			this.logger.warn('Failed to load state file:', error.message);
			return this.currentState;
		}
	}

	/**
	 * Save runtime state to disk
	 */
	async saveState(): Promise<void> {
		const stateDir = path.dirname(this.stateFilePath);

		try {
			await fs.mkdir(stateDir, { recursive: true });

			const stateToSave = {
				...this.currentState,
				lastUpdated: new Date().toISOString()
			};

			await fs.writeFile(
				this.stateFilePath,
				JSON.stringify(stateToSave, null, 2),
				'utf-8'
			);
		} catch (error) {
			throw new TaskMasterError(
				'Failed to save runtime state',
				ERROR_CODES.CONFIG_ERROR,
				{ statePath: this.stateFilePath },
				error as Error
			);
		}
	}

	/**
	 * Get the currently active tag
	 */
	getCurrentTag(): string {
		return this.currentState.currentTag;
	}

	/**
	 * Set the current tag
	 */
	async setCurrentTag(tag: string): Promise<void> {
		this.currentState.currentTag = tag;
		await this.saveState();
	}

	/**
	 * Get current state
	 */
	getState(): RuntimeState {
		return { ...this.currentState };
	}

	/**
	 * Update metadata
	 */
	async updateMetadata(metadata: Record<string, unknown>): Promise<void> {
		this.currentState.metadata = {
			...this.currentState.metadata,
			...metadata
		};
		await this.saveState();
	}

	/**
	 * Clear state file
	 */
	async clearState(): Promise<void> {
		try {
			await fs.unlink(this.stateFilePath);
		} catch (error: any) {
			if (error.code !== 'ENOENT') {
				throw error;
			}
		}
		this.currentState = {
			currentTag: DEFAULT_CONFIG_VALUES.TAGS.DEFAULT_TAG
		};
	}
}
