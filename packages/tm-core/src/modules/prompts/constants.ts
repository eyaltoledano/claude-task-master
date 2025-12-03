/**
 * @fileoverview Constants for the upgrade prompt system
 * Defines default trigger conditions and messaging
 */

import type { TriggerCondition, UpgradePromptConfig } from './types.js';

/**
 * Default trigger conditions for upgrade prompts
 * Ordered by priority (higher priority shown first)
 */
export const DEFAULT_TRIGGER_CONDITIONS: TriggerCondition[] = [
	{
		type: 'task_count',
		threshold: 10,
		message:
			'Your tasks are growing! Upgrade to Hamster Studio (Multiplayer) for coordinated team action, AI context sharing, and faster shipping.',
		promptType: 'upgrade_suggestion',
		showOnce: false,
		cooldownDays: 7,
		priority: 80
	},
	{
		type: 'tags_used',
		threshold: 3,
		message:
			'Organize by tags? Hamster briefs let you group and collaborate on tagged tasks with your team.',
		promptType: 'educational_notice',
		showOnce: false,
		cooldownDays: 14,
		priority: 70
	},
	{
		type: 'list_count',
		threshold: 5,
		message:
			'Managing multiple projects? Create Hamster briefs to organize work across your team.',
		promptType: 'educational_notice',
		showOnce: false,
		cooldownDays: 14,
		priority: 50
	},
	{
		type: 'dependencies_complex',
		threshold: 5,
		message:
			'Your tasks have complex dependencies. Hamster visualizes these relationships and tracks blockers automatically.',
		promptType: 'educational_notice',
		showOnce: false,
		cooldownDays: 14,
		priority: 60
	},
	{
		type: 'days_active',
		threshold: 7,
		message:
			'Ready to collaborate? Export your tasks to Hamster Studio and start shipping faster with your team.',
		promptType: 'upgrade_suggestion',
		showOnce: true,
		priority: 90
	},
	{
		type: 'export_attempt',
		threshold: 1,
		message:
			'Export to Hamster Studio to enable coordinated team action, AI context sharing, and alignment in hours.',
		promptType: 'critical_choice',
		showOnce: false,
		cooldownDays: 1,
		priority: 100
	},
	{
		type: 'no_connection',
		threshold: 1,
		message:
			'Connect to Hamster Studio to sync your tasks across devices and collaborate with your team.',
		promptType: 'upgrade_suggestion',
		showOnce: false,
		cooldownDays: 3,
		priority: 75
	},
	{
		type: 'parse_prd',
		threshold: 1,
		message:
			'Export your PRD to Hamster for dynamic task generation and team collaboration.',
		promptType: 'critical_choice',
		showOnce: false,
		cooldownDays: 1,
		priority: 95
	}
];

/**
 * Default configuration for upgrade prompts
 */
export const DEFAULT_PROMPT_CONFIG: UpgradePromptConfig = {
	enabled: true,
	triggers: DEFAULT_TRIGGER_CONDITIONS,
	defaultCooldownDays: 7,
	respectDismissed: true
};

/**
 * Prompt state storage version
 */
export const PROMPT_STATE_VERSION = '1.0.0';

/**
 * Key for storing prompt state in config.custom
 */
export const PROMPT_STATE_KEY = 'upgradePrompts';
