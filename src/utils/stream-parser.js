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
 * Configuration options for the streaming JSON parser
 */
class StreamParserConfig {
	constructor(config = {}) {
		this.jsonPaths = config.jsonPaths;
		this.onProgress = config.onProgress;
		this.onError = config.onError;
		this.estimateTokens =
			config.estimateTokens || ((text) => Math.ceil(text.length / 4));
		this.expectedTotal = config.expectedTotal || 0;
		this.fallbackItemExtractor = config.fallbackItemExtractor;
		this.itemValidator =
			config.itemValidator || StreamParserConfig.defaultItemValidator;
		this.maxBufferSize = config.maxBufferSize || DEFAULT_MAX_BUFFER_SIZE;

		this.validate();
	}

	validate() {
		if (!this.jsonPaths || !Array.isArray(this.jsonPaths)) {
			throw new Error('jsonPaths is required and must be an array');
		}
		if (this.jsonPaths.length === 0) {
			throw new Error('jsonPaths array cannot be empty');
		}
		if (this.maxBufferSize <= 0) {
			throw new Error('maxBufferSize must be positive');
		}
		if (this.expectedTotal < 0) {
			throw new Error('expectedTotal cannot be negative');
		}
		if (this.estimateTokens && typeof this.estimateTokens !== 'function') {
			throw new Error('estimateTokens must be a function');
		}
		if (this.onProgress && typeof this.onProgress !== 'function') {
			throw new Error('onProgress must be a function');
		}
		if (this.onError && typeof this.onError !== 'function') {
			throw new Error('onError must be a function');
		}
		if (
			this.fallbackItemExtractor &&
			typeof this.fallbackItemExtractor !== 'function'
		) {
			throw new Error('fallbackItemExtractor must be a function');
		}
		if (this.itemValidator && typeof this.itemValidator !== 'function') {
			throw new Error('itemValidator must be a function');
		}
	}

	static defaultItemValidator(item) {
		return (
			item && item.title && typeof item.title === 'string' && item.title.trim()
		);
	}
}

/**
 * Manages progress tracking and metadata
 */
class ProgressTracker {
	constructor(config) {
		this.onProgress = config.onProgress;
		this.onError = config.onError;
		this.estimateTokens = config.estimateTokens;
		this.expectedTotal = config.expectedTotal;
		this.parsedItems = [];
		this.accumulatedText = '';
	}

	addItem(item) {
		this.parsedItems.push(item);
		this.reportProgress(item);
	}

	addText(chunk) {
		this.accumulatedText += chunk;
	}

	getMetadata() {
		return {
			currentCount: this.parsedItems.length,
			expectedTotal: this.expectedTotal,
			accumulatedText: this.accumulatedText,
			estimatedTokens: this.estimateTokens(this.accumulatedText)
		};
	}

	reportProgress(item) {
		if (!this.onProgress) return;

		try {
			this.onProgress(item, this.getMetadata());
		} catch (progressError) {
			this.handleProgressError(progressError);
		}
	}

	handleProgressError(error) {
		if (this.onError) {
			this.onError(new Error(`Progress callback failed: ${error.message}`));
		}
	}
}

/**
 * Handles stream processing with different stream types
 */
class StreamProcessor {
	constructor(onChunk) {
		this.onChunk = onChunk;
	}

	async process(textStream) {
		const streamHandler = this.detectStreamType(textStream);
		await streamHandler(textStream);
	}

	detectStreamType(textStream) {
		// Check for textStream property
		if (this.hasAsyncIterator(textStream?.textStream)) {
			return (stream) => this.processTextStream(stream.textStream);
		}

		// Check for fullStream property
		if (this.hasAsyncIterator(textStream?.fullStream)) {
			return (stream) => this.processFullStream(stream.fullStream);
		}

		// Check if stream itself is iterable
		if (this.hasAsyncIterator(textStream)) {
			return (stream) => this.processDirectStream(stream);
		}

		throw new StreamingError(
			'Stream object is not iterable - no textStream, fullStream, or direct async iterator found',
			STREAMING_ERROR_CODES.STREAM_NOT_ITERABLE
		);
	}

	hasAsyncIterator(obj) {
		return obj && typeof obj[Symbol.asyncIterator] === 'function';
	}

	async processTextStream(stream) {
		for await (const chunk of stream) {
			this.onChunk(chunk);
		}
	}

	async processFullStream(stream) {
		for await (const chunk of stream) {
			if (chunk.type === 'text-delta' && chunk.textDelta) {
				this.onChunk(chunk.textDelta);
			}
		}
	}

	async processDirectStream(stream) {
		for await (const chunk of stream) {
			this.onChunk(chunk);
		}
	}
}

/**
 * Manages JSON parsing with the streaming parser
 */
class JSONStreamParser {
	constructor(config, progressTracker) {
		this.config = config;
		this.progressTracker = progressTracker;
		this.parser = new JSONParser({ paths: config.jsonPaths });
		this.setupHandlers();
	}

	setupHandlers() {
		this.parser.onValue = (value, key, parent, stack) => {
			this.handleParsedValue(value);
		};

		this.parser.onError = (error) => {
			this.handleParseError(error);
		};
	}

	handleParsedValue(value) {
		// Extract the actual item object from the parser's nested structure
		const item = value.value || value;

		if (this.config.itemValidator(item)) {
			this.progressTracker.addItem(item);
		}
	}

	handleParseError(error) {
		if (this.config.onError) {
			this.config.onError(new Error(`JSON parsing error: ${error.message}`));
		}
		// Don't throw here - we'll handle this in the fallback logic
	}

	write(chunk) {
		this.parser.write(chunk);
	}

	end() {
		this.parser.end();
	}
}

/**
 * Handles fallback parsing when streaming fails
 */
class FallbackParser {
	constructor(config, progressTracker) {
		this.config = config;
		this.progressTracker = progressTracker;
	}

	async attemptParsing() {
		if (!this.shouldAttemptFallback()) {
			return [];
		}

		try {
			return await this.parseFallbackItems();
		} catch (parseError) {
			this.handleFallbackError(parseError);
			return [];
		}
	}

	shouldAttemptFallback() {
		return (
			this.config.expectedTotal > 0 &&
			this.progressTracker.parsedItems.length < this.config.expectedTotal &&
			this.progressTracker.accumulatedText &&
			this.config.fallbackItemExtractor
		);
	}

	async parseFallbackItems() {
		const jsonText = this._cleanJsonText(this.progressTracker.accumulatedText);
		const fullResponse = JSON.parse(jsonText);
		const fallbackItems = this.config.fallbackItemExtractor(fullResponse);

		if (!Array.isArray(fallbackItems)) {
			return [];
		}

		return this._processNewItems(fallbackItems);
	}

	_cleanJsonText(text) {
		// Remove markdown code block wrappers and trim whitespace
		return text
			.replace(/^```(?:json)?\s*\n?/i, '')
			.replace(/\n?```\s*$/i, '')
			.trim();
	}

	_processNewItems(fallbackItems) {
		// Only add items we haven't already parsed
		const itemsToAdd = fallbackItems.slice(
			this.progressTracker.parsedItems.length
		);
		const newItems = [];

		for (const item of itemsToAdd) {
			if (this.config.itemValidator(item)) {
				newItems.push(item);
				this.progressTracker.addItem(item);
			}
		}

		return newItems;
	}

	handleFallbackError(error) {
		if (this.progressTracker.parsedItems.length === 0) {
			throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
		}
		// If we have some items from streaming, continue with those
	}
}

/**
 * Buffer size validator
 */
class BufferSizeValidator {
	constructor(maxSize) {
		this.maxSize = maxSize;
		this.currentSize = 0;
	}

	validateChunk(existingText, newChunk) {
		const newSize = Buffer.byteLength(existingText + newChunk, 'utf8');

		if (newSize > this.maxSize) {
			throw new StreamingError(
				`Buffer size exceeded: ${newSize} bytes > ${this.maxSize} bytes maximum`,
				STREAMING_ERROR_CODES.BUFFER_SIZE_EXCEEDED
			);
		}

		this.currentSize = newSize;
	}
}

/**
 * Main orchestrator for stream parsing
 */
class StreamParserOrchestrator {
	constructor(config) {
		this.config = new StreamParserConfig(config);
		this.progressTracker = new ProgressTracker(this.config);
		this.bufferValidator = new BufferSizeValidator(this.config.maxBufferSize);
		this.jsonParser = new JSONStreamParser(this.config, this.progressTracker);
		this.fallbackParser = new FallbackParser(this.config, this.progressTracker);
	}

	async parse(textStream) {
		if (!textStream) {
			throw new Error('No text stream provided');
		}

		await this.processStream(textStream);
		await this.waitForParsingCompletion();

		const usedFallback = await this.attemptFallbackIfNeeded();

		return this.buildResult(usedFallback);
	}

	async processStream(textStream) {
		const processor = new StreamProcessor((chunk) => {
			this.bufferValidator.validateChunk(
				this.progressTracker.accumulatedText,
				chunk
			);
			this.progressTracker.addText(chunk);
			this.jsonParser.write(chunk);
		});

		try {
			await processor.process(textStream);
		} catch (streamError) {
			this.handleStreamError(streamError);
		}

		this.jsonParser.end();
	}

	handleStreamError(error) {
		// Re-throw StreamingError as-is, wrap other errors
		if (error instanceof StreamingError) {
			throw error;
		}
		throw new StreamingError(
			`Failed to process AI text stream: ${error.message}`,
			STREAMING_ERROR_CODES.STREAM_PROCESSING_FAILED
		);
	}

	async waitForParsingCompletion() {
		// Wait for final parsing to complete (JSON parser may still be processing)
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	async attemptFallbackIfNeeded() {
		const fallbackItems = await this.fallbackParser.attemptParsing();
		return fallbackItems.length > 0;
	}

	buildResult(usedFallback) {
		const metadata = this.progressTracker.getMetadata();

		return {
			items: this.progressTracker.parsedItems,
			accumulatedText: metadata.accumulatedText,
			estimatedTokens: metadata.estimatedTokens,
			usedFallback
		};
	}
}

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
 * @param {Object} config - Configuration options
 * @returns {Promise<Object>} Parsed result with metadata
 */
export async function parseStream(textStream, config = {}) {
	const orchestrator = new StreamParserOrchestrator(config);
	return orchestrator.parse(textStream);
}

/**
 * Process different types of text streams
 * @param {Object} textStream - The stream object from AI service
 * @param {Function} onChunk - Callback for each text chunk
 */
export async function processTextStream(textStream, onChunk) {
	const processor = new StreamProcessor(onChunk);
	await processor.process(textStream);
}

/**
 * Attempt fallback JSON parsing when streaming parsing is incomplete
 * @param {string} accumulatedText - Complete accumulated text
 * @param {Array} existingItems - Items already parsed from streaming
 * @param {number} expectedTotal - Expected total number of items
 * @param {Object} config - Configuration for progress reporting
 * @returns {Promise<Array>} Additional items found via fallback parsing
 */
export async function attemptFallbackParsing(
	accumulatedText,
	existingItems,
	expectedTotal,
	config
) {
	// Create a temporary progress tracker for backward compatibility
	const progressTracker = new ProgressTracker({
		onProgress: config.onProgress,
		onError: config.onError,
		estimateTokens: config.estimateTokens,
		expectedTotal
	});

	progressTracker.parsedItems = existingItems;
	progressTracker.accumulatedText = accumulatedText;

	const fallbackParser = new FallbackParser(
		{
			...config,
			expectedTotal,
			itemValidator:
				config.itemValidator || StreamParserConfig.defaultItemValidator
		},
		progressTracker
	);

	return fallbackParser.attemptParsing();
}
