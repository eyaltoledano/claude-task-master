/**
 * @fileoverview Trigger Evaluator
 * Evaluates trigger conditions to determine if prompts should be shown
 */

import { DEFAULT_TRIGGER_CONDITIONS } from '../constants.js';
import type {
	PromptMetrics,
	TriggerCondition,
	TriggerEvaluationResult,
	TriggerType,
	UpgradePromptConfig
} from '../types.js';
import type { PromptStateManager } from './prompt-state-manager.js';

/**
 * Context for evaluating triggers
 */
export interface TriggerContext {
	/** Current command being executed */
	currentCommand?: string;
	/** Whether user is authenticated with Hamster */
	isAuthenticated?: boolean;
	/** Whether user has a brief connected */
	hasBriefConnected?: boolean;
	/** Custom context data */
	custom?: Record<string, unknown>;
}

/**
 * Evaluates trigger conditions and determines if prompts should be shown
 */
export class TriggerEvaluator {
	private readonly stateManager: PromptStateManager;
	private readonly config: UpgradePromptConfig;

	constructor(stateManager: PromptStateManager, config?: UpgradePromptConfig) {
		this.stateManager = stateManager;
		this.config = config || {
			enabled: true,
			triggers: DEFAULT_TRIGGER_CONDITIONS,
			defaultCooldownDays: 7,
			respectDismissed: true
		};
	}

	/**
	 * Evaluate all triggers and return the highest priority one that should show
	 */
	async evaluate(
		context: TriggerContext = {}
	): Promise<TriggerEvaluationResult> {
		if (!this.config.enabled) {
			return {
				shouldShow: false,
				reason: 'Prompts are disabled'
			};
		}

		const metrics = await this.stateManager.getMetrics();
		const daysActive = await this.stateManager.getDaysActive();

		// Sort triggers by priority (highest first)
		const sortedTriggers = [...this.config.triggers].sort(
			(a, b) => b.priority - a.priority
		);

		for (const trigger of sortedTriggers) {
			const result = await this.evaluateTrigger(
				trigger,
				metrics,
				daysActive,
				context
			);
			if (result.shouldShow) {
				return result;
			}
		}

		return {
			shouldShow: false,
			reason: 'No trigger conditions met'
		};
	}

	/**
	 * Evaluate a specific trigger type
	 */
	async evaluateTriggerType(
		triggerType: TriggerType,
		context: TriggerContext = {}
	): Promise<TriggerEvaluationResult> {
		const trigger = this.config.triggers.find((t) => t.type === triggerType);
		if (!trigger) {
			return {
				shouldShow: false,
				reason: `Unknown trigger type: ${triggerType}`
			};
		}

		const metrics = await this.stateManager.getMetrics();
		const daysActive = await this.stateManager.getDaysActive();

		return this.evaluateTrigger(trigger, metrics, daysActive, context);
	}

	/**
	 * Evaluate a single trigger condition
	 */
	private async evaluateTrigger(
		trigger: TriggerCondition,
		metrics: PromptMetrics,
		daysActive: number,
		context: TriggerContext
	): Promise<TriggerEvaluationResult> {
		// Check if trigger is dismissed
		if (this.config.respectDismissed) {
			const isDismissed = await this.stateManager.isDismissed(trigger.type);
			if (isDismissed) {
				return {
					shouldShow: false,
					trigger,
					reason: 'Prompt was dismissed by user'
				};
			}
		}

		// Check cooldown
		const cooldownDays =
			trigger.cooldownDays ?? this.config.defaultCooldownDays;
		const isInCooldown = await this.stateManager.isWithinCooldown(
			trigger.type,
			cooldownDays
		);
		if (isInCooldown) {
			return {
				shouldShow: false,
				trigger,
				reason: `Within cooldown period (${cooldownDays} days)`
			};
		}

		// Check showOnce
		if (trigger.showOnce) {
			const triggerState = await this.stateManager.getTriggerState(
				trigger.type
			);
			if (triggerState && triggerState.showCount > 0) {
				return {
					shouldShow: false,
					trigger,
					reason: 'Prompt already shown (showOnce=true)'
				};
			}
		}

		// Evaluate the threshold condition
		const meetsThreshold = this.evaluateThreshold(
			trigger,
			metrics,
			daysActive,
			context
		);

		if (!meetsThreshold.met) {
			return {
				shouldShow: false,
				trigger,
				reason: meetsThreshold.reason
			};
		}

		return {
			shouldShow: true,
			trigger,
			reason: meetsThreshold.reason
		};
	}

	/**
	 * Evaluate if a trigger's threshold is met
	 */
	private evaluateThreshold(
		trigger: TriggerCondition,
		metrics: PromptMetrics,
		daysActive: number,
		context: TriggerContext
	): { met: boolean; reason: string } {
		switch (trigger.type) {
			case 'task_count':
				const taskMet = metrics.totalTaskCount >= trigger.threshold;
				return {
					met: taskMet,
					reason: taskMet
						? `Task count ${metrics.totalTaskCount} >= ${trigger.threshold}`
						: `Task count ${metrics.totalTaskCount} < ${trigger.threshold}`
				};

			case 'tags_used':
				const tagMet = metrics.tagCount >= trigger.threshold;
				return {
					met: tagMet,
					reason: tagMet
						? `Tag count ${metrics.tagCount} >= ${trigger.threshold}`
						: `Tag count ${metrics.tagCount} < ${trigger.threshold}`
				};

			case 'list_count':
				const listMet = metrics.listCommandCount >= trigger.threshold;
				return {
					met: listMet,
					reason: listMet
						? `List count ${metrics.listCommandCount} >= ${trigger.threshold}`
						: `List count ${metrics.listCommandCount} < ${trigger.threshold}`
				};

			case 'dependencies_complex':
				const depMet = metrics.tasksWithDependencies >= trigger.threshold;
				return {
					met: depMet,
					reason: depMet
						? `Tasks with dependencies ${metrics.tasksWithDependencies} >= ${trigger.threshold}`
						: `Tasks with dependencies ${metrics.tasksWithDependencies} < ${trigger.threshold}`
				};

			case 'days_active':
				const daysMet = daysActive >= trigger.threshold;
				return {
					met: daysMet,
					reason: daysMet
						? `Days active ${daysActive} >= ${trigger.threshold}`
						: `Days active ${daysActive} < ${trigger.threshold}`
				};

			case 'export_attempt':
				// Only show during export command
				const isExport = context.currentCommand === 'export';
				return {
					met: isExport,
					reason: isExport
						? 'User is attempting export'
						: 'Not an export command'
				};

			case 'no_connection':
				// Show when not authenticated or no brief connected
				const notConnected =
					!context.isAuthenticated || !context.hasBriefConnected;
				return {
					met: notConnected,
					reason: notConnected
						? 'No Hamster connection detected'
						: 'User is connected to Hamster'
				};

			case 'parse_prd':
				// Only show during parse-prd command
				const isParsePrd = context.currentCommand === 'parse-prd';
				return {
					met: isParsePrd,
					reason: isParsePrd
						? 'User is parsing a PRD'
						: 'Not a parse-prd command'
				};

			default:
				return {
					met: false,
					reason: `Unknown trigger type: ${trigger.type}`
				};
		}
	}

	/**
	 * Get all available triggers
	 */
	getTriggers(): TriggerCondition[] {
		return this.config.triggers;
	}

	/**
	 * Get trigger by type
	 */
	getTrigger(type: TriggerType): TriggerCondition | undefined {
		return this.config.triggers.find((t) => t.type === type);
	}

	/**
	 * Check if prompts are enabled
	 */
	isEnabled(): boolean {
		return this.config.enabled;
	}
}
