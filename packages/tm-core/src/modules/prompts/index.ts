/**
 * @fileoverview Prompts module exports
 * Context-aware upgrade prompt system for Task Master
 */

// Types
export type {
	PromptAction,
	PromptDisplayOptions,
	PromptDisplayResult,
	PromptMetrics,
	PromptState,
	PromptStateStore,
	PromptType,
	TriggerCondition,
	TriggerEvaluationResult,
	TriggerType,
	UpgradePromptConfig
} from './types.js';

// Constants
export {
	DEFAULT_PROMPT_CONFIG,
	DEFAULT_TRIGGER_CONDITIONS,
	PROMPT_STATE_KEY,
	PROMPT_STATE_VERSION
} from './constants.js';

// Services
export { PromptService } from './services/prompt-service.js';
export { PromptStateManager } from './services/prompt-state-manager.js';
export { TriggerEvaluator } from './services/trigger-evaluator.js';
export type { TriggerContext } from './services/trigger-evaluator.js';
