import { JSONParser } from '@streamparser/json';

/**
 * Configuration options for the streaming JSON parser
 * @typedef {Object} StreamParserConfig
 * @property {string[]} [jsonPaths] - JSONPath expressions to extract specific objects (default: ['$.tasks.*'])
 * @property {Function} [onProgress] - Callback for progress updates: (item, metadata) => void
 * @property {Function} [onError] - Callback for parsing errors: (error) => void
 * @property {Function} [estimateTokens] - Function to estimate tokens from text: (text) => number
 * @property {Object} [priorityMap] - Mapping of priority levels to indicators
 * @property {number} [expectedTotal] - Expected total number of items for progress calculation
 * @property {string} [progressMessageTemplate] - Template for progress messages
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
 * @param {Object} textStream - The AI service text stream object
 * @param {StreamParserConfig} config - Configuration options
 * @returns {Promise<StreamParseResult>} Parsed result with metadata
 */
export async function parseStreamingJSON(textStream, config = {}) {
	const {
		jsonPaths = ['$.tasks.*'],
		onProgress,
		onError,
		estimateTokens = (text) => Math.ceil(text.length / 4),
		priorityMap = {}, // No default - must be provided by caller
		expectedTotal = 0,
		progressMessageTemplate = '{indicator} Item {current}/{total} - {title} | ~Output: {tokens} tokens'
	} = config;

	if (!textStream) {
		throw new Error('No text stream provided');
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

		// Only process if we have a valid item with a title
		if (
			item &&
			item.title &&
			typeof item.title === 'string' &&
			item.title.trim()
		) {
			parsedItems.push(item);

			if (onProgress) {
				const currentCount = parsedItems.length;
				const priority = item.priority || 'medium';
				const priorityIndicator = priorityMap[priority] || '⚪';

				// Re-estimate tokens based on accumulated text
				estimatedTokens = estimateTokens(accumulatedText);

				const metadata = {
					currentCount,
					expectedTotal,
					accumulatedText,
					estimatedTokens,
					priority,
					priorityIndicator
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
			accumulatedText += chunk;
			parser.write(chunk);
		});
	} catch (streamError) {
		throw new Error(`Failed to process AI text stream: ${streamError.message}`);
	}

	parser.end();

	// Wait a moment for final parsing
	await new Promise((resolve) => setTimeout(resolve, 100));

	// If streaming parser didn't get all expected items, try fallback parsing
	if (
		expectedTotal > 0 &&
		parsedItems.length < expectedTotal &&
		accumulatedText
	) {
		try {
			const fallbackItems = await attemptFallbackParsing(
				accumulatedText,
				parsedItems,
				expectedTotal,
				{
					onProgress,
					estimateTokens,
					priorityMap,
					progressMessageTemplate
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
async function processTextStream(textStream, onChunk) {
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
		throw new Error(
			'Stream object is not iterable - no textStream, fullStream, or direct async iterator found'
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
	const { onProgress, estimateTokens, priorityMap } = config;
	const newItems = [];

	try {
		const fullResponse = JSON.parse(accumulatedText);
		if (fullResponse.tasks && Array.isArray(fullResponse.tasks)) {
			// Only add items we haven't already parsed
			const fallbackItems = fullResponse.tasks.slice(existingItems.length);

			for (const item of fallbackItems) {
				if (
					item &&
					item.title &&
					typeof item.title === 'string' &&
					item.title.trim()
				) {
					newItems.push(item);

					if (onProgress) {
						const currentCount = existingItems.length + newItems.length;
						const priority = item.priority || 'medium';
						const priorityIndicator = priorityMap[priority] || '⚪';
						const estimatedTokens = estimateTokens(accumulatedText);

						const metadata = {
							currentCount,
							expectedTotal,
							accumulatedText,
							estimatedTokens,
							priority,
							priorityIndicator
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

/**
 * Create a progress callback for task parsing specifically
 * @param {Function} reportProgress - Progress reporting function
 * @param {number} expectedTotal - Expected total number of tasks
 * @returns {Function} Progress callback function
 */
export function createTaskProgressCallback(reportProgress, expectedTotal) {
	return async (task, metadata) => {
		const { currentCount, priorityIndicator, estimatedTokens } = metadata;

		const message = `${priorityIndicator} Task ${currentCount}/${expectedTotal} - ${task.title} | ~Output: ${estimatedTokens} tokens`;

		try {
			await reportProgress({
				progress: currentCount,
				total: expectedTotal,
				message
			});
		} catch (error) {
			// Log progress errors but don't break the flow
			console.warn(`Progress reporting failed: ${error.message}`);
		}
	};
}

/**
 * Create a simple console progress callback for CLI usage
 * @param {string} [prefix='Progress'] - Prefix for progress messages
 * @returns {Function} Progress callback function
 */
export function createConsoleProgressCallback(prefix = 'Progress') {
	return (item, metadata) => {
		const { currentCount, expectedTotal, priorityIndicator, estimatedTokens } =
			metadata;
		const message = `${prefix}: ${priorityIndicator} ${currentCount}/${expectedTotal} - ${item.title} | ~${estimatedTokens} tokens`;
		console.log(message);
	};
}
