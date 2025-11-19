/**
 * Schema transformation and structured output exports
 */

// Schema Transformer exports
export {
	buildConstraintDescription,
	removeUnsupportedFeatures,
	UNSUPPORTED_KEYWORDS,
	getModelMaxTokens,
	normalizeTokenParams,
	transformSnowflakeRequestBody
} from './transformer.js';
export type { JSONSchema, JSONSchemaType, ModelInfo } from './transformer.js';

// Structured Output Generator exports
export { StructuredOutputGenerator } from './structured-output.js';
export type {
	StructuredOutputMessage,
	StructuredOutputParams,
	GenerateTextFunction,
	GenerateObjectParams,
	GenerateObjectResult
} from './structured-output.js';

// JSON Parser exports (now in structured-output.ts)
export {
	extractJson,
	extractStreamJson,
	isValidJson,
	cleanJsonText
} from './structured-output.js';

