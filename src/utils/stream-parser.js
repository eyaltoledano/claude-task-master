import { JSONParser } from '@streamparser/json';

/**
 * Custom error class for streaming-related failures
 * Provides error codes for robust error handling without string matching
 */
export class StreamingError extends Error {
	constructor(message, code) {
		super(message);
		this.name = 'StreamingError';
		this.code = code;

		// Maintain proper stack trace (V8 engines)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, StreamingError);
		}
	}
}

/**
 * Standard streaming error codes
 */
export const STREAMING_ERROR_CODES = {
	NOT_ASYNC_ITERABLE: 'STREAMING_NOT_SUPPORTED',
	STREAM_PROCESSING_FAILED: 'STREAM_PROCESSING_FAILED',
	STREAM_NOT_ITERABLE: 'STREAM_NOT_ITERABLE',
	BUFFER_SIZE_EXCEEDED: 'BUFFER_SIZE_EXCEEDED'
};

/**
 * Default maximum buffer size (1MB)
 */
export const DEFAULT_MAX_BUFFER_SIZE = 1024 * 1024; // 1MB in bytes

/**
 * Default validation function for parsed items
 * Checks if item exists, has a title property of type string, and that the trimmed title is not empty
 * @param {Object} item - The item to validate
 * @returns {boolean} True if item is valid, false otherwise
 */
function defaultItemValidator(item) {
	return (
		item && item.title && typeof item.title === 'string' && item.title.trim()
	);
}

/**
 * Validates an item using either a custom validator or the default validator
 * @param {Object} item - The item to validate
 * @param {Function} [customValidator] - Optional custom validation function
 * @returns {boolean} True if item is valid, false otherwise
 */
function isValidItem(item, customValidator) {
	return customValidator ? customValidator(item) : defaultItemValidator(item);
}

/**
 * Configuration options for the streaming JSON parser
 * @typedef {Object} StreamParserConfig
 * @property {string[]} jsonPaths - JSONPath expressions to extract specific objects (required)
 * @property {Function} [onProgress] - Callback for progress updates: (item, metadata) => void
 * @property {Function} [onError] - Callback for parsing errors: (error) => void
 * @property {Function} [estimateTokens] - Function to estimate tokens from text: (text) => number
 * @property {number} [expectedTotal] - Expected total number of items for progress calculation
 * @property {Function} [fallbackItemExtractor] - Function to extract items from complete JSON: (jsonObj) => Array
 * @property {Function} [itemValidator] - Function to validate parsed items: (item) => boolean
 * @property {number} [maxBufferSize] - Maximum buffer size in bytes (default: 1MB)
 */

/**
 * Metadata object passed to progress callbacks
 * @typedef {Object} ProgressMetadata
 * @property {number} currentCount - Current number of parsed items
 * @property {number} expectedTotal - Expected total number of items
 * @property {string} accumulatedText - All text accumulated so far
 * @property {number} estimatedTokens - Estimated token count of accumulated text
 */

/**
 * Result object returned by the stream parser
 * @typedef {Object} StreamParseResult
 * @property {Array} items - Array of parsed items
 * @property {string} accumulatedText - Complete accumulated text
 * @property {number} estimatedTokens - Final estimated token count
 * @property {boolean} usedFallback - Whether fallback parsing was used
 */

/**
 * Parse a streaming JSON response with progress tracking
 *
 * Example with custom buffer size:
 * ```js
 * const result = await parseStream(stream, {
 *   jsonPaths: ['$.tasks.*'],
 *   maxBufferSize: 2 * 1024 * 1024 // 2MB
 * });
 * ```
 *
 * @param {Object} textStream - The AI service text stream object
 * @param {StreamParserConfig} config - Configuration options
 * @returns {Promise<StreamParseResult>} Parsed result with metadata
 */
export async function parseStream(textStream, config = {}) {
	const {
		jsonPaths,
		onProgress,
		onError,
		estimateTokens = (text) => Math.ceil(text.length / 4),
		expectedTotal = 0,
		fallbackItemExtractor,
		itemValidator,
		maxBufferSize = DEFAULT_MAX_BUFFER_SIZE
	} = config;

	if (!textStream) {
		throw new Error('No text stream provided');
	}

	if (!jsonPaths || !Array.isArray(jsonPaths)) {
		throw new Error('jsonPaths is required and must be an array');
	}

	const parsedItems = [];
	let accumulatedText = '';
	let estimatedTokens = 0;
	let usedFallback = false;

	// Create JSON parser with specified paths
	const parser = new JSONParser({ paths: jsonPaths });

	// Set up parser event handlers
	parser.onValue = (value, key, parent, stack) => {
		// Extract the actual item object from the parser's nested structure
		const item = value.value || value;

		// Use helper function to validate item with custom or default validator
		if (isValidItem(item, itemValidator)) {
			parsedItems.push(item);

			if (onProgress) {
				const currentCount = parsedItems.length;

				// Re-estimate tokens based on accumulated text
				estimatedTokens = estimateTokens(accumulatedText);

				const metadata = {
					currentCount,
					expectedTotal,
					accumulatedText,
					estimatedTokens
				};

				// Call progress callback
				try {
					onProgress(item, metadata);
				} catch (progressError) {
					if (onError) {
						onError(
							new Error(`Progress callback failed: ${progressError.message}`)
						);
					}
				}
			}
		}
	};

	parser.onError = (error) => {
		if (onError) {
			onError(new Error(`JSON parsing error: ${error.message}`));
		}
		// Don't throw here - we'll handle this in the fallback logic
	};

	// Process the stream - handle different possible stream structures
	try {
		await processTextStream(textStream, (chunk) => {
			// Check buffer size before adding chunk
			const newSize = Buffer.byteLength(accumulatedText + chunk, 'utf8');
			if (newSize > maxBufferSize) {
				throw new StreamingError(
					`Buffer size exceeded: ${newSize} bytes > ${maxBufferSize} bytes maximum`,
					STREAMING_ERROR_CODES.BUFFER_SIZE_EXCEEDED
				);
			}
			accumulatedText += chunk;
			parser.write(chunk);
		});
	} catch (streamError) {
		// Re-throw StreamingError as-is, wrap other errors
		if (streamError instanceof StreamingError) {
			throw streamError;
		}
		throw new StreamingError(
			`Failed to process AI text stream: ${streamError.message}`,
			STREAMING_ERROR_CODES.STREAM_PROCESSING_FAILED
		);
	}

	parser.end();

	// Wait for final parsing to complete (JSON parser may still be processing)
	await new Promise((resolve) => setTimeout(resolve, 100));

	// If streaming parser didn't get all expected items, try fallback parsing
	if (
		expectedTotal > 0 &&
		parsedItems.length < expectedTotal &&
		accumulatedText &&
		fallbackItemExtractor
	) {
		try {
			const fallbackItems = await attemptFallbackParsing(
				accumulatedText,
				parsedItems,
				expectedTotal,
				{
					onProgress,
					estimateTokens,
					fallbackItemExtractor,
					maxBufferSize
				}
			);

			if (fallbackItems.length > 0) {
				parsedItems.push(...fallbackItems);
				usedFallback = true;
			}
		} catch (parseError) {
			// If we have some items from streaming, continue with those
			if (parsedItems.length === 0) {
				throw new Error(
					`Failed to parse AI response as JSON: ${parseError.message}`
				);
			}
		}
	}

	// Final token estimation
	estimatedTokens = estimateTokens(accumulatedText);

	return {
		items: parsedItems,
		accumulatedText,
		estimatedTokens,
		usedFallback
	};
}

/**
 * Process different types of text streams
 * @param {Object} textStream - The stream object from AI service
 * @param {Function} onChunk - Callback for each text chunk
 */
export async function processTextStream(textStream, onChunk) {
	// Try textStream property first (most common)
	if (
		textStream.textStream &&
		typeof textStream.textStream[Symbol.asyncIterator] === 'function'
	) {
		for await (const chunk of textStream.textStream) {
			onChunk(chunk);
		}
	}
	// Try fullStream property as fallback
	else if (
		textStream.fullStream &&
		typeof textStream.fullStream[Symbol.asyncIterator] === 'function'
	) {
		for await (const chunk of textStream.fullStream) {
			if (chunk.type === 'text-delta' && chunk.textDelta) {
				onChunk(chunk.textDelta);
			}
		}
	}
	// Try iterating the stream object directly
	else if (typeof textStream[Symbol.asyncIterator] === 'function') {
		for await (const chunk of textStream) {
			onChunk(chunk);
		}
	} else {
		throw new StreamingError(
			'Stream object is not iterable - no textStream, fullStream, or direct async iterator found',
			STREAMING_ERROR_CODES.STREAM_NOT_ITERABLE
		);
	}
}

/**
 * Attempt fallback JSON parsing when streaming parsing is incomplete
 * @param {string} accumulatedText - Complete accumulated text
 * @param {Array} existingItems - Items already parsed from streaming
 * @param {number} expectedTotal - Expected total number of items
 * @param {Object} config - Configuration for progress reporting
 * @returns {Promise<Array>} Additional items found via fallback parsing
 */
async function attemptFallbackParsing(
	accumulatedText,
	existingItems,
	expectedTotal,
	config
) {
	const { onProgress, estimateTokens, fallbackItemExtractor } = config;
	const newItems = [];

	try {
		const fullResponse = JSON.parse(accumulatedText);
		const fallbackItems = fallbackItemExtractor(fullResponse);

		if (Array.isArray(fallbackItems)) {
			// Only add items we haven't already parsed
			const itemsToAdd = fallbackItems.slice(existingItems.length);

			for (const item of itemsToAdd) {
				// Use the same validation helper function
				if (isValidItem(item)) {
					newItems.push(item);

					if (onProgress) {
						const currentCount = existingItems.length + newItems.length;
						const estimatedTokens = estimateTokens(accumulatedText);

						const metadata = {
							currentCount,
							expectedTotal,
							accumulatedText,
							estimatedTokens
						};

						try {
							onProgress(item, metadata);
						} catch (progressError) {
							// Log but don't break the flow
							console.warn(
								`Progress callback failed: ${progressError.message}`
							);
						}
					}
				}
			}
		}
	} catch (parseError) {
		throw new Error(`Fallback JSON parsing failed: ${parseError.message}`);
	}

	return newItems;
}
