/**
 * CLI management exports for Cortex Code Provider
 */

// Connection Manager exports
export { ConnectionManager } from './connection-manager.js';
export type {
	SnowflakeConnection,
	SnowflakeConnections,
	CliCheckResult,
	ValidationParams,
	ValidationResult
} from './connection-manager.js';

// Feature Detector exports
export {
	detectAvailableFeatures,
	detectAvailableSkills,
	clearFeatureCache,
	hasFeature,
	getAvailableFeatureNames
} from './feature-detector.js';
export type {
	CortexCodeFeatures,
	CortexCodeSkill
} from './feature-detector.js';

