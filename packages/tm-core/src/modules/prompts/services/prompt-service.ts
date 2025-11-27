/**
 * @fileoverview Prompt Service
 * Main service for managing upgrade prompts with context-aware trigger detection
 */

import { getLogger } from '../../../common/logger/index.js';
import type {
	PromptAction,
	PromptMetrics,
	TriggerEvaluationResult,
	TriggerType,
	UpgradePromptConfig
} from '../types.js';
import { PromptStateManager } from './prompt-state-manager.js';
import { TriggerContext, TriggerEvaluator } from './trigger-evaluator.js';

/**
 * Main service for managing upgrade prompts
 */
export class PromptService {
	private readonly logger = getLogger('PromptService');
	private readonly stateManager: PromptStateManager;
	private readonly evaluator: TriggerEvaluator;

	constructor(projectRoot: string, config?: UpgradePromptConfig) {
		this.stateManager = new PromptStateManager(projectRoot);
		this.evaluator = new TriggerEvaluator(this.stateManager, config);
	}

	/**
	 * Evaluate and get the prompt to display (if any)
	 * Returns the highest priority trigger that should show
	 */
	async evaluatePrompts(
		context: TriggerContext = {}
	): Promise<TriggerEvaluationResult> {
		try {
			return await this.evaluator.evaluate(context);
		} catch (error) {
			this.logger.error('Error evaluating prompts:', error);
			return {
				shouldShow: false,
				reason: `Evaluation error: ${(error as Error).message}`
			};
		}
	}

	/**
	 * Evaluate a specific trigger type
	 */
	async evaluateTrigger(
		triggerType: TriggerType,
		context: TriggerContext = {}
	): Promise<TriggerEvaluationResult> {
		try {
			return await this.evaluator.evaluateTriggerType(triggerType, context);
		} catch (error) {
			this.logger.error(`Error evaluating trigger ${triggerType}:`, error);
			return {
				shouldShow: false,
				reason: `Evaluation error: ${(error as Error).message}`
			};
		}
	}

	/**
	 * Record that a prompt was shown
	 * Call this after displaying a prompt to the user
	 */
	async recordPromptShown(triggerType: TriggerType): Promise<void> {
		try {
			await this.stateManager.recordPromptShown(triggerType);
			this.logger.debug(`Recorded prompt shown: ${triggerType}`);
		} catch (error) {
			this.logger.error(`Error recording prompt shown:`, error);
		}
	}

	/**
	 * Record user action on a prompt
	 */
	async recordAction(
		triggerType: TriggerType,
		action: PromptAction
	): Promise<void> {
		try {
			await this.stateManager.recordPromptAction(triggerType, action);
			this.logger.debug(`Recorded prompt action: ${triggerType} -> ${action}`);
		} catch (error) {
			this.logger.error(`Error recording prompt action:`, error);
		}
	}

	/**
	 * Update metrics based on user activity
	 */
	async updateMetrics(updates: Partial<PromptMetrics>): Promise<void> {
		try {
			await this.stateManager.updateMetrics(updates);
		} catch (error) {
			this.logger.error('Error updating metrics:', error);
		}
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
		try {
			await this.stateManager.incrementMetric(metric, amount);
		} catch (error) {
			this.logger.error(`Error incrementing metric ${metric}:`, error);
		}
	}

	/**
	 * Get current metrics
	 */
	async getMetrics(): Promise<PromptMetrics> {
		return this.stateManager.getMetrics();
	}

	/**
	 * Dismiss a prompt permanently
	 */
	async dismissPrompt(triggerType: TriggerType): Promise<void> {
		await this.recordAction(triggerType, 'dismissed');
	}

	/**
	 * Check if prompts are enabled
	 */
	isEnabled(): boolean {
		return this.evaluator.isEnabled();
	}

	/**
	 * Get the message for a specific trigger type
	 */
	getPromptMessage(triggerType: TriggerType): string | null {
		const trigger = this.evaluator.getTrigger(triggerType);
		return trigger?.message || null;
	}

	/**
	 * Reset all prompt state
	 */
	async reset(): Promise<void> {
		await this.stateManager.reset();
	}

	/**
	 * Reset a specific trigger's state
	 */
	async resetTrigger(triggerType: TriggerType): Promise<void> {
		await this.stateManager.resetTrigger(triggerType);
	}

	/**
	 * Sync metrics with actual task data
	 * Call this periodically to ensure metrics are accurate
	 */
	async syncMetrics(data: {
		taskCount?: number;
		tagCount?: number;
		tasksWithDependencies?: number;
	}): Promise<void> {
		const updates: Partial<PromptMetrics> = {};

		if (data.taskCount !== undefined) {
			updates.totalTaskCount = data.taskCount;
		}
		if (data.tagCount !== undefined) {
			updates.tagCount = data.tagCount;
		}
		if (data.tasksWithDependencies !== undefined) {
			updates.tasksWithDependencies = data.tasksWithDependencies;
		}

		if (Object.keys(updates).length > 0) {
			await this.updateMetrics(updates);
		}
	}

	/**
	 * Helper to build trigger context from common parameters
	 */
	static buildContext(params: {
		command?: string;
		isAuthenticated?: boolean;
		hasBriefConnected?: boolean;
		custom?: Record<string, unknown>;
	}): TriggerContext {
		return {
			currentCommand: params.command,
			isAuthenticated: params.isAuthenticated,
			hasBriefConnected: params.hasBriefConnected,
			custom: params.custom
		};
	}
}
