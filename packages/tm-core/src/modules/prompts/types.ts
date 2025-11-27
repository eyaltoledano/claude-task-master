/**
 * @fileoverview Types for the upgrade prompt system
 * Defines interfaces for prompts, triggers, and state management
 */

/**
 * Types of upgrade prompts
 */
export type PromptType =
	| 'upgrade_suggestion' // Non-blocking educational notice
	| 'critical_choice' // Inquirer-based choice prompt
	| 'educational_notice'; // Quick tip/notice

/**
 * Prompt trigger types - key moments when prompts should be shown
 */
export type TriggerType =
	| 'task_count' // User has created N tasks
	| 'tags_used' // User is using tag organization
	| 'list_count' // User has run tm list N times
	| 'dependencies_complex' // Complex dependencies detected
	| 'days_active' // User has been active for N days
	| 'export_attempt' // User attempts to export
	| 'no_connection' // No external service connected
	| 'parse_prd'; // User parsing a PRD

/**
 * User actions on prompts
 */
export type PromptAction = 'shown' | 'dismissed' | 'accepted' | 'learn_more';

/**
 * Individual prompt state record
 */
export interface PromptState {
	/** When the prompt was first shown */
	firstShownAt?: string;
	/** When the prompt was last shown */
	lastShownAt?: string;
	/** Total number of times shown */
	showCount: number;
	/** User action taken */
	action?: PromptAction;
	/** When the action was taken */
	actionAt?: string;
	/** Whether prompt is permanently dismissed */
	dismissed: boolean;
}

/**
 * Complete prompt state storage
 */
export interface PromptStateStore {
	/** State for each trigger type */
	triggers: Partial<Record<TriggerType, PromptState>>;
	/** Metrics for trigger evaluation */
	metrics: PromptMetrics;
	/** When state was last updated */
	lastUpdated: string;
	/** Version for future migrations */
	version: string;
}

/**
 * Metrics used to evaluate triggers
 */
export interface PromptMetrics {
	/** Total task count (across all tags) */
	totalTaskCount: number;
	/** Number of unique tags created */
	tagCount: number;
	/** Number of times tm list has been run */
	listCommandCount: number;
	/** Number of tasks with dependencies */
	tasksWithDependencies: number;
	/** First activity timestamp */
	firstActivityAt?: string;
	/** Last activity timestamp */
	lastActivityAt?: string;
}

/**
 * Trigger condition configuration
 */
export interface TriggerCondition {
	/** Type of trigger */
	type: TriggerType;
	/** Threshold value that triggers the prompt */
	threshold: number;
	/** Prompt message to display */
	message: string;
	/** Prompt type */
	promptType: PromptType;
	/** Whether prompt should only be shown once */
	showOnce: boolean;
	/** Cooldown period in days before showing again */
	cooldownDays?: number;
	/** Priority for prompt display (higher = more important) */
	priority: number;
}

/**
 * Result of trigger evaluation
 */
export interface TriggerEvaluationResult {
	/** Whether the trigger condition is met */
	shouldShow: boolean;
	/** The trigger that matched */
	trigger?: TriggerCondition;
	/** Reason for decision */
	reason: string;
}

/**
 * Prompt display options
 */
export interface PromptDisplayOptions {
	/** Force display even if already shown */
	force?: boolean;
	/** Custom message override */
	customMessage?: string;
	/** Context for the prompt */
	context?: Record<string, unknown>;
}

/**
 * Prompt display result
 */
export interface PromptDisplayResult {
	/** Whether prompt was displayed */
	displayed: boolean;
	/** Trigger type that was displayed */
	triggerType?: TriggerType;
	/** User action taken */
	action?: PromptAction;
	/** Any error that occurred */
	error?: string;
}

/**
 * Configuration for upgrade prompts
 */
export interface UpgradePromptConfig {
	/** Whether prompts are enabled globally */
	enabled: boolean;
	/** Trigger conditions */
	triggers: TriggerCondition[];
	/** Default cooldown in days */
	defaultCooldownDays: number;
	/** Whether to respect dismissed state */
	respectDismissed: boolean;
}
