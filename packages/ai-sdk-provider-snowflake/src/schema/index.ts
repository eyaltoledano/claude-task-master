/**
 * Schema module exports
 */

export {
	removeUnsupportedFeatures,
	buildConstraintDescription,
	getModelMaxTokens,
	normalizeTokenParams,
	transformSnowflakeRequestBody,
	convertPromptToMessages,
	isClaudeModel,
	UNSUPPORTED_KEYWORDS
} from './transformer.js';

export type {
	JSONSchema,
	JSONSchemaType,
	ModelInfo,
	CortexMessage,
	ConvertPromptOptions
} from './transformer.js';

// Structured output utilities
export {
	StructuredOutputGenerator,
	extractJson,
	extractStreamJson,
	isValidJson,
	cleanJsonText,
	// JSON extraction utilities (shared with CLI language model)
	extractFirstJsonObject,
	parseJsonWithFallback,
	extractAndParseJson
} from './structured-output.js';

export type {
	StructuredOutputMessage,
	StructuredOutputParams,
	GenerateTextFunction,
	GenerateObjectParams,
	GenerateObjectResult
} from './structured-output.js';
