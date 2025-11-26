/**
 * @fileoverview Prompt State Manager
 * Manages persistence and state tracking for upgrade prompts
 * Uses the existing RuntimeStateManager's metadata field
 */

import { getLogger } from '../../../common/logger/index.js';
import { RuntimeStateManager } from '../../config/services/runtime-state-manager.service.js';
import { PROMPT_STATE_VERSION } from '../constants.js';
import type {
	PromptAction,
	PromptMetrics,
	PromptState,
	PromptStateStore,
	TriggerType
} from '../types.js';

/**
 * Key used for storing prompt state in RuntimeStateManager metadata
 */
const PROMPTS_METADATA_KEY = 'upgradePrompts';

/**
 * Manages prompt state using the existing RuntimeStateManager
 */
export class PromptStateManager {
	private readonly logger = getLogger('PromptStateManager');
	private readonly runtimeStateManager: RuntimeStateManager;
	private cachedState: PromptStateStore | null = null;

	constructor(projectRoot: string) {
		this.runtimeStateManager = new RuntimeStateManager(projectRoot);
	}

	/**
	 * Get the current prompt state
	 */
	async getState(): Promise<PromptStateStore> {
		if (this.cachedState) {
			return this.cachedState;
		}

		this.cachedState = await this.loadState();
		return this.cachedState;
	}

	/**
	 * Load state from RuntimeStateManager metadata
	 */
	private async loadState(): Promise<PromptStateStore> {
		try {
			await this.runtimeStateManager.loadState();
			const runtimeState = this.runtimeStateManager.getState();
			const promptsData = runtimeState.metadata?.[PROMPTS_METADATA_KEY];

			if (promptsData && typeof promptsData === 'object') {
				return this.validateAndMigrate(promptsData);
			}
		} catch (error) {
			this.logger.warn('Failed to load prompt state, using defaults:', error);
		}

		return this.createDefaultState();
	}

	/**
	 * Create default state
	 */
	private createDefaultState(): PromptStateStore {
		return {
			triggers: {},
			metrics: {
				totalTaskCount: 0,
				tagCount: 0,
				listCommandCount: 0,
				tasksWithDependencies: 0
			},
			lastUpdated: new Date().toISOString(),
			version: PROMPT_STATE_VERSION
		};
	}

	/**
	 * Validate and migrate state if needed
	 */
	private validateAndMigrate(data: any): PromptStateStore {
		const state: PromptStateStore = {
			triggers: data.triggers || {},
			metrics: {
				totalTaskCount: data.metrics?.totalTaskCount || 0,
				tagCount: data.metrics?.tagCount || 0,
				listCommandCount: data.metrics?.listCommandCount || 0,
				tasksWithDependencies: data.metrics?.tasksWithDependencies || 0,
				firstActivityAt: data.metrics?.firstActivityAt,
				lastActivityAt: data.metrics?.lastActivityAt
			},
			lastUpdated: data.lastUpdated || new Date().toISOString(),
			version: PROMPT_STATE_VERSION
		};

		return state;
	}

	/**
	 * Save state to RuntimeStateManager metadata
	 */
	async saveState(): Promise<void> {
		if (!this.cachedState) {
			return;
		}

		try {
			this.cachedState.lastUpdated = new Date().toISOString();
			await this.runtimeStateManager.updateMetadata({
				[PROMPTS_METADATA_KEY]: this.cachedState
			});
		} catch (error) {
			this.logger.error('Failed to save prompt state:', error);
			throw error;
		}
	}

	/**
	 * Get state for a specific trigger
	 */
	async getTriggerState(triggerType: TriggerType): Promise<PromptState | null> {
		const state = await this.getState();
		return state.triggers[triggerType] || null;
	}

	/**
	 * Record that a prompt was shown
	 */
	async recordPromptShown(triggerType: TriggerType): Promise<void> {
		const state = await this.getState();
		const now = new Date().toISOString();

		const existing = state.triggers[triggerType];
		state.triggers[triggerType] = {
			firstShownAt: existing?.firstShownAt || now,
			lastShownAt: now,
			showCount: (existing?.showCount || 0) + 1,
			dismissed: existing?.dismissed || false
		};

		await this.saveState();
	}

	/**
	 * Record user action on a prompt
	 */
	async recordPromptAction(
		triggerType: TriggerType,
		action: PromptAction
	): Promise<void> {
		const state = await this.getState();
		const now = new Date().toISOString();

		const existing = state.triggers[triggerType] || {
			showCount: 1,
			dismissed: false
		};

		state.triggers[triggerType] = {
			...existing,
			action,
			actionAt: now,
			dismissed: action === 'dismissed'
		};

		await this.saveState();
	}

	/**
	 * Update metrics
	 */
	async updateMetrics(updates: Partial<PromptMetrics>): Promise<void> {
		const state = await this.getState();
		const now = new Date().toISOString();

		// Set first activity if not set
		if (!state.metrics.firstActivityAt) {
			state.metrics.firstActivityAt = now;
		}
		state.metrics.lastActivityAt = now;

		// Apply updates
		Object.assign(state.metrics, updates);

		await this.saveState();
	}

	/**
	 * Increment a specific metric
	 */
	async incrementMetric(
		metric: keyof Pick<
			PromptMetrics,
			| 'totalTaskCount'
			| 'tagCount'
			| 'listCommandCount'
			| 'tasksWithDependencies'
		>,
		amount: number = 1
	): Promise<void> {
		const state = await this.getState();
		state.metrics[metric] = (state.metrics[metric] || 0) + amount;

		if (!state.metrics.firstActivityAt) {
			state.metrics.firstActivityAt = new Date().toISOString();
		}
		state.metrics.lastActivityAt = new Date().toISOString();

		await this.saveState();
	}

	/**
	 * Get current metrics
	 */
	async getMetrics(): Promise<PromptMetrics> {
		const state = await this.getState();
		return state.metrics;
	}

	/**
	 * Check if prompt is within cooldown period
	 */
	async isWithinCooldown(
		triggerType: TriggerType,
		cooldownDays: number
	): Promise<boolean> {
		const triggerState = await this.getTriggerState(triggerType);
		if (!triggerState?.lastShownAt) {
			return false;
		}

		const lastShown = new Date(triggerState.lastShownAt);
		const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
		const now = Date.now();

		return now - lastShown.getTime() < cooldownMs;
	}

	/**
	 * Check if prompt has been dismissed
	 */
	async isDismissed(triggerType: TriggerType): Promise<boolean> {
		const triggerState = await this.getTriggerState(triggerType);
		return triggerState?.dismissed || false;
	}

	/**
	 * Get days since first activity
	 */
	async getDaysActive(): Promise<number> {
		const state = await this.getState();
		if (!state.metrics.firstActivityAt) {
			return 0;
		}

		const firstActivity = new Date(state.metrics.firstActivityAt);
		const now = Date.now();
		const dayMs = 24 * 60 * 60 * 1000;

		return Math.floor((now - firstActivity.getTime()) / dayMs);
	}

	/**
	 * Reset all prompt state
	 */
	async reset(): Promise<void> {
		this.cachedState = this.createDefaultState();
		await this.saveState();
	}

	/**
	 * Reset a specific trigger's state
	 */
	async resetTrigger(triggerType: TriggerType): Promise<void> {
		const state = await this.getState();
		delete state.triggers[triggerType];
		await this.saveState();
	}
}
