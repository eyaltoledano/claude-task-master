/**
 * Task Master Flow - Schema Definitions
 * Simplified schema definitions focused on TUI functionality
 * (Execution schemas removed - handled by VibeKit SDK)
 */

export { FlowMetadata, SchemaVersion } from './metadata.schema.js';

/**
 * Schema version for backward compatibility
 */
export const FLOW_SCHEMA_VERSION = '1.0.0';

/**
 * Validation utilities
 */
export {
	validateSchema,
	parseWithSchema,
	encodeWithSchema
} from './validation.js';

/**
 * Schema type guards for runtime checks (TUI-focused)
 */
export {
	isValidFlowMetadata,
	isValidSchemaVersion
} from './guards.js';
