/**
 * Task Master Flow - Effect Integration Module
 * Phase 0: Foundation & Setup
 *
 * This module provides Effect-based functional programming infrastructure
 * for the Flow module without disrupting existing functionality.
 */

export { FlowRuntime } from './runtime.js';
export { healthCheck } from './effects/health.js';
export {
	PHASE_0_CONFIG,
	FlowConfig,
	getDefaultConfig,
	validateEffectConfig
} from './config.js';

/**
 * Version and module information
 */
export const EFFECT_MODULE_VERSION = '0.1.0';
export const EFFECT_PHASE = 'Phase 0: Foundation';

/**
 * Feature flags for Effect integration
 */
export const EFFECT_FEATURES = {
	HEALTH_CHECK: true,
	STREAMING: false, // Phase 4
	STORAGE: false, // Phase 1
	EXECUTION: false, // Phase 3
	AGENTS: false // Phase 5
};

/**
 * Check if Effect integration is available
 */
export const isEffectAvailable = async () => {
	try {
		// Test basic Effect functionality
		const { Effect } = await import('effect');
		return typeof Effect !== 'undefined';
	} catch (error) {
		return false;
	}
};
