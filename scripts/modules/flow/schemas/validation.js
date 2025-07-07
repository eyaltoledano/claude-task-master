/**
 * Task Master Flow - Schema Validation Utilities
 * Phase 1: Schema & Storage Layer
 *
 * Validation utilities with proper error handling following Effect best practices.
 */

import { Effect, Schema as S } from 'effect';

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
	constructor(message, errors = [], schema = null) {
		super(message);
		this.name = 'ValidationError';
		this.errors = errors;
		this.schema = schema;
		this.timestamp = new Date().toISOString();
	}
}

/**
 * Custom parsing error class
 */
export class ParsingError extends Error {
	constructor(message, originalError = null, data = null) {
		super(message);
		this.name = 'ParsingError';
		this.originalError = originalError;
		this.data = data;
		this.timestamp = new Date().toISOString();
	}
}

/**
 * Validate data against a schema with detailed error reporting
 *
 * @param {S.Schema} schema - Effect Schema to validate against
 * @param {unknown} data - Data to validate
 * @param {Object} options - Validation options
 * @returns {Effect} Effect that resolves to validated data or rejects with validation error
 */
export const validateSchema = (schema, data, options = {}) => {
	const { strict = true, collectAllErrors = true } = options;

	return Effect.gen(function* () {
		try {
			// Use Schema.decodeUnknown for runtime validation
			const result = yield* S.decodeUnknown(schema)(data);
			return result;
		} catch (error) {
			// Extract detailed error information
			const errors = extractValidationErrors(error);
			const message = `Schema validation failed: ${errors.length} error(s) found`;

			throw new ValidationError(message, errors, schema);
		}
	}).pipe(
		Effect.catchAll((error) => {
			if (error instanceof ValidationError) {
				return Effect.fail(error);
			}

			// Wrap other errors
			const wrappedError = new ValidationError(
				`Unexpected validation error: ${error.message}`,
				[{ path: [], message: error.message }],
				schema
			);
			return Effect.fail(wrappedError);
		})
	);
};

/**
 * Parse JSON data with schema validation
 *
 * @param {S.Schema} schema - Effect Schema to validate against
 * @param {string} jsonString - JSON string to parse and validate
 * @param {Object} options - Parsing options
 * @returns {Effect} Effect that resolves to validated data
 */
export const parseWithSchema = (schema, jsonString, options = {}) => {
	const { allowComments = false, strict = true } = options;

	return Effect.gen(function* () {
		// First parse JSON
		let parsedData;
		try {
			parsedData = JSON.parse(jsonString);
		} catch (error) {
			throw new ParsingError(
				`JSON parsing failed: ${error.message}`,
				error,
				jsonString
			);
		}

		// Then validate with schema
		const validatedData = yield* validateSchema(schema, parsedData, options);
		return validatedData;
	});
};

/**
 * Encode data with schema validation before serialization
 *
 * @param {S.Schema} schema - Effect Schema to validate against
 * @param {unknown} data - Data to encode
 * @param {Object} options - Encoding options
 * @returns {Effect} Effect that resolves to JSON string
 */
export const encodeWithSchema = (schema, data, options = {}) => {
	const { pretty = false, strict = true } = options;

	return Effect.gen(function* () {
		// Validate data first
		const validatedData = yield* validateSchema(schema, data, { strict });

		// Encode using Schema.encode
		const encoded = yield* S.encode(schema)(validatedData);

		// Convert to JSON string
		try {
			return pretty
				? JSON.stringify(encoded, null, 2)
				: JSON.stringify(encoded);
		} catch (error) {
			throw new ParsingError(
				`JSON serialization failed: ${error.message}`,
				error,
				encoded
			);
		}
	});
};

/**
 * Validate multiple schemas in parallel
 *
 * @param {Array} validations - Array of {schema, data, name} objects
 * @param {Object} options - Validation options
 * @returns {Effect} Effect that resolves to array of validation results
 */
export const validateMultiple = (validations, options = {}) => {
	const { continueOnError = false } = options;

	const validationEffects = validations.map(({ schema, data, name }, index) =>
		validateSchema(schema, data, options).pipe(
			Effect.map((result) => ({
				success: true,
				name: name || `item_${index}`,
				result
			})),
			Effect.catchAll((error) => {
				const errorResult = {
					success: false,
					name: name || `item_${index}`,
					error: error.message,
					details: error.errors || []
				};

				return continueOnError
					? Effect.succeed(errorResult)
					: Effect.fail(error);
			})
		)
	);

	return Effect.all(validationEffects);
};

/**
 * Conditional validation based on data content
 *
 * @param {unknown} data - Data to validate
 * @param {Object} schemaMap - Map of condition -> schema
 * @param {Function} discriminator - Function to determine which schema to use
 * @param {Object} options - Validation options
 * @returns {Effect} Effect that resolves to validated data
 */
export const validateConditional = (
	data,
	schemaMap,
	discriminator,
	options = {}
) => {
	return Effect.gen(function* () {
		// Determine which schema to use
		const schemaKey = discriminator(data);
		const schema = schemaMap[schemaKey];

		if (!schema) {
			throw new ValidationError(
				`No schema found for discriminator value: ${schemaKey}`,
				[{ path: [], message: `Unknown schema key: ${schemaKey}` }]
			);
		}

		// Validate with selected schema
		return yield* validateSchema(schema, data, options);
	});
};

/**
 * Extract detailed error information from Effect Schema validation errors
 *
 * @param {Error} error - Validation error from Effect Schema
 * @returns {Array} Array of detailed error objects
 */
export const extractValidationErrors = (error) => {
	const errors = [];

	if (error && error.message) {
		// Try to parse Effect Schema error format
		try {
			// Basic error extraction - can be enhanced based on actual Effect Schema error format
			if (error.errors && Array.isArray(error.errors)) {
				return error.errors.map((err) => ({
					path: err.path || [],
					message: err.message || err.toString(),
					value: err.value,
					expected: err.expected
				}));
			}

			// Fallback for single error
			errors.push({
				path: [],
				message: error.message,
				value: error.value || undefined,
				expected: error.expected || undefined
			});
		} catch (parseError) {
			// If we can't parse the error structure, return basic info
			errors.push({
				path: [],
				message: error.message || error.toString(),
				value: undefined,
				expected: undefined
			});
		}
	}

	return errors;
};

/**
 * Format validation errors for user-friendly display
 *
 * @param {ValidationError} error - Validation error
 * @param {Object} options - Formatting options
 * @returns {string} Formatted error message
 */
export const formatValidationError = (error, options = {}) => {
	const { includeDetails = true, includeValues = false } = options;

	if (!(error instanceof ValidationError)) {
		return error.message || error.toString();
	}

	let message = error.message + '\n';

	if (includeDetails && error.errors && error.errors.length > 0) {
		message += '\nValidation errors:\n';

		error.errors.forEach((err, index) => {
			const path =
				err.path && err.path.length > 0 ? err.path.join('.') : 'root';
			message += `  ${index + 1}. Path: ${path}\n`;
			message += `     Error: ${err.message}\n`;

			if (includeValues) {
				if (err.value !== undefined) {
					message += `     Value: ${JSON.stringify(err.value)}\n`;
				}
				if (err.expected !== undefined) {
					message += `     Expected: ${err.expected}\n`;
				}
			}
			message += '\n';
		});
	}

	return message.trim();
};

/**
 * Create a validation middleware for common validation patterns
 *
 * @param {S.Schema} schema - Schema to validate against
 * @param {Object} options - Middleware options
 * @returns {Function} Validation middleware function
 */
export const createValidationMiddleware = (schema, options = {}) => {
	return (data) => validateSchema(schema, data, options);
};

/**
 * JSDoc type definitions
 *
 * @typedef {Object} ValidationResult
 * @property {boolean} success - Whether validation succeeded
 * @property {unknown} [result] - Validated data (if successful)
 * @property {string} [error] - Error message (if failed)
 * @property {Array} [details] - Detailed error information (if failed)
 */
