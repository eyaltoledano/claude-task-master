/**
 * Task Master Flow - Schema Type Guards
 * Simplified type guards focused on TUI functionality
 * (Execution guards removed - handled by VibeKit SDK)
 */

import { FlowMetadata, SchemaVersion } from './metadata.schema.js';
import { validateSchema } from './validation.js';

/**
 * Check if data is a valid FlowMetadata
 *
 * @param {unknown} data - Data to check
 * @returns {boolean} True if data is valid FlowMetadata
 */
export const isValidFlowMetadata = (data) => {
	try {
		if (!data || typeof data !== 'object') return false;
		if (!data.id || !data.type || !data.schemaVersion || !data.audit)
			return false;

		return (
			typeof data.id === 'string' &&
			typeof data.type === 'string' &&
			typeof data.schemaVersion === 'object' &&
			typeof data.audit === 'object'
		);
	} catch {
		return false;
	}
};

/**
 * Check if schema version is valid
 *
 * @param {unknown} version - Version to check
 * @returns {boolean} True if version is valid
 */
export const isValidSchemaVersion = (version) => {
	try {
		if (!version || typeof version !== 'object') return false;

		return (
			typeof version.major === 'number' &&
			typeof version.minor === 'number' &&
			typeof version.patch === 'number' &&
			version.major >= 0 &&
			version.minor >= 0 &&
			version.patch >= 0
		);
	} catch {
		return false;
	}
};

/**
 * Advanced type guard that validates with full schema
 *
 * @param {unknown} data - Data to validate
 * @param {S.Schema} schema - Schema to validate against
 * @returns {Promise<boolean>} Promise that resolves to validation result
 */
export const isValidBySchema = async (data, schema) => {
	try {
		const validation = validateSchema(schema, data);
		await validation; // This will throw if validation fails
		return true;
	} catch {
		return false;
	}
};

/**
 * Type guard factory for creating custom guards
 *
 * @param {S.Schema} schema - Schema to create guard for
 * @param {string} name - Name for the guard
 * @returns {Function} Type guard function
 */
export const createTypeGuard = (schema, name = 'unknown') => {
	return (data) => {
		try {
			// Basic null/undefined check
			if (data == null) return false;

			// For complex schemas, we'd need to run full validation
			// For now, return a simplified check
			return typeof data === 'object';
		} catch {
			return false;
		}
	};
};

/**
 * Validate and narrow type in one operation
 *
 * @param {unknown} data - Data to validate
 * @param {Function} guard - Type guard function
 * @param {string} errorMessage - Error message if validation fails
 * @returns {unknown} Validated data (throws if invalid)
 */
export const assertType = (
	data,
	guard,
	errorMessage = 'Type assertion failed'
) => {
	if (!guard(data)) {
		throw new TypeError(errorMessage);
	}
	return data;
};

/**
 * Collection of all type guards for easy access
 */
export const typeGuards = {
	isValidFlowMetadata,
	isValidSchemaVersion,
	isValidBySchema,
	createTypeGuard,
	assertType
};

/**
 * JSDoc type definitions
 *
 * @typedef {Function} TypeGuard
 * @property {unknown} data - Data to check
 * @returns {boolean} Whether data matches the type
 */
